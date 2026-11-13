import encode, { init } from '@jsquash/jpeg/encode';
import wasmURL from '@jsquash/jpeg/codec/enc/mozjpeg_enc.wasm?url';
let ready: Promise<void> | undefined;

function loadAndValidateImage(source: string, label: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      image.onload = null;
      image.onerror = null;
      if (error) reject(error);
      else if (!image.naturalWidth || !image.naturalHeight) reject(new Error(`${label} has no image dimensions.`));
      else resolve(image);
    };
    image.onload = () => finish();
    image.onerror = () => finish(new Error(`${label} cannot be decoded.`));
    image.src = source;
    // decode() catches truncated output early. Some older Android WebViews reject
    // decode() for otherwise loadable images, so onload remains the compatibility
    // fallback while an actual decode/load failure still rejects.
    if (typeof image.decode === 'function') {
      void image.decode().then(() => finish()).catch(() => {
        if (image.naturalWidth && image.naturalHeight) finish();
        else if (image.complete) finish(new Error(`${label} cannot be decoded.`));
      });
    }
  });
}

/** Explicit MozJPEG YCbCr 4:2:0 rather than browser-dependent canvas encoder defaults. */
export async function encodePhoto(canvas: HTMLCanvasElement, quality = 0.8): Promise<string> {
  ready ||= init({ locateFile: () => wasmURL });
  await ready;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Photo encoder could not access the image canvas.');
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  const bytes = new Uint8Array(await encode(pixels, { quality: Math.round(quality * 100), auto_subsample: false, chroma_subsample: 2, progressive: false }));
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[bytes.length - 2] !== 0xff || bytes[bytes.length - 1] !== 0xd9) {
    throw new Error('Photo encoder returned an incomplete JPEG.');
  }
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return `data:image/jpeg;base64,${btoa(binary)}`;
}

/** Decode applies EXIF orientation; contain the complete frame with no crop or distortion. */
export async function prepareCapturedPhoto(source: string, cover = false): Promise<string> {
  const image = await loadAndValidateImage(source, 'Captured photo');
  const portrait = image.naturalWidth <= image.naturalHeight;
  const long = cover ? 1600 : 1200, short = cover ? 1200 : 900;
  const canvas = document.createElement('canvas');
  canvas.width = portrait ? short : long; canvas.height = portrait ? long : short;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Photo processing canvas is unavailable.');
  context.fillStyle = '#f1f5f9'; context.fillRect(0, 0, canvas.width, canvas.height);
  const scale = Math.min(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight);
  const w = image.naturalWidth * scale, h = image.naturalHeight * scale;
  context.drawImage(image, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
  try {
    let lastError: unknown;
    for (const quality of [0.8, 0.7]) {
      try {
        const encoded = await encodePhoto(canvas, quality);
        await loadAndValidateImage(encoded, 'Encoded photo');
        return encoded;
      } catch (error) {
        lastError = error;
        console.warn(`[Photo encoding] JPEG validation failed at ${Math.round(quality * 100)}% quality; retrying if possible.`, error);
      }
    }
    throw lastError instanceof Error ? lastError : new Error('Encoded photo validation failed.');
  } finally {
    canvas.width = canvas.height = 0;
  }
}
