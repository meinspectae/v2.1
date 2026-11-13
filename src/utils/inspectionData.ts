import type { Inspection, InspectionItem, Photo, Room } from '../types';

export const itemKey = (name: string) => (name || '').trim().toLowerCase().replace(/\s+/g, ' ');
export const isDeleted = (value: any) => !!(value?.deleted || value?.deletedAt || value?.isDeleted || value?.status === 'deleted');
export const isRated = (item: InspectionItem) => ['very_good', 'good', 'fair', 'poor'].includes(item.condition || '');

/** Merge evidence, not just rows. Conflicting ratings retain their history and use the worst visible condition. */
export function mergeChecklistItems(items: InspectionItem[]): InspectionItem[] {
  const result: InspectionItem[] = [];
  for (const item of items || []) {
    if (!item || isDeleted(item)) continue;
    const existing = result.find(i => (item.id && i.id === item.id) || (itemKey(item.name) && itemKey(i.name) === itemKey(item.name)));
    if (!existing) { result.push({ ...item, photos: [...(item.photos || [])] }); continue; }
    const ratings = [...new Set([...(existing.ratingHistory || []), existing.condition, ...(item.ratingHistory || []), item.condition].filter(Boolean))] as NonNullable<InspectionItem['condition']>[];
    const severity = ['very_good', 'good', 'fair', 'poor'];
    existing.condition = ratings.sort((a, b) => severity.indexOf(b) - severity.indexOf(a))[0] || null;
    if (ratings.length > 1) existing.ratingHistory = ratings;
    existing.comments = [...new Set([existing.comments, item.comments].filter(s => s?.trim()))].join('\n');
    const photos = new Map(existing.photos.map(p => [p.id, p]));
    for (const p of item.photos || []) photos.set(p.id, { ...photos.get(p.id), ...p, url: p.url || photos.get(p.id)?.url || '', cloudPath: p.cloudPath || photos.get(p.id)?.cloudPath });
    existing.photos = [...photos.values()];
    existing.checked = existing.checked || item.checked;
    existing.mergedIds = [...new Set([...(existing.mergedIds || []), item.id, ...(item.mergedIds || [])].filter(Boolean))];
  }
  return result;
}

export function finalRooms(inspection: Pick<Inspection, 'rooms' | 'deletedRoomIds' | 'deletedItemIds'>): Room[] {
  return (inspection.rooms || []).filter(r => !isDeleted(r) && !inspection.deletedRoomIds?.includes(r.id)).map(r => ({
    ...r,
    items: mergeChecklistItems((r.items || []).filter(i => !inspection.deletedItemIds?.includes(`${r.id}:${i.id}`))),
  }));
}

export function normalizeInspection<T extends Inspection>(inspection: T): T {
  return { ...inspection, rooms: finalRooms(inspection) };
}

export function inspectionSummary(inspection: Inspection) {
  const rooms = finalRooms(inspection);
  const items = rooms.flatMap(r => r.items);
  const good = items.filter(i => i.condition === 'good' || i.condition === 'very_good').length;
  const fair = items.filter(i => i.condition === 'fair').length;
  const issues = items.filter(i => i.condition === 'poor').length;
  return { rooms: rooms.length, total: items.length, rated: good + fair + issues, good, fair, issues,
    findings: rooms.flatMap(room => room.items.filter(i => i.condition === 'fair' || i.condition === 'poor').map(item => ({ room, item }))),
    photos: reportPhotos({ ...inspection, rooms }).length,
    excludedPhotos: allPhotos({ ...inspection, rooms }).filter(photo => photo.includeInReport === false).length };
}

export function allPhotos(inspection: Inspection): Photo[] {
  return [...Object.values(inspection.utilityMeters || {}).flatMap(m => m.photo ? [m.photo] : []), ...(inspection.overallPhotos || []), ...(inspection.propertyItems || []).flatMap(i => i.photos || []),
    ...(inspection.rooms || []).flatMap(r => r.items.flatMap(i => i.photos || []))];
}

/** The single source of truth for photos intentionally included in a report. */
export function reportPhotos(inspection: Inspection): Photo[] {
  return allPhotos(inspection).filter(photo => photo.includeInReport !== false && !!photo.url);
}

export function earliestPhotoTimestamp(inspection: Inspection): string | undefined {
  return allPhotos(inspection)
    .map(photo => photo.timestamp)
    .filter(timestamp => timestamp && Number.isFinite(Date.parse(timestamp)))
    .sort((a, b) => Date.parse(a) - Date.parse(b))[0];
}

export function earliestReportPhoto(inspection: Inspection): Photo | undefined {
  return reportPhotos(inspection).sort((a, b) => {
    const at = Date.parse(a.timestamp || '') || Number.MAX_SAFE_INTEGER;
    const bt = Date.parse(b.timestamp || '') || Number.MAX_SAFE_INTEGER;
    return at - bt;
  })[0];
}

export function mapPhotos(inspection: Inspection, transform: (photo: Photo) => Photo): Inspection {
  return { ...inspection,
    utilityMeters: Object.fromEntries(Object.entries(inspection.utilityMeters || {}).map(([key, m]) => [key, { ...m, photo: m.photo ? transform(m.photo) : undefined }])),
    overallPhotos: (inspection.overallPhotos || []).map(transform),
    propertyItems: (inspection.propertyItems || []).map(i => ({ ...i, photos: (i.photos || []).map(transform) })),
    rooms: inspection.rooms.map(r => ({ ...r, items: r.items.map(i => ({ ...i, photos: (i.photos || []).map(transform) })) })),
  };
}

/** No photo bytes or expiring signed URLs are persisted. Signatures remain small inline records. */
export function metadataOnly(inspection: Inspection | null): Inspection | null {
  if (!inspection) return null;
  return mapPhotos(inspection, p => ({ ...p, url: '', backupStatus: p.cloudPath && p.backupStatus === 'backed_up' ? 'backed_up' : 'pending' }));
}
