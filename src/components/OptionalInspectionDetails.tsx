import { useState } from 'react';
import { useInspectionStore } from '../store/inspectionStore';
import { capturePhoto } from '../utils/helpers';
import { client } from '../api/client';
import { saveInspection } from '../utils/draftBackup';

export const meterLabels: Record<string, string> = { electricity: 'Electricity', water: 'Water', gasCooling: 'Gas / cooling' };
const fieldClass = 'w-full mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm';

export function UtilityMeters() {
  const { currentInspection: inspection, updateOptionalDetails, setMeterPhoto } = useInspectionStore();
  const [error, setError] = useState('');
  if (!inspection) return null;
  return <section className="space-y-4 mt-6">
    <h2 className="text-lg font-semibold">Utility meters <span className="text-sm font-normal text-slate-500">Optional</span></h2>
    <p className="text-sm text-slate-500">Add any readings or meter photos you need. Empty meters will not appear in the report.</p>
    {Object.entries(meterLabels).map(([key, label]) => {
      const meter = inspection.utilityMeters?.[key];
      return <div key={key} className="border border-slate-200 rounded-xl p-4 space-y-3">
        <label className="block text-sm font-medium">{label} reading<input className={fieldClass} value={meter?.reading || ''} placeholder="Reading and unit, e.g. 1250 kWh" onChange={e => updateOptionalDetails({ utilityMeters: { ...inspection.utilityMeters, [key]: { ...meter, reading: e.target.value } } })} /></label>
        <button type="button" className="text-sm text-blue-600" onClick={async () => { try { setError(''); const photo = await capturePhoto(); if (photo) setMeterPhoto(key, photo); } catch { setError('Could not capture the meter photo. Please try again.'); } }}>{meter?.photo ? 'Replace meter photo' : 'Add meter photo'}</button>
        {meter?.photo && <div className="flex items-center gap-3">{meter.photo.url && <img src={meter.photo.url} alt={`${label} meter`} className="w-28 h-24 object-contain" />}<span className="text-xs text-slate-500">{meter.photo.backupStatus === 'backed_up' ? 'Backed up' : 'Not yet backed up — keep the app open'}</span><button className="text-sm text-red-600" onClick={() => setMeterPhoto(key)}>Remove photo</button></div>}
      </div>;
    })}{error && <p role="alert" className="text-red-600 text-sm">{error}</p>}
  </section>;
}

export function MoveInReference() {
  const { currentInspection: inspection, updateOptionalDetails } = useInspectionStore();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  if (!inspection) return null;
  const reference = inspection.moveInReference || {};
  const change = (key: string, value: string) => updateOptionalDetails({ moveInReference: { ...reference, [key]: value } });
  async function upload(file?: File) {
    if (!file || !inspection) return;
    setError(''); setUploading(true);
    try {
      if (file.size > 40 * 1024 * 1024 || !file.name.toLowerCase().endsWith('.pdf') || !new TextDecoder().decode(await file.slice(0, 5).arrayBuffer()).startsWith('%PDF-')) throw new Error('Choose a valid PDF under 40 MB.');
      if (!await saveInspection(inspection)) throw new Error('Connect to save the inspection before attaching a report.');
      const response = await client.api.fetch(`/api/inspections/${inspection.id}/reference/upload`, { method: 'POST' });
      if (!response.ok) throw new Error('Could not start the upload. Please reconnect and retry.');
      const { path, uploadUrl } = await response.json();
      const uploaded = await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': 'application/pdf' } });
      if (!uploaded.ok) throw new Error('The PDF was not backed up. Please retry.');
      // Use latest values: editing baseline fields during upload must not lose changes.
      const latest = useInspectionStore.getState().currentInspection;
      if (latest?.id === inspection.id) updateOptionalDetails({ moveInReference: { ...latest.moveInReference, attachment: { path, name: file.name } } });
    } catch (e) { setError(e instanceof Error ? e.message : 'Upload failed. Please retry.'); }
    finally { setUploading(false); }
  }
  return <section className="space-y-5">
    <h2 className="text-lg font-semibold">Move-in reference <span className="text-sm font-normal text-slate-500">Optional</span></h2>
    <p className="text-sm text-slate-500">Attach a previous report or enter a baseline. You can skip this entire step. An attachment is retained as a reference; its contents are not automatically interpreted.</p>
    <label className="block text-sm font-medium">Previous move-in report (PDF)<input type="file" accept="application/pdf,.pdf" disabled={uploading} className={fieldClass} onChange={e => { void upload(e.target.files?.[0]); e.target.value = ''; }} /></label>
    {uploading && <p role="status" className="text-sm text-blue-600">Uploading reference — keep the app open…</p>}
    {reference.attachment && <div className="text-sm flex gap-4"><span>{reference.attachment.name}</span><button className="text-blue-600" onClick={async () => { const tab = window.open('', '_blank'); try { if (!await saveInspection(inspection)) throw new Error('Save the reference before opening it.'); const response = await client.api.fetch(`/api/inspections/${inspection.id}/reference`); if (!response.ok) throw new Error('The reference could not be opened. Reconnect and retry.'); const { downloadUrl } = await response.json(); if (tab) tab.location.href = downloadUrl; } catch (e) { tab?.close(); setError(e instanceof Error ? e.message : 'Could not open reference.'); } }}>Open PDF</button><button className="text-red-600" onClick={() => updateOptionalDetails({ moveInReference: { ...reference, attachment: undefined } })}>Remove attachment</button></div>}
    {error && <p role="alert" className="text-red-600 text-sm">{error} You may still skip this step.</p>}
    <div className="grid sm:grid-cols-2 gap-4">{[['keys', 'Number of keys at move-in'], ['cards', 'Number of access cards at move-in']].map(([key, label]) => <label key={key} className="block text-sm font-medium">{label}<input type="number" min="0" step="1" className={fieldClass} value={reference[key as 'keys' | 'cards'] || ''} onChange={e => change(key, e.target.value.replace(/[^0-9]/g, ''))} /></label>)}</div>
    <label className="block text-sm font-medium">Known pre-existing defects<textarea className={fieldClass} rows={4} value={reference.defects || ''} onChange={e => change('defects', e.target.value)} placeholder="Describe defects already present at move-in" /></label>
    <label className="block text-sm font-medium">New defects identified now<textarea className={fieldClass} rows={4} value={reference.newDefects || ''} onChange={e => change('newDefects', e.target.value)} placeholder="Optional — explicitly distinguish new defects from the baseline" /></label>
  </section>;
}
