import { create } from 'zustand';
import { client } from '../api/client';
import type { Inspection, Photo } from '../types';
import { allPhotos, mapPhotos, metadataOnly, normalizeInspection } from './inspectionData';
import { dataUrlToBlob } from './compression';

export const useBackupStatus = create<{ error: string; pending: number; saving: boolean }>(() => ({ error: '', pending: 0, saving: false }));
export const reportSaveError = (error: string) => useBackupStatus.setState({ error });

export function serializeInspection(inspection: Inspection) {
  const clean = metadataOnly(normalizeInspection(inspection))!;
  return { ...clean, extra: { meta: clean.meta, deletedRoomIds: clean.deletedRoomIds, deletedItemIds: clean.deletedItemIds, position: clean.position, pdfSize: clean.pdfSize, utilityMeters: clean.utilityMeters, moveInReference: clean.moveInReference } };
}

export function fromBackend(row: any): Inspection {
  const parse = (v: any, fallback: any) => { if (typeof v === 'string') { try { return JSON.parse(v); } catch { return fallback; } } return v ?? fallback; };
  const extra = parse(row.extra ?? row.extraData, {});
  return normalizeInspection({ ...row, ...extra,
    property: parse(row.property ?? row.propertyData, {}), tenant: parse(row.tenant ?? row.tenantData, {}),
    landlord: parse(row.landlord ?? row.landlordData, {}), agent: parse(row.agent ?? row.agentData, undefined),
    tenancy: parse(row.tenancy ?? row.tenancyData, {}), rooms: parse(row.rooms ?? row.roomsData, []),
    propertyItems: parse(row.propertyItems, []), overallPhotos: parse(row.overallPhotos, []), signatures: parse(row.signatures, []),
    payment: parse(row.payment ?? row.paymentData, {}), meta: extra.meta || row.meta || { inspectorName: 'Inspector', inspectorId: '', deviceInfo: '', appVersion: '1.0.0' },
  });
}

