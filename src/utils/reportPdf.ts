import { jsPDF } from 'jspdf';
import { normalizePdfUnicode } from './pdfUnicode';

export const MAX_PDF_BYTES = 40 * 1024 * 1024;
const MM = 25.4 / 96;
const WIDTH = 180 / MM;
const BODY_HEIGHT = 245 / MM;
const BODY_TOP = 27;

export function loadReportImage(url: string, timeoutMs = 30000): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    if (/^https?:/i.test(url)) image.crossOrigin = 'anonymous';
    const timer = window.setTimeout(() => finish(new Error('Report image load timed out.')), timeoutMs);
    const finish = (error?: Error) => {
      window.clearTimeout(timer); image.onload = null; image.onerror = null;
      if (error) reject(error); else resolve(image);
    };
    image.onload = () => image.naturalWidth && image.naturalHeight ? finish() : finish(new Error('Report image has no dimensions.'));
    image.onerror = () => finish(new Error('Report image could not be decoded.'));
    image.src = url;
  });
}

const sourceForLog = (source: string) => source.startsWith('data:') ? `${source.slice(0, 32)}… (${source.length} chars)` : source.slice(0, 240);

function markImageUnavailable(root: HTMLElement, source: string, error: unknown) {
  const elements = Array.from(root.querySelectorAll<HTMLElement>('[data-evidence], [data-signature], img')).filter(element =>
    element.dataset.evidence === source ||
    element.dataset.signature === source ||
    (element instanceof HTMLImageElement && element.src === source)
  );
  const photoIds = elements.map(element => element.dataset.photoId).filter(Boolean);
  console.error('[Report PDF] Image unavailable; continuing with placeholder.', {
    photoIds: photoIds.length ? photoIds : ['unknown'],
    source: sourceForLog(source),
    error: error instanceof Error ? error.message : String(error),
  });

  for (const element of elements) {
    if (element instanceof HTMLImageElement) {
      element.removeAttribute('src');
      element.alt = 'Photo unavailable';
    }
    delete element.dataset.evidence;
    delete element.dataset.signature;
    element.style.backgroundImage = 'none';
    element.style.display = 'flex';
    element.style.alignItems = 'center';
    element.style.justifyContent = 'center';
    element.style.minHeight = element.style.minHeight || '42px';
    element.style.padding = '8px';
    element.style.boxSizing = 'border-box';
    element.style.color = '#64748b';
    element.style.fontSize = '10px';
    element.style.fontWeight = '600';
    element.style.textAlign = 'center';
    element.textContent = 'Photo unavailable';
  }
}
const bytes64 = (bytes: Uint8Array) => {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(binary);
};
let fontPromise: Promise<Array<{ name: string; family: string; style: string; data: string }>> | undefined;
const fonts = () => fontPromise ||= Promise.all([
  ['Inter-Regular.ttf', 'Inter', 'normal'], ['Inter-Bold.ttf', 'Inter', 'bold'], ['Inter-Italic.ttf', 'Inter', 'italic'],
  ['NotoNaskhArabic-Report.ttf', 'NotoNaskhArabic', 'normal'],
].map(async ([name, family, style]) => {
  const response = await fetch(`/fonts/${name}`);
  if (!response.ok) throw new Error('Report font could not be loaded. Reconnect and retry.');
  return { name, family, style, data: bytes64(new Uint8Array(await response.arrayBuffer())) };
}));

