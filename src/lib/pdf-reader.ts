/**
 * Reads the text of a PDF on the device: no server, no AI, works offline.
 *
 * pdf.js ships inside the app as two assets (scripts/copy-pdfjs.mjs). In the browser it runs directly;
 * on iPhone and Android it runs inside a hidden WebView (components/pdf-host.tsx), because pdf.js needs
 * browser features that React Native doesn't have.
 */
import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import { Platform } from 'react-native';

import { itemsToLines, type PageLine, type PdfJs, pdfToItems, type RawItem } from '@shared/pdf-text';

import pdfMainAsset from '../../assets/pdfjs/pdf.min.mjs.txt';
import pdfWorkerAsset from '../../assets/pdfjs/pdf.worker.min.mjs.txt';

type Sources = { main: string; worker: string };
let sources: Promise<Sources> | null = null;

/** Loads the bundled pdf.js source once. */
export function loadPdfJsSources(): Promise<Sources> {
  sources ??= (async () => {
    const [main, worker] = await Asset.loadAsync([pdfMainAsset, pdfWorkerAsset]);
    const read = async (a: Asset) =>
      Platform.OS === 'web' ? (await fetch(a.uri)).text() : new File(a.localUri ?? a.uri).text();
    return { main: await read(main), worker: await read(worker) };
  })().catch((e) => {
    sources = null;
    throw e;
  });
  return sources;
}

/* ---------------- browser ---------------- */

// A real dynamic import that the bundler leaves alone, for loading pdf.js from a blob URL.
const importUrl = new Function('u', 'return import(u)') as (u: string) => Promise<unknown>;
let webPdfJs: Promise<PdfJs> | null = null;

function loadWebPdfJs(): Promise<PdfJs> {
  webPdfJs ??= (async () => {
    const { main, worker } = await loadPdfJsSources();
    const url = (src: string) => URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
    // Giving pdf.js its worker module directly makes it run on the main thread: no worker file needed.
    (globalThis as { pdfjsWorker?: unknown }).pdfjsWorker = await importUrl(url(worker));
    return (await importUrl(url(main))) as PdfJs;
  })().catch((e) => {
    webPdfJs = null;
    throw e;
  });
  return webPdfJs;
}

/* ---------------- phone (WebView) ---------------- */

type NativeBridge = (base64: string) => Promise<RawItem[][]>;
let nativeBridge: NativeBridge | null = null;
/** Set by <PdfHost /> once its WebView is ready. */
export function setNativeBridge(b: NativeBridge | null) { nativeBridge = b; }

async function waitForBridge(ms = 15000): Promise<NativeBridge> {
  const start = Date.now();
  while (!nativeBridge) {
    if (Date.now() - start > ms) throw new Error('The PDF reader did not start. Please close and reopen the app.');
    await new Promise((r) => setTimeout(r, 100));
  }
  return nativeBridge;
}

/* ---------------- public ---------------- */

/** Reads a picked PDF (file:// or blob: URI) into lines of text. Returns [] for scans with no text. */
export async function readPdfLines(uri: string): Promise<PageLine[]> {
  if (Platform.OS === 'web') {
    const bytes = new Uint8Array(await (await fetch(uri)).arrayBuffer());
    return itemsToLines(await pdfToItems(await loadWebPdfJs(), bytes));
  }
  const base64 = await new File(uri).base64();
  const bridge = await waitForBridge();
  return itemsToLines(await bridge(base64));
}
