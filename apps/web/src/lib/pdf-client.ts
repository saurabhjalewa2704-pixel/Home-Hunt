// Turns a listing PDF (a saved listing page or an agent's brochure) into the same inputs the screenshot
// reader takes: a few page images plus the text printed in the file. It runs in the browser, so a large
// PDF never has to fit inside the server's request-size limit; only compressed page images are uploaded.

export const MAX_PDF_BYTES = 40_000_000;
/** Pages sent to Claude. A brochure's price, photo and key facts are at the front; tenure and charges often at the back. */
export const MAX_PDF_PAGES = 6;
const MAX_TEXT_CHARS = 12_000;
const PAGE_WIDTH = 1400;

export class PdfError extends Error {}

export interface PdfPages {
  /** JPEG page images, in page order. */
  pages: Blob[];
  /** 1-based page numbers that `pages` came from. */
  pageNumbers: number[];
  pageCount: number;
  /** The text printed in the PDF, for accuracy; empty for a scanned PDF. */
  text: string;
}

export const isPdf = (f: { type: string; name: string }) => f.type === "application/pdf" || /\.pdf$/i.test(f.name);

/** Which pages to use: all of a short PDF, otherwise the first five and the last. */
export function pickPages(pageCount: number, max = MAX_PDF_PAGES): number[] {
  if (max < 2) return [1];
  const all = Array.from({ length: pageCount }, (_, i) => i + 1);
  if (pageCount <= max) return all;
  return [...all.slice(0, max - 1), pageCount];
}

export async function renderPdf(file: File, maxPages = MAX_PDF_PAGES): Promise<PdfPages> {
  if (file.size > MAX_PDF_BYTES) throw new PdfError("That PDF is larger than 40 MB. Try saving a smaller copy, or paste screenshots of the main pages.");
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url).toString();

  let doc: Awaited<ReturnType<typeof pdfjs.getDocument>["promise"]>;
  try {
    doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  } catch (e) {
    const name = (e as { name?: string })?.name;
    if (name === "PasswordException") throw new PdfError("That PDF is password-protected. Open it, save an unlocked copy, and try again.");
    throw new PdfError("We couldn't open that PDF. Check it isn't damaged, or paste screenshots of the listing instead.");
  }

  try {
    const pageNumbers = pickPages(doc.numPages, maxPages);
    const pages: Blob[] = [];
    for (const n of pageNumbers) {
      const page = await doc.getPage(n);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: Math.min(3, PAGE_WIDTH / base.width) });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new PdfError("This browser can't draw the PDF pages.");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport, canvas }).promise;
      const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.85));
      canvas.width = canvas.height = 0;
      if (!blob) throw new PdfError("We couldn't turn a PDF page into a picture.");
      pages.push(blob);
    }

    // Text of the pages that are sent, which helps Claude read small print exactly.
    let text = "";
    for (const n of pageNumbers) {
      if (text.length >= MAX_TEXT_CHARS) break;
      const tc = await (await doc.getPage(n)).getTextContent();
      text += `--- page ${n} ---\n` + tc.items.map((it) => ("str" in it ? it.str + (it.hasEOL ? "\n" : " ") : "")).join("").replace(/[ \t]+/g, " ").trim() + "\n";
    }
    return { pages, pageNumbers, pageCount: doc.numPages, text: text.slice(0, MAX_TEXT_CHARS) };
  } finally {
    void doc.destroy();
  }
}