/** Report-only layout, measured at its real A4 size, independent of the mobile preview scale. */
export async function prepareReportLayout(source: HTMLElement) {
  await document.fonts.ready;
  const host = document.createElement('div');
  host.style.cssText = `position:absolute;left:-12000px;top:0;width:${WIDTH}px;background:white;pointer-events:none;`;
  const clone = source.cloneNode(true) as HTMLElement;
  clone.removeAttribute('id'); clone.style.cssText = `width:${WIDTH}px;background:white;font-family:Inter,sans-serif;`;
  host.append(clone); document.body.append(host);
  try {
    for (const image of Array.from(clone.querySelectorAll<HTMLImageElement>('img'))) {
      try {
        await loadReportImage(image.src);
      } catch (error) {
        markImageUnavailable(clone, image.src, error);
      }
    }
    // Only layout boxes change: original evidence pixels are untouched. A damaged
    // photo is isolated to its own frame instead of aborting the whole report.
    for (const el of Array.from(clone.querySelectorAll<HTMLElement>('[data-evidence]'))) {
      const source = el.dataset.evidence!;
      try {
        const img = await loadReportImage(source);
        const kind = el.dataset.photoKind;
        if (!kind || kind === 'standard') {
          el.style.width = `${(img.naturalWidth > img.naturalHeight ? 79 : 50) / MM}px`;
          el.style.height = `${(img.naturalWidth > img.naturalHeight ? 59 : 66) / MM}px`;
          if (el.parentElement?.hasAttribute('data-photo-wrap')) el.parentElement.style.width = el.style.width;
        }
      } catch (error) {
        markImageUnavailable(clone, source, error);
      }
    }
    // Explicit physical photo rows, packed left-to-right; each row is indivisible.
    for (const flow of Array.from(clone.querySelectorAll<HTMLElement>('[data-photo-flow]'))) {
      const children = Array.from(flow.children) as HTMLElement[];
      const width = flow.getBoundingClientRect().width;
      flow.replaceChildren(); let used = 0; let row: HTMLElement | undefined;
      for (const child of children) {
        const w = parseFloat(child.style.width) || child.getBoundingClientRect().width;
        if (!row || used + 3 / MM + w > width + 0.5) {
          row = document.createElement('div'); row.dataset.pdfKeep = ''; row.dataset.photoRow = '';
          row.style.cssText = `display:flex;align-items:flex-start;gap:${3 / MM}px;margin-top:${3 / MM}px;`;
          flow.append(row); used = 0;
        }
        row.append(child); used += (used ? 3 / MM : 0) + w;
      }
    }
    // A card taller than a physical page becomes explicit continuation cards, never sliced.
    for (const block of Array.from(clone.querySelectorAll<HTMLElement>('[data-item-card]'))) {
      const capacity = BODY_HEIGHT - 60;
      if (block.getBoundingClientRect().height <= capacity) continue;
      const content = block.querySelector<HTMLElement>('[data-card-content]');
      const flow = content?.querySelector<HTMLElement>('[data-photo-flow]');
      if (!content || !flow) continue;
      const rows = Array.from(flow.children) as HTMLElement[];
      const heading = content.querySelector<HTMLElement>('[data-card-heading]');
      let fragment = block.cloneNode(true) as HTMLElement;
      fragment.querySelector('[data-photo-flow]')!.replaceChildren();
      block.before(fragment);
      let target = fragment.querySelector<HTMLElement>('[data-photo-flow]')!;
      for (const row of rows) {
        target.append(row);
        if (fragment.getBoundingClientRect().height > capacity && target.children.length > 1) {
          row.remove();
          fragment = block.cloneNode(false) as HTMLElement;
          const c = content.cloneNode(false) as HTMLElement;
          if (heading) c.append(heading.cloneNode(true));
          const continuation = document.createElement('p'); continuation.textContent = 'Photos continued'; continuation.style.cssText = 'font-size:9px;color:#64748b;'; c.append(continuation);
          target = flow.cloneNode(false) as HTMLElement; c.append(target); fragment.append(c); block.before(fragment); target.append(row);
        }
      }
      block.remove();
    }
    // Standalone extra-photo collections paginate by full rows as well.
    for (const block of Array.from(clone.querySelectorAll<HTMLElement>('[data-report-block]'))) {
      if (block.getBoundingClientRect().height <= BODY_HEIGHT || block.hasAttribute('data-item-card')) continue;
      const flow = block.querySelector<HTMLElement>('[data-photo-flow]');
      if (flow && block.children.length === 1) {
        for (const row of Array.from(flow.children)) { const part = block.cloneNode(false) as HTMLElement; part.append(row); block.before(part); }
        block.remove();
      }
    }
    return { host, clone };
  } catch (error) { host.remove(); throw error; }
}