// One chain per inspection: stale writes can never overtake newer edits or a completed photo backup.
const chains = new Map<string, Promise<boolean>>();
export function saveInspection(inspection: Inspection): Promise<boolean> {
  const payload = serializeInspection(inspection);
  const promise = (chains.get(inspection.id) || Promise.resolve(true)).then(async () => {
    if (discarded.has(inspection.id)) return false;
    try {
      useBackupStatus.setState({ saving: true });
      let res = await client.api.fetch(`/api/inspections/${inspection.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(20000) });
      if (res.status === 404) res = await client.api.fetch('/api/inspections', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(20000) });
      if (!res.ok) throw new Error(`Cloud save failed (${res.status}).`);
      useBackupStatus.setState({ error: '', saving: false });
      return true;
    } catch (e) {
      useBackupStatus.setState({ error: `${e instanceof Error ? e.message : 'Cloud save failed.'} Your local notes are kept. Reconnect to retry.`, saving: false });
      return false;
    }
  });
  chains.set(inspection.id, promise);
  promise.finally(() => { if (chains.get(inspection.id) === promise) chains.delete(inspection.id); });
  return promise;
}

interface QueueEntry { inspectionId: string; photo: Photo; roomId: string; itemId: string }
const queue = new Map<string, QueueEntry>();
const discarded = new Set<string>();
let busy = false;
let readInspection: (id: string) => Inspection | undefined;
let updateInspection: (id: string, fn: (i: Inspection) => Inspection) => void;
export function configureBackup(read: typeof readInspection, update: typeof updateInspection) { readInspection = read; updateInspection = update; }

export function queuePhoto(inspectionId: string, photo: Photo, roomId: string, itemId: string) {
  queue.set(photo.id, { inspectionId, photo, roomId, itemId });
  useBackupStatus.setState({ pending: queue.size });
  void retryPhotoBackups();
}

export async function retryPhotoBackups() {
  if (busy || !navigator.onLine) return;
  busy = true;
  try {
    for (const [id, entry] of queue) {
      const { inspectionId, photo, roomId, itemId } = entry;
      const inspection = readInspection(inspectionId);
      if (discarded.has(inspectionId) || !inspection || !allPhotos(inspection).some(p => p.id === id)) { queue.delete(id); continue; }
      const patch = (changes: Partial<Photo>) => updateInspection(inspectionId, i => mapPhotos(i, p => p.id === id ? { ...p, ...changes } : p));
      patch({ backupStatus: 'uploading', backupError: undefined });
      try {
        if (!await saveInspection(readInspection(inspectionId)!)) throw new Error('Inspection could not be backed up.');
        const res = await client.api.fetch('/api/upload/photo', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ inspectionId, photoId: id, roomId, itemId, contentType: 'image/jpeg', metadata: { ...photo, url: '' } }), signal: AbortSignal.timeout(20000) });
        if (!res.ok) throw new Error(`Photo upload could not start (${res.status}).`);
        const { uploadUrl, path } = await res.json();
        // Persist the recoverable path before PUT; server recovery checks storage after a crash.
        patch({ cloudPath: path });
        // Save the path before transferring bytes, so even older backends can recover after a crash.
        if (!await saveInspection(readInspection(inspectionId)!)) throw new Error('Photo reference could not be saved.');
        const uploaded = await fetch(uploadUrl, { method: 'PUT', body: dataUrlToBlob(photo.url), headers: { 'Content-Type': 'image/jpeg' }, signal: AbortSignal.timeout(60000) });
        if (!uploaded.ok) throw new Error(`Photo upload failed (${uploaded.status}).`);
        const confirmed = await client.api.fetch(`/api/inspections/${inspectionId}/photos/${id}/confirm`, { method: 'POST', signal: AbortSignal.timeout(20000) });
        if (!confirmed.ok) {
          // Compatibility with an existing backend while the manifest routes await deployment.
          if (confirmed.status !== 404) throw new Error('Photo uploaded but backup confirmation failed.');
          const check = await client.api.fetch(`/api/download/photo?path=${encodeURIComponent(path)}`);
          if (!check.ok) throw new Error('Photo backup could not be verified.');
          const { downloadUrl } = await check.json();
          const stored = await fetch(downloadUrl);
          await stored.body?.cancel();
          if (!stored.ok) throw new Error('Photo backup could not be verified.');
        }
        // Release large in-memory data URLs once cloud storage is confirmed.
        // The renewable URL is display-only and is stripped from local metadata.
        const download = await client.api.fetch(`/api/download/photo?path=${encodeURIComponent(path)}`);
        const display = download.ok ? await download.json() : {};
        patch({ cloudPath: path, backupStatus: 'backed_up', backupError: undefined, ...(display.downloadUrl ? { url: display.downloadUrl } : {}) });
        queue.delete(id);
        const latest = readInspection(inspectionId);
        if (latest) await saveInspection(latest);
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Photo backup failed.';
        patch({ backupStatus: 'error', backupError: message });
        reportSaveError(`${message} Not yet backed up — keep the app open. Retrying automatically.`);
      }
    }
  } finally { busy = false; useBackupStatus.setState({ pending: queue.size }); }
}

const restoring = new Set<string>();
export async function restorePhotos(id: string) {
  if (restoring.has(id) || !navigator.onLine) return;
  restoring.add(id);
  try {
    const res = await client.api.fetch(`/api/inspections/${id}/photos`);
    let photos: any[] = [];
    if (res.ok) ({ photos } = await res.json());
    else if (res.status === 404) {
      // Existing singular download endpoint remains supported for previously saved reports.
      const current = readInspection(id);
      if (!current) return;
      for (const photo of allPhotos(current)) {
        if (!photo.cloudPath) continue;
        const response = await client.api.fetch(`/api/download/photo?path=${encodeURIComponent(photo.cloudPath)}`);
        if (!response.ok) throw new Error('Could not restore cloud photos. Reconnect and retry.');
        const { downloadUrl } = await response.json();
        const exists = await fetch(downloadUrl);
        await exists.body?.cancel();
        if (exists.ok) photos.push({ id: photo.id, cloudPath: photo.cloudPath, metadata: photo, downloadUrl });
      }
    } else throw new Error('Could not restore cloud photos. Reconnect and retry.');
    updateInspection(id, inspection => {
      let next = inspection;
      for (const record of photos || []) {
        const photo = { ...record.metadata, id: record.id, cloudPath: record.cloudPath, url: record.downloadUrl, backupStatus: 'backed_up' as const };
        if (allPhotos(next).some(p => p.id === photo.id)) next = mapPhotos(next, p => p.id === photo.id ? { ...p, ...photo } : p);
        // Never re-add an absent photo: a local deletion may not have reached the server yet.
        // Recovery is by manifest ID; the pending placeholder was saved before the binary upload.
      }
      return next;
    });
    const restored = readInspection(id);
    if (!restored) return;
    const missing = allPhotos(restored).filter(p => !p.url);
    if (missing.length) reportSaveError(`${missing.length} photo(s) could not be restored. Reconnect and retry. Photos never uploaded before the app closed cannot be recovered and must be recaptured or removed.`);
  } catch (e) { reportSaveError(e instanceof Error ? e.message : 'Photo restoration failed.'); }
  finally { restoring.delete(id); }
}

export function discardBackup(id: string) {
  discarded.add(id);
  for (const [key, entry] of queue) if (entry.inspectionId === id) queue.delete(key);
  useBackupStatus.setState({ pending: queue.size });
  // Finish outstanding writes before deleting, so a late write cannot recreate a discarded draft.
  return (chains.get(id) || Promise.resolve()).then(async () => {
    const res = await client.api.fetch(`/api/inspections/${id}`, { method: 'DELETE' });
    if (!res.ok && res.status !== 404) throw new Error('Draft deletion is not yet backed up. Reconnect to retry.');
  });
}
