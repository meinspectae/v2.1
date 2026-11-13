import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { client } from '../api/client';
import { sha256 } from '../utils/reportVerification';

export default function VerifyReportPage() {
  const { id = '' } = useParams();
  const [hash, setHash] = useState('');
  const [message, setMessage] = useState('');
  const [verified, setVerified] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  async function verify(kind: 'pdf' | 'content', file?: File) {
    setBusy(true); setVerified(null); setMessage('');
    try {
      let value = hash.trim().toLowerCase();
      if (kind === 'pdf') {
        if (!file || file.size > 40 * 1024 * 1024 || !new TextDecoder().decode(await file.slice(0, 5).arrayBuffer()).startsWith('%PDF-')) throw new Error('Choose a PDF up to 40 MB.');
        value = await sha256(await file.arrayBuffer());
      }
      if (!/^[a-f0-9]{64}$/.test(value)) throw new Error('Enter the complete 64-character content hash from the last page.');
      const res = await client.api.fetch(`/api/public/verify/${encodeURIComponent(id)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hash: value, kind }) });
      if (!res.ok) throw new Error('Verification is unavailable. Please try again when connected.');
      const result = await res.json();
      setVerified(result.verified === true);
      setMessage(result.verified ? (kind === 'pdf' ? 'The PDF exactly matches the final file registered for this report.' : 'This content hash matches the registered report record. Select the PDF to check the file itself.') : 'No matching registered report was found. Check the report ID and file or hash.');
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Verification failed. Please retry.'); }
    finally { setBusy(false); }
  }
  return <main className="min-h-screen bg-slate-50 px-5 py-12"><section className="max-w-xl mx-auto bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 space-y-6">
    <div className="text-blue-600 font-bold">MeInspect</div><h1 className="text-2xl font-bold text-slate-800">Verify a report</h1>
    <p className="text-sm break-all text-slate-600">Report ID: {id}</p>
    <p className="text-sm text-slate-600">The printed hash identifies report content; selecting a PDF checks its final-file hash against the server’s registered copy.</p>
    <label className="block text-sm font-medium">Select the report PDF<input type="file" accept="application/pdf,.pdf" disabled={busy} className="block mt-2 w-full border rounded-lg p-3" onChange={e => { void verify('pdf', e.target.files?.[0]); e.target.value = ''; }} /></label>
    <p className="text-xs text-slate-500">Your PDF stays on your device. Only its fingerprint is sent for comparison.</p>
    <form className="space-y-3" onSubmit={e => { e.preventDefault(); void verify('content'); }}><label className="block text-sm font-medium">Or paste the full printed content hash<input className="block mt-2 border rounded-lg p-3 w-full font-mono text-xs" value={hash} onChange={e => { setHash(e.target.value); setVerified(null); setMessage(''); }} placeholder="64-character SHA-256 hash" /></label><button disabled={busy} className="rounded-lg bg-blue-600 text-white px-5 py-3 text-sm disabled:opacity-50">{busy ? 'Checking…' : 'Verify hash'}</button></form>
    {(message || verified !== null) && <div role="status" className={`rounded-xl p-4 text-sm ${verified ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900'}`}><strong className="block mb-2">{verified === true ? 'Verified' : verified === false ? 'Not verified' : 'Unable to verify'}</strong>{message}</div>}
  </section></main>;
}
