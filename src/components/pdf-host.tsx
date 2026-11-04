/**
 * Hidden WebView that runs pdf.js on iPhone and Android, so PDFs are read on the device.
 * Mounted once in the root layout. Renders nothing on web (the browser runs pdf.js directly).
 */
import { type ComponentType, type Ref, useEffect, useRef } from 'react';
import { Platform, View } from 'react-native';
import { WebView, type WebViewMessageEvent, type WebViewProps } from 'react-native-webview';

import type { RawItem } from '@shared/pdf-text';
import { loadPdfJsSources, setNativeBridge } from '@/lib/pdf-reader';

// Runs inside the WebView. Mirrors pdfToItems() in supabase/functions/_shared/pdf-text.ts.
const PAGE = `<!doctype html><html><head><meta charset="utf-8"></head><body><script>
var pdf = null;
function send(o) { window.ReactNativeWebView.postMessage(JSON.stringify(o)); }
function blobUrl(src) { return URL.createObjectURL(new Blob([src], { type: 'text/javascript' })); }
async function init(main, worker) {
  globalThis.pdfjsWorker = await import(blobUrl(worker));
  pdf = await import(blobUrl(main));
  send({ type: 'ready' });
}
async function extract(id, b64) {
  try {
    var bin = atob(b64), bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    var task = pdf.getDocument({ data: bytes, isEvalSupported: false, useSystemFonts: true, disableFontFace: true, verbosity: 0 });
    var doc = await task.promise, pages = [];
    for (var p = 1; p <= Math.min(doc.numPages, 30); p++) {
      var content = await (await doc.getPage(p)).getTextContent();
      pages.push(content.items.filter(function (it) { return it.str && it.str.trim() && it.transform; })
        .map(function (it) { return { s: it.str, x: it.transform[4], y: it.transform[5], w: it.width || 0 }; }));
    }
    await task.destroy();
    send({ type: 'result', id: id, pages: pages });
  } catch (e) {
    send({ type: 'error', id: id, message: String((e && e.message) || e) });
  }
}
function onMessage(ev) {
  var m; try { m = JSON.parse(ev.data); } catch (e) { return; }
  if (m.type === 'init') init(m.main, m.worker).catch(function (e) { send({ type: 'fatal', message: String((e && e.message) || e) }); });
  if (m.type === 'extract') extract(m.id, m.b64);
}
window.addEventListener('message', onMessage);
document.addEventListener('message', onMessage);
send({ type: 'loaded' });
</script></body></html>`;

type Pending = { resolve: (p: RawItem[][]) => void; reject: (e: Error) => void };
type WebViewHandle = { postMessage: (message: string) => void };
// The package types WebView without its ref; it does forward one with postMessage().
const HostWebView = WebView as unknown as ComponentType<WebViewProps & { ref?: Ref<WebViewHandle> }>;

export function PdfHost() {
  const ref = useRef<WebViewHandle>(null);
  const pending = useRef(new Map<number, Pending>());
  const seq = useRef(0);

  useEffect(() => () => setNativeBridge(null), []);

  if (Platform.OS === 'web') return null;

  const onMessage = async (e: WebViewMessageEvent) => {
    let m: { type: string; id?: number; pages?: RawItem[][]; message?: string };
    try { m = JSON.parse(e.nativeEvent.data); } catch { return; }
    if (m.type === 'loaded') {
      const { main, worker } = await loadPdfJsSources();
      ref.current?.postMessage(JSON.stringify({ type: 'init', main, worker }));
    } else if (m.type === 'ready') {
      setNativeBridge((b64) => new Promise((resolve, reject) => {
        const id = ++seq.current;
        pending.current.set(id, { resolve, reject });
        ref.current?.postMessage(JSON.stringify({ type: 'extract', id, b64 }));
        setTimeout(() => {
          if (pending.current.delete(id)) reject(new Error('Reading the PDF took too long. Try a smaller file.'));
        }, 60000);
      }));
    } else if (m.type === 'result' || m.type === 'error') {
      const p = pending.current.get(m.id!);
      pending.current.delete(m.id!);
      if (m.type === 'result') p?.resolve(m.pages ?? []);
      else p?.reject(new Error('This PDF could not be opened. It may be damaged or password-protected.'));
    } else if (m.type === 'fatal') {
      console.warn('PDF reader failed to start:', m.message);
    }
  };

  return (
    <View pointerEvents="none" style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }}>
      <HostWebView
        ref={ref}
        source={{ html: PAGE, baseUrl: 'https://homekonnect.local/' }}
        originWhitelist={['*']}
        javaScriptEnabled
        onMessage={onMessage}
      />
    </View>
  );
}
