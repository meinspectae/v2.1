import { PDFDocument, PDFDict, PDFName, PDFRawStream, decodePDFRawStream } from 'pdf-lib';

/** Map contextual Arabic glyphs to their underlying Unicode letters for native PDF search. */
export async function normalizePdfUnicode(bytes: ArrayBuffer): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes);
  for (const [, object] of doc.context.enumerateIndirectObjects()) {
    if (!(object instanceof PDFDict)) continue;
    const reference = object.get(PDFName.of('ToUnicode'));
    if (!reference) continue;
    const stream = doc.context.lookup(reference);
    if (!(stream instanceof PDFRawStream)) continue;
    const original = new TextDecoder().decode(decodePDFRawStream(stream).decode());
    const mapped = original.replace(/(<[0-9a-f]{4}>)<([0-9a-f]{4})>/gi, (match, glyph: string, hex: string) => {
      const code = parseInt(hex, 16);
      if (code < 0xfb50 || code > 0xfefc) return match;
      const unicode = String.fromCharCode(code).normalize('NFKC');
      const output = Array.from(unicode).map(c => c.charCodeAt(0).toString(16).padStart(4, '0')).join('');
      return `${glyph}<${output}>`;
    });
    if (mapped !== original) object.set(PDFName.of('ToUnicode'), doc.context.register(doc.context.flateStream(mapped)));
  }
  return doc.save();
}
