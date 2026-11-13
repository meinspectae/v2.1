import type { Inspection } from '../types';
import { metadataOnly, normalizeInspection } from './inspectionData';
import { reportLegal } from '../config/reportLegal';

export async function sha256(bytes: BufferSource): Promise<string> {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))).map(b => b.toString(16).padStart(2, '0')).join('');
}
export function canonicalJSON(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJSON).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${canonicalJSON(v)}`).join(',')}}`;
  return JSON.stringify(value) ?? 'null';
}
export async function reportContentHash(inspection: Inspection) {
  const clean = metadataOnly(normalizeInspection(inspection))!;
  // Exclude delivery/payment/sync fields, not observed content. Signed URLs never affect identity.
  const payload = { id: clean.id, createdAt: clean.createdAt, completedAt: clean.completedAt, property: clean.property, tenant: clean.tenant, landlord: clean.landlord, agent: clean.agent, tenancy: clean.tenancy, rooms: clean.rooms, propertyItems: clean.propertyItems, generalNotes: clean.generalNotes, overallPhotos: clean.overallPhotos, signatures: clean.signatures, utilityMeters: clean.utilityMeters, moveInReference: clean.moveInReference, meta: clean.meta, legal: reportLegal };
  const stable = JSON.parse(JSON.stringify(payload, (key, value) => ['backupStatus', 'backupError', 'url'].includes(key) ? undefined : value));
  return sha256(new TextEncoder().encode(canonicalJSON(stable)));
}
export const verificationId = (inspectionId: string, hash: string) => `${inspectionId}-${hash.slice(0, 16)}`;
export const verificationURL = (id: string) => `https://app.meinspect.com/v/${encodeURIComponent(id)}`;