const color = (css: string): [number, number, number] => {
  const m = css.match(/[\d.]+/g); return m ? [Number(m[0]), Number(m[1]), Number(m[2])] : [30, 41, 59];
};
const visibleColor = (css: string) => css !== 'transparent' && !/rgba\([^)]*,\s*0\s*\)/.test(css);

/** Vector drawing + real font-backed text + independent image objects. Never screenshots. */
async function paint(pdf: jsPDF, root: HTMLElement, x: number, y: number, images: Map<string, { data: string; image: HTMLImageElement; format: string }>) {
  const origin = root.getBoundingClientRect();
  const elements = [root, ...Array.from(root.querySelectorAll<HTMLElement>('*'))];
  for (const element of elements) {
    const s = getComputedStyle(element), r = element.getBoundingClientRect();
    if (s.display === 'none' || !r.width || !r.height) continue;
    const px = x + (r.left - origin.left) * MM, py = y + (r.top - origin.top) * MM;
    const w = r.width * MM, h = r.height * MM;
    const radius = Math.min(parseFloat(s.borderTopLeftRadius) * MM || 0, w / 2, h / 2);
    if (visibleColor(s.backgroundColor)) {
      pdf.setFillColor(...color(s.backgroundColor)); pdf.roundedRect(px, py, w, h, radius, radius, 'F');
    }
    const bw = parseFloat(s.borderTopWidth);
    if (bw && visibleColor(s.borderTopColor)) {
      pdf.setDrawColor(...color(s.borderTopColor)); pdf.setLineWidth(bw * MM);
      if (parseFloat(s.borderRightWidth) && parseFloat(s.borderBottomWidth)) pdf.roundedRect(px, py, w, h, radius, radius, 'S');
      else pdf.line(px, py, px + w, py);
    }
    if (parseFloat(s.borderBottomWidth) && !bw) {
      pdf.setDrawColor(...color(s.borderBottomColor)); pdf.setLineWidth(parseFloat(s.borderBottomWidth) * MM); pdf.line(px, py + h, px + w, py + h);
    }
    if (parseFloat(s.borderLeftWidth) > 1) {
      pdf.setFillColor(...color(s.borderLeftColor)); pdf.rect(px, py, parseFloat(s.borderLeftWidth) * MM, h, 'F');
    }
    const src = element.dataset.evidence || (element instanceof HTMLImageElement ? element.src : '') || element.dataset.signature;
    if (src) {
      const cached = images.get(src)!;
      const inset = element.dataset.evidence ? 0.25 : 0;
      const cover = element.dataset.photoKind === 'cover';
      const scale = cover
        ? Math.max((w - inset * 2) / cached.image.naturalWidth, (h - inset * 2) / cached.image.naturalHeight)
        : Math.min((w - inset * 2) / cached.image.naturalWidth, (h - inset * 2) / cached.image.naturalHeight);
      const iw = cached.image.naturalWidth * scale, ih = cached.image.naturalHeight * scale;
      if (cover) {
        // Cover is a true 3:4 portrait crop. Clip before drawing so no pixels
        // escape the frame and the left column is never half blank.
        pdf.saveGraphicsState();
        // Build the crop boundary without painting it. The previous default
        // rectangle style emitted `S`, which consumed the path before `W` and
        // left page-one text trapped behind an empty clipping region.
        pdf.rect(px, py, w, h, null);
        pdf.clip();
        pdf.discardPath();
      }
      pdf.addImage(cached.data, cached.format, px + (w - iw) / 2, py + (h - ih) / 2, iw, ih, src, 'NONE');
      if (cover) pdf.restoreGraphicsState();
    }
    if (element instanceof HTMLAnchorElement && /^https:\/\//.test(element.href)) pdf.link(px, py, w, h, { url: element.href });
  }
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  while ((node = walker.nextNode())) {
    if (!node.textContent?.trim() || !node.parentElement) continue;
    const element = node.parentElement, s = getComputedStyle(element);
    if (s.display === 'none' || s.visibility === 'hidden') continue;
    const text = node.textContent;
    // Browser ranges provide wrapping/bidi line positions, never a raster text layer.
    const range = document.createRange();
    const lines: Array<{ text: string; left: number; right: number; top: number; height: number }> = [];
    for (let i = 0; i < text.length; i++) {
      range.setStart(node, i); range.setEnd(node, i + 1);
      const r = range.getBoundingClientRect(); if (!r.height) continue;
      let line = lines[lines.length - 1];
      if (!line || Math.abs(line.top - r.top) > 2) { line = { text: '', left: r.left, right: r.right, top: r.top, height: r.height }; lines.push(line); }
      line.text += text[i]; line.left = Math.min(line.left, r.left); line.right = Math.max(line.right, r.right);
    }
    for (const line of lines) {
      // Decorative emoji in the existing header/footer are not report text. Keep the
      // full ID/date/GPS/IP even when the embedded brand font has no emoji glyph.
      const value = line.text.replace(/\p{Extended_Pictographic}\uFE0F?/gu, '').trim(); if (!value) continue;
      const arabic = /[\u0600-\u06ff]/.test(value);
      const bold = Number(s.fontWeight) >= 600 || s.fontWeight === 'bold';
      pdf.setFont(arabic ? 'NotoNaskhArabic' : 'Inter', arabic ? 'normal' : s.fontStyle === 'italic' ? 'italic' : bold ? 'bold' : 'normal');
      const size = parseFloat(s.fontSize) * 0.75;
      pdf.setFontSize(size); pdf.setTextColor(...color(s.color));
      const rtl = s.direction === 'rtl';
      const tx = x + ((rtl ? line.right : line.left) - origin.left) * MM;
      const ty = y + (line.top - origin.top) * MM;
      // jsPDF shapes Arabic before its Unicode bidi pass. Keep source in logical order.
      pdf.text(value, tx, ty, { align: rtl ? 'right' : 'left', baseline: 'top', isInputVisual: false, isInputRtl: rtl, isOutputVisual: true, isOutputRtl: false, isSymmetricSwapping: true });
    }
  }
}

export async function renderReportPDF(source: HTMLElement, onProgress: (message: string) => void): Promise<Blob> {
  const loadedFonts = await fonts();
  const { host, clone } = await prepareReportLayout(source);
  try {
    const sources = new Set(Array.from(clone.querySelectorAll<HTMLElement>('[data-evidence], img, [data-signature]')).map(el => el.dataset.evidence || el.dataset.signature || (el as HTMLImageElement).src).filter(Boolean));
    const originals = new Map<string, { data: string; image: HTMLImageElement; format: string }>();
    for (const src of sources) {
      try {
        const image = await loadReportImage(src);
        const response = await fetch(src);
        if (!response.ok) throw new Error(`Image request failed with HTTP ${response.status}.`);
        const blob = await response.blob();
        if (!blob.size) throw new Error('Image response was empty.');
        const jpeg = blob.type === 'image/jpeg' || /^data:image\/jpeg/.test(src);
        let data: string;
        if (jpeg) data = `data:image/jpeg;base64,${bytes64(new Uint8Array(await blob.arrayBuffer()))}`;
        else {
          const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
          canvas.getContext('2d')!.drawImage(image, 0, 0);
          const evidence = Array.from(clone.querySelectorAll<HTMLElement>('[data-evidence]')).some(el => el.dataset.evidence === src);
          data = canvas.toDataURL(evidence ? 'image/jpeg' : 'image/png', 0.8); canvas.width = canvas.height = 0;
        }
        originals.set(src, { data, image, format: data.startsWith('data:image/jpeg') ? 'JPEG' : 'PNG' });
      } catch (error) {
        markImageUnavailable(clone, src, error);
      }
    }
    // Quality falls in exact .05 increments; dimensions only change after all quality passes.
    for (let pass = 0; ; pass++) {
      const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true, putOnlyUsedFonts: true });
      for (const font of loadedFonts) { pdf.addFileToVFS(font.name, font.data); pdf.addFont(font.name, font.family, font.style); }
      const images = new Map(originals);
      if (pass) {
        const quality = Math.max(0.2, 0.8 - pass * 0.05);
        const dimensionScale = pass <= 12 ? 1 : Math.pow(0.85, pass - 12);
        onProgress(`Optimising report photos at ${Math.round(quality * 100)}% quality…`);
        for (const [src, original] of originals) {
          if (original.format !== 'JPEG') continue;
          const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(original.image.naturalWidth * dimensionScale)); canvas.height = Math.max(1, Math.round(original.image.naturalHeight * dimensionScale));
          canvas.getContext('2d')!.drawImage(original.image, 0, 0, canvas.width, canvas.height);
          images.set(src, { ...original, data: canvas.toDataURL('image/jpeg', quality) }); canvas.width = canvas.height = 0;
        }
      }
      const header = clone.querySelector<HTMLElement>('[data-report-header]');
      const footer = clone.querySelector<HTMLElement>('[data-pdf-footer]');
      let page = 1, cursor = 0;
      const newPage = () => { if (cursor > 0) { pdf.addPage(); page++; cursor = 0; } };
      const blocks = Array.from(clone.querySelectorAll<HTMLElement>('[data-report-block]')).filter(el => !el.parentElement?.closest('[data-report-block]'));
      const repeatTableHeading = async (table: string) => {
        const title = clone.querySelector<HTMLElement>(`[data-table-title="${table}"] [data-report-block]`);
        const tableHeader = clone.querySelector<HTMLElement>(`[data-table-header="${table}"]`);
        for (const repeated of [title, tableHeader]) {
          if (!repeated) continue;
          const height = repeated.getBoundingClientRect().height;
          await paint(pdf, repeated, 15, BODY_TOP + cursor * MM, images);
          cursor += height;
        }
      };
      for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i];
        if (block.dataset.pageStart !== undefined) newPage();
        const h = block.getBoundingClientRect().height;
        let need = h;
        if (block.dataset.keepNext !== undefined && blocks[i + 1]) need += Math.min(blocks[i + 1].getBoundingClientRect().height, BODY_HEIGHT);
        const table = block.dataset.tableRow;
        const next = blocks[i + 1];
        // Do not strand one table row at the foot of a page when another row
        // follows. Continuation pages get the blue title and column header.
        if (table && next?.dataset.tableRow === table) need = Math.max(need, h + next.getBoundingClientRect().height);
        if (cursor + need > BODY_HEIGHT && cursor) {
          newPage();
          if (table) await repeatTableHeading(table);
        }
        if (h > BODY_HEIGHT) {
          // Oversized cards are continued only between whole photo rows/text blocks.
          const parts = Array.from(block.children) as HTMLElement[];
          for (const part of parts) {
            const ph = part.getBoundingClientRect().height;
            if (cursor + ph > BODY_HEIGHT && cursor) newPage();
            await paint(pdf, part, 15 + (part.getBoundingClientRect().left - block.getBoundingClientRect().left) * MM, BODY_TOP + cursor * MM, images);
            cursor += ph + 2 / MM;
          }
        } else {
          await paint(pdf, block, 15, BODY_TOP + cursor * MM, images); cursor += h;
        }
        onProgress(`Preparing report block ${i + 1} of ${blocks.length}…`);
      }
      const count = pdf.getNumberOfPages();
      for (let n = 1; n <= count; n++) {
        pdf.setPage(n);
        if (header) await paint(pdf, header, 15, 15, images);
        if (footer) await paint(pdf, footer, 15, 275, images);
        pdf.setFont('Inter', 'normal'); pdf.setFontSize(7); pdf.setTextColor(100, 116, 139);
        pdf.text(`Page ${n} of ${count}`, 195, 282, { align: 'right' });
      }
      const bytes = await normalizePdfUnicode(pdf.output('arraybuffer'));
      const blob = new Blob([bytes], { type: 'application/pdf' });
      if (blob.size <= MAX_PDF_BYTES) return blob;
      if (pass > 30) throw new Error('This report could not fit within 40 MB. All inspection evidence remains unchanged.');
    }
  } finally { host.remove(); }
}
