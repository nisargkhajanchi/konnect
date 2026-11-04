/**
 * read-summary: reads an uploaded discharge summary with Claude and stores the extraction.
 *
 * POST { document_id }  (Authorization: Bearer <user JWT>, sent automatically by supabase.functions.invoke)
 * -> 200 { document_id, extraction, needs_review }
 *
 * The caller must be a primary or backup contact for the document's patient. Nothing is saved to the
 * patient's plan here: the family confirms on the review screen, which calls confirm_extraction().
 *
 * Secrets: ANTHROPIC_API_KEY (set with `supabase secrets set`). SUPABASE_URL, SUPABASE_ANON_KEY and
 * SUPABASE_SERVICE_ROLE_KEY are provided by the Supabase runtime.
 */
import Anthropic from 'npm:@anthropic-ai/sdk@1.4.0';
import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import { encodeBase64 } from 'jsr:@std/encoding@1/base64';

import {
  EXTRACTION_SCHEMA, EXTRACTION_SYSTEM_PROMPT, ExtractionError, needsReview, normalizeExtraction,
} from '../_shared/extraction.ts';
import { sniffMediaType } from '../_shared/media.ts';

const MODEL = 'claude-opus-5-5';
const MAX_BYTES = 20 * 1024 * 1024; // well under the 32 MB request limit after base64
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

/** An error whose message is safe to show the family. */
class UserFacingError extends Error {
  constructor(message: string, readonly status = 422) { super(message); }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Sign in first.' }, 401);

  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!url || !anonKey || !serviceKey || !anthropicKey) {
    console.error('read-summary: missing environment configuration');
    return json({ error: 'The document reader is not configured yet.' }, 500);
  }

  // The user client runs under the caller's identity, so row-level security applies.
  const asUser = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } });
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  const { data: auth } = await asUser.auth.getUser();
  if (!auth?.user) return json({ error: 'Sign in first.' }, 401);

  const body = await req.json().catch(() => null) as { document_id?: unknown } | null;
  const documentId = typeof body?.document_id === 'string' && UUID.test(body.document_id) ? body.document_id : null;
  if (!documentId) return json({ error: 'document_id is required.' }, 400);

  const { data: doc } = await asUser.from('documents').select('id, patient_id, storage_path').eq('id', documentId).maybeSingle();
  if (!doc) return json({ error: 'Document not found.' }, 404);
  const { data: canManage } = await asUser.rpc('can_manage', { p: doc.patient_id });
  if (!canManage) return json({ error: 'Only the main family contacts can add documents.' }, 403);

  await admin.from('documents').update({ status: 'reading', error: null }).eq('id', documentId);

  try {
    const { data: file, error: dlError } = await admin.storage.from('documents').download(doc.storage_path);
    if (dlError || !file) throw new UserFacingError('We could not open the uploaded file. Please upload it again.', 404);
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.byteLength > MAX_BYTES) throw new UserFacingError('This file is larger than 20 MB. Try a PDF, or photos of each page.', 413);

    // Trust the file's bytes, not the name or the client's MIME type.
    const media = sniffMediaType(bytes);
    if (!media) throw new UserFacingError('Please upload a PDF, JPG or PNG. Other formats (such as HEIC) are not supported yet.', 415);

    const data = encodeBase64(bytes);
    const fileBlock: Anthropic.Beta.BetaContentBlockParam = media === 'application/pdf'
      ? { type: 'document', source: { type: 'base64', media_type: media, data } }
      : { type: 'image', source: { type: 'base64', media_type: media, data } };

    const client = new Anthropic({ apiKey: anthropicKey, timeout: 120_000, maxRetries: 1 });
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      // If a safety classifier declines, the API re-runs the request on Anthropic's recommended fallback model.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      // Reading medical documents is accuracy-sensitive, so use high effort (Opus 5.5 defaults to medium).
      output_config: { effort: 'high', format: { type: 'json_schema', schema: EXTRACTION_SCHEMA } },
      system: EXTRACTION_SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: [fileBlock, { type: 'text', text: 'Extract the discharge summary into the required format.' }],
      }],
    });

    // Log sizes and outcome only. Never log document content.
    console.log(JSON.stringify({ fn: 'read-summary', model: response.model, stop: response.stop_reason, in: response.usage.input_tokens, out: response.usage.output_tokens }));

    if (response.stop_reason === 'refusal') throw new UserFacingError('This document could not be read automatically. Please enter the details by hand.');
    if (response.stop_reason === 'max_tokens') throw new UserFacingError('This document is too long to read in one go. Try uploading only the discharge pages.');

    const text = response.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
    let raw: unknown;
    try { raw = JSON.parse(text); } catch { throw new ExtractionError('Model output was not valid JSON'); }
    const extraction = normalizeExtraction(raw);

    await admin.from('documents').update({
      status: 'read', extraction, model: response.model, read_at: new Date().toISOString(), error: null,
    }).eq('id', documentId);

    return json({ document_id: documentId, extraction, needs_review: needsReview(extraction) });
  } catch (err) {
    let message = 'Something went wrong while reading the document. Please try again.';
    let status = 502;
    if (err instanceof UserFacingError) { message = err.message; status = err.status; }
    else if (err instanceof Anthropic.RateLimitError) { message = 'The document reader is busy. Please try again in a minute.'; status = 503; }
    else if (err instanceof Anthropic.APIConnectionError) { message = 'Could not reach the document reader. Please try again.'; status = 503; }
    console.error('read-summary failed:', err instanceof Error ? `${err.name}: ${err.message}` : String(err));
    await admin.from('documents').update({ status: 'failed', error: message }).eq('id', documentId);
    return json({ error: message }, status);
  }
});
