/**
 * Pulls the text layer out of a PDF, rebuilt into lines in reading order.
 * The pdf.js module is passed in, because Node, Deno, the browser and the app's WebView load it differently.
 * Scanned PDFs (images only) have no text layer and return no lines.
 */

export type PageLine = { text: string; page: number };
/** One text run as pdf.js reports it: string, x, y, width. */
export type RawItem = { s: string; x: number; y: number; w: number };

/** The small part of pdf.js used here. */
export type PdfJs = {
  getDocument: (src: { data: Uint8Array; isEvalSupported?: boolean; useSystemFonts?: boolean; disableFontFace?: boolean; verbosity?: number }) => {
    promise: Promise<{
      numPages: number;
      getPage: (n: number) => Promise<{ getTextContent: () => Promise<{ items: unknown[] }> }>;
    }>;
    destroy: () => Promise<void>;
  };
};

export const MAX_PAGES = 30;

/** Reads the raw text runs of every page. Kept small so it can also run inside a WebView. */
export async function pdfToItems(pdfjs: PdfJs, bytes: Uint8Array): Promise<RawItem[][]> {
  // pdf.js may detach the buffer it is given, so pass a copy.
  const task = pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false, useSystemFonts: true, disableFontFace: true, verbosity: 0 });
  const doc = await task.promise;
  const pages: RawItem[][] = [];
  try {
    for (let p = 1; p <= Math.min(doc.numPages, MAX_PAGES); p++) {
      const content = await (await doc.getPage(p)).getTextContent();
      pages.push(content.items.flatMap((raw) => {
        const it = raw as { str?: string; transform?: number[]; width?: number };
        return typeof it.str === 'string' && it.str.trim() && it.transform
          ? [{ s: it.str, x: it.transform[4], y: it.transform[5], w: it.width ?? 0 }]
          : [];
      }));
    }
  } finally {
    await task.destroy();
  }
  return pages;
}

/** Groups text runs into rows (same baseline within 3 units), top to bottom, left to right. */
export function itemsToLines(pages: RawItem[][]): PageLine[] {
  const out: PageLine[] = [];
  pages.forEach((page, i) => {
    const items = [...page].sort((a, b) => (Math.abs(b.y - a.y) > 3 ? b.y - a.y : a.x - b.x));
    let row: RawItem[] = [];
    const flush = () => {
      if (!row.length) return;
      row.sort((a, b) => a.x - b.x);
      let text = '';
      let end = -Infinity;
      for (const it of row) {
        const gap = it.x - end;
        // A wide gap means a new column: keep it visible as several spaces.
        text += text ? (gap > 12 ? '    ' : gap > 1 ? ' ' : '') : '';
        text += it.s;
        end = it.x + it.w;
      }
      out.push({ text: text.replace(/[ \t]+$/g, ''), page: i + 1 });
      row = [];
    };
    for (const it of items) {
      if (row.length && Math.abs(row[0].y - it.y) > 3) flush();
      row.push(it);
    }
    flush();
  });
  return out;
}

export async function pdfToLines(pdfjs: PdfJs, bytes: Uint8Array): Promise<PageLine[]> {
  return itemsToLines(await pdfToItems(pdfjs, bytes));
}

/** Plain text (one line per row) for pasting or debugging. */
export const linesToText = (lines: PageLine[]) => lines.map((l) => l.text).join('\n');
