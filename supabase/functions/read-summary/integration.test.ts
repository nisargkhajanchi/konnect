/**
 * Runs the real read-summary function against a fake Supabase and a fake Claude API, and checks
 * the request sent to Claude plus what gets written back. No network or API keys needed.
 *
 *   deno test --config supabase/functions/read-summary/deno.json -A supabase/functions/read-summary/integration.test.ts
 */
import { assert, assertEquals } from 'jsr:@std/assert@1';

const FAKE_PORT = 54401;
const DOC_ID = '11111111-2222-4333-8444-555555555555';
const PATIENT_ID = '99999999-2222-4333-8444-555555555555';
const PDF = new TextEncoder().encode('%PDF-1.4\n% fake discharge summary\n');

type Captured = { claudeBody?: any; claudeHeaders?: Headers; patches: any[] };

function modelReply(extraction: unknown, stop_reason = 'end_turn') {
  return {
    id: 'msg_test', type: 'message', role: 'assistant', model: 'claude-opus-5-5', stop_reason, stop_sequence: null,
    content: [{ type: 'text', text: JSON.stringify(extraction) }],
    usage: { input_tokens: 1200, output_tokens: 300 },
  };
}

const EXTRACTION = {
  is_discharge_summary: true, legibility: 'clear',
  patient: { name: 'Test Patient', age: 70, sex: null },
  hospital: { name: 'Test Hospital', discharge_date: '2026-11-01' },
  diagnosis: { text: 'Pneumonia', confidence: 'high', source_page: 1 },
  treating_doctor: null,
  medicines: [{ name: 'Amoxicillin', strength: '500 mg', dose: null, frequency: '1-1-1', timing: 'Morning, afternoon and night', duration: '5 days', instructions: null, confidence: 'low', uncertainty_reason: 'Duration is handwritten.', source_page: 1 }],
  follow_ups: [], bp_limit: { sys: null, dia: null }, limits: [], warning_signs: [], allergies: [], diet_activity: [],
};

/** Fake Supabase (auth, PostgREST, storage) and fake Anthropic API on one port. */
function startFakes(cap: Captured, reply: () => unknown) {
  return Deno.serve({ port: FAKE_PORT, onListen: () => {} }, async (req) => {
    const u = new URL(req.url);
    if (u.pathname === '/auth/v1/user') {
      return req.headers.get('Authorization') === 'Bearer user-jwt'
        ? Response.json({ id: 'user-1', aud: 'authenticated', role: 'authenticated' })
        : Response.json({ msg: 'bad jwt' }, { status: 401 });
    }
    if (u.pathname === '/rest/v1/documents' && req.method === 'GET') {
      const row = { id: DOC_ID, patient_id: PATIENT_ID, storage_path: `${PATIENT_ID}/a.pdf` };
      return (req.headers.get('Accept') ?? '').includes('vnd.pgrst.object') ? Response.json(row) : Response.json([row]);
    }
    if (u.pathname === '/rest/v1/rpc/can_manage') return Response.json(true);
    if (u.pathname === '/rest/v1/documents' && req.method === 'PATCH') {
      cap.patches.push(await req.json());
      return new Response(null, { status: 204 });
    }
    if (u.pathname.startsWith('/storage/v1/object/documents/')) return new Response(PDF, { headers: { 'Content-Type': 'application/pdf' } });
    if (u.pathname === '/v1/messages') {
      cap.claudeBody = await req.json();
      cap.claudeHeaders = req.headers;
      return Response.json(reply());
    }
    return Response.json({ error: `unexpected ${req.method} ${u.pathname}` }, { status: 500 });
  });
}

async function runFunction(body: unknown, auth = 'Bearer user-jwt') {
  const child = new Deno.Command(Deno.execPath(), {
    args: ['run', '-A', '--config', new URL('./deno.json', import.meta.url).pathname, new URL('./index.ts', import.meta.url).pathname],
    env: {
      SUPABASE_URL: `http://localhost:${FAKE_PORT}`, SUPABASE_ANON_KEY: 'anon', SUPABASE_SERVICE_ROLE_KEY: 'service',
      ANTHROPIC_API_KEY: 'test-key', ANTHROPIC_BASE_URL: `http://localhost:${FAKE_PORT}`,
    },
    stdout: 'piped', stderr: 'piped',
  }).spawn();
  // Deno.serve() with no options listens on port 8000; retry until the function is up.
  let res: Response | null = null;
  for (let i = 0; i < 100 && !res; i++) {
    await new Promise((r) => setTimeout(r, 100));
    res = await fetch('http://localhost:8000/', { method: 'POST', headers: { Authorization: auth, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(() => null);
  }
  const json = res ? await res.json() : null;
  child.kill();
  const out = await child.output();
  return { status: res?.status ?? 0, json, logs: new TextDecoder().decode(out.stdout) + new TextDecoder().decode(out.stderr) };
}

Deno.test('reads a PDF, sends the right request to Claude, and saves the result', async () => {
  const cap: Captured = { patches: [] };
  const fakes = startFakes(cap, () => modelReply(EXTRACTION));
  try {
    const r = await runFunction({ document_id: DOC_ID });
    assertEquals(r.status, 200, r.logs);
    assertEquals(r.json.extraction.patient.name, 'Test Patient');
    assertEquals(r.json.needs_review, ['Amoxicillin: Duration is handwritten.']);

    const b = cap.claudeBody;
    assertEquals(b.model, 'claude-opus-5-5');
    assertEquals(b.fallbacks, 'default');
    assertEquals(b.output_config.effort, 'high');
    assertEquals(b.output_config.format.type, 'json_schema');
    assert(cap.claudeHeaders!.get('anthropic-beta')?.includes('server-side-fallback-2026-07-01'));
    assertEquals(b.messages[0].content[0].type, 'document');
    assertEquals(b.messages[0].content[0].source.media_type, 'application/pdf');
    assert(!('thinking' in b) || b.thinking.type === 'adaptive', 'never disables thinking');

    assertEquals(cap.patches[0].status, 'reading');
    assertEquals(cap.patches.at(-1).status, 'read');
    assertEquals(cap.patches.at(-1).extraction.medicines[0].confidence, 'low');
    assert(!r.logs.includes('Amoxicillin'), 'document content must never be logged');
  } finally {
    await fakes.shutdown();
  }
});

Deno.test('a refusal is stored as a readable failure', async () => {
  const cap: Captured = { patches: [] };
  const fakes = startFakes(cap, () => ({ ...modelReply({}), stop_reason: 'refusal', content: [] }));
  try {
    const r = await runFunction({ document_id: DOC_ID });
    assertEquals(r.status, 422);
    assert(String(r.json.error).includes('enter the details by hand'));
    assertEquals(cap.patches.at(-1).status, 'failed');
  } finally {
    await fakes.shutdown();
  }
});

Deno.test('rejects callers without a valid session and bad input', async () => {
  const cap: Captured = { patches: [] };
  const fakes = startFakes(cap, () => modelReply(EXTRACTION));
  try {
    assertEquals((await runFunction({ document_id: DOC_ID }, 'Bearer wrong')).status, 401);
    assertEquals((await runFunction({ document_id: 'not-a-uuid' })).status, 400);
    assertEquals(cap.claudeBody, undefined, 'Claude must not be called');
  } finally {
    await fakes.shutdown();
  }
});
