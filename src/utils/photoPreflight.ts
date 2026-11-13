import type { Inspection, Photo } from '../types';
import { client } from '../api/client';
import { allPhotos, mapPhotos } from './inspectionData';

export interface PhotoDiagnostic {
  photoId: string;
  roomName: string;
  itemName: string;
  roomId?: string;
  itemId?: string;
  captureTime: string;
  storage: 'cloud' | 'device' | 'cloud + device' | 'missing';
  uploadStatus: string;
  url: string;
  httpStatus: number | null;
  contentType: string;
  byteSize: number;
  decodeResult: 'decoded' | 'failed';
  loadedFrom: 'cloud' | 'device' | 'none';
  error?: string;
}

export interface PhotoPreflightResult {
  inspection: Inspection;
  diagnostics: PhotoDiagnostic[];
  failed: PhotoDiagnostic[];
}

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function labelsFor(inspection: Inspection) {
  const labels = new Map<string, { roomName: string; itemName: string; roomId?: string; itemId?: string }>();
  for (const photo of inspection.overallPhotos || []) labels.set(photo.id, { roomName: 'Property', itemName: 'Overall photo' });
  for (const item of inspection.propertyItems || []) for (const photo of item.photos || []) labels.set(photo.id, { roomName: 'Property', itemName: item.name, itemId: item.id });
  for (const [name, meter] of Object.entries(inspection.utilityMeters || {})) if (meter.photo) labels.set(meter.photo.id, { roomName: 'Utility Meters', itemName: name, itemId: name });
  for (const room of inspection.rooms || []) for (const item of room.items || []) for (const photo of item.photos || []) labels.set(photo.id, { roomName: room.name, itemName: item.name, roomId: room.id, itemId: item.id });
  return labels;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error || new Error('Photo bytes could not be read.'));
    reader.readAsDataURL(blob);
  });
}

/** Uses load/error events because Android WebView can reject decode() before a valid image load completes. */
export function loadImageElement(url: string, timeoutMs = 30000): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    if (/^https?:/i.test(url)) image.crossOrigin = 'anonymous';
    const timer = window.setTimeout(() => finish(new Error('Image load timed out.')), timeoutMs);
    const finish = (error?: Error) => {
      window.clearTimeout(timer);
      image.onload = null;
      image.onerror = null;
      if (error) reject(error); else resolve(image);
    };
    image.onload = () => image.naturalWidth > 0 && image.naturalHeight > 0 ? finish() : finish(new Error('Image has no dimensions.'));
    image.onerror = () => finish(new Error('Browser could not decode the image bytes.'));
    image.src = url;
  });
}

async function fetchPhoto(url: string) {
  const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(30000) });
  const contentType = response.headers.get('content-type') || '';
  if (!response.ok) throw Object.assign(new Error(`HTTP ${response.status}`), { status: response.status, contentType });
  const blob = await response.blob();
  if (!blob.size) throw Object.assign(new Error('Photo is empty.'), { status: response.status, contentType });
  const type = contentType || blob.type;
  if (!type.toLowerCase().startsWith('image/')) throw Object.assign(new Error(`Unexpected content type: ${type || 'unknown'}`), { status: response.status, contentType: type });
  const dataUrl = await blobToDataUrl(blob);
  await loadImageElement(dataUrl);
  return { dataUrl, blob, status: response.status, contentType: type };
}

async function renewUrl(path: string) {
  const response = await client.api.fetch(`/api/download/photo?path=${encodeURIComponent(path)}`);
  if (!response.ok) throw Object.assign(new Error(`Signed URL refresh failed (${response.status}).`), { status: response.status });
  const body = await response.json();
  if (!body.downloadUrl) throw new Error('Signed URL refresh returned no URL.');
  return String(body.downloadUrl);
}

/** Loads every included photo, cloud first then the device copy, up to three attempts each. */
export async function runPhotoPreflight(inspection: Inspection): Promise<PhotoPreflightResult> {
  const labels = labelsFor(inspection);
  let hydrated = inspection;
  const diagnostics: PhotoDiagnostic[] = [];
  for (const photo of allPhotos(inspection).filter(p => p.includeInReport !== false)) {
    const label = labels.get(photo.id) || { roomName: 'Inspection', itemName: photo.caption || 'Photo' };
    const deviceUrl = /^(data|blob|file|capacitor):/i.test(photo.url || '') ? photo.url : '';
    let url = photo.url || '';
    let status: number | null = null;
    let contentType = '';
    let byteSize = 0;
    let error = '';
    let dataUrl = '';
    let loadedFrom: PhotoDiagnostic['loadedFrom'] = 'none';

    if (photo.cloudPath && navigator.onLine) {
      for (let attempt = 1; attempt <= 3 && !dataUrl; attempt++) {
        try {
          url = await renewUrl(photo.cloudPath);
          const result = await fetchPhoto(url);
          ({ dataUrl, status, contentType } = result); byteSize = result.blob.size; loadedFrom = 'cloud';
        } catch (reason: any) {
          status = reason?.status ?? null; contentType = reason?.contentType || ''; error = reason instanceof Error ? reason.message : 'Cloud load failed.';
          if (attempt < 3) await wait(250 * attempt);
        }
      }
    }
    if (!dataUrl && deviceUrl) {
      for (let attempt = 1; attempt <= 3 && !dataUrl; attempt++) {
        try {
          url = deviceUrl;
          const result = await fetchPhoto(deviceUrl);
          ({ dataUrl, status, contentType } = result); byteSize = result.blob.size; loadedFrom = 'device';
        } catch (reason: any) {
          status = reason?.status ?? null; contentType = reason?.contentType || ''; error = reason instanceof Error ? reason.message : 'Device copy failed.';
          if (attempt < 3) await wait(100 * attempt);
        }
      }
    }
    if (dataUrl) hydrated = mapPhotos(hydrated, candidate => candidate.id === photo.id ? { ...candidate, url: dataUrl } : candidate);
    diagnostics.push({
      photoId: photo.id, roomName: label.roomName, itemName: label.itemName, roomId: label.roomId, itemId: label.itemId, captureTime: photo.timestamp,
      storage: photo.cloudPath && deviceUrl ? 'cloud + device' : photo.cloudPath ? 'cloud' : deviceUrl ? 'device' : 'missing',
      uploadStatus: photo.backupStatus || (photo.cloudPath ? 'backed_up' : 'not uploaded'), url, httpStatus: status,
      contentType, byteSize, decodeResult: dataUrl ? 'decoded' : 'failed', loadedFrom,
      ...(dataUrl ? {} : { error: error || 'No readable cloud or device copy is available.' }),
    });
  }
  console.groupCollapsed(`[Photo pre-flight] ${inspection.id}: ${diagnostics.length} photos`);
  console.table(diagnostics);
  console.groupEnd();
  return { inspection: hydrated, diagnostics, failed: diagnostics.filter(item => item.decodeResult === 'failed') };
}

export function excludePhotos(inspection: Inspection, photoIds: string[]) {
  const excluded = new Set(photoIds);
  return mapPhotos(inspection, photo => excluded.has(photo.id) ? { ...photo, includeInReport: false } : photo);
}
