/**
 * Pulls the text layer out of a PDF, rebuilt into lines in reading order.
 * The pdf.js module is passed in, because Node and Deno import it differently.
 * Scanned PDFs (images only) have no text layer and return no lines.
 */

export type PageLine = { text: string; page: number };

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

type Item = { str: string; x: number; y: number; w: number };

const MAX_PAGES = 30;

export async function pdfToLines(pdfjs: PdfJs, bytes: Uint8Array): Promise<PageLine[]> {
  // pdf.js may detach the buffer it is given, so pass a copy.
  const task = pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false, useSystemFonts: true, disableFontFace: true, verbosity: 0 });
  const doc = await task.promise;
  const out: PageLine[] = [];
  try {
    for (let p = 1; p <= Math.min(doc.numPages, MAX_PAGES); p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      const items: Item[] = content.items.flatMap((raw) => {
        const it = raw as { str?: string; transform?: number[]; width?: number };
        return typeof it.str === 'string' && it.str.trim() && it.transform
          ? [{ str: it.str, x: it.transform[4], y: it.transform[5], w: it.width ?? 0 }]
          : [];
      });
      // Group into rows (same baseline within 3 units), top to bottom, then left to right.
      items.sort((a, b) => (Math.abs(b.y - a.y) > 3 ? b.y - a.y : a.x - b.x));
      let row: Item[] = [];
      const flush = () => {
        if (!row.length) return;
        row.sort((a, b) => a.x - b.x);
        let text = '';
        let end = -Infinity;
        for (const it of row) {
          const gap = it.x - end;
          // A wide gap means a new column: keep it visible as several spaces.
          text += text ? (gap > 12 ? '    ' : gap > 1 ? ' ' : '') : '';
          text += it.str;
          end = it.x + it.w;
        }
        out.push({ text: text.replace(/[ \t]+$/g, ''), page: p });
        row = [];
      };
      for (const it of items) {
        if (row.length && Math.abs(row[0].y - it.y) > 3) flush();
        row.push(it);
      }
      flush();
    }
  } finally {
    await task.destroy();
  }
  return out;
}

/** Plain text (one line per row) for pasting or debugging. */
export const linesToText = (lines: PageLine[]) => lines.map((l) => l.text).join('\n');
