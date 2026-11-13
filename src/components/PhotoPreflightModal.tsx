import type { PhotoDiagnostic } from '../utils/photoPreflight';

export default function PhotoPreflightModal({ failures, busy, onRetry, onRetake, onContinue, onClose }: {
  failures: PhotoDiagnostic[];
  busy: boolean;
  onRetry: () => void;
  onRetake: (failure: PhotoDiagnostic) => void;
  onContinue: () => void;
  onClose: () => void;
}) {
  if (!failures.length) return null;
  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4" role="dialog" aria-modal="true" aria-labelledby="photo-preflight-title">
    <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl">
      <div className="border-b border-slate-200 p-5">
        <div className="flex items-start justify-between gap-4">
          <div><h2 id="photo-preflight-title" className="text-lg font-bold text-slate-900">{failures.length} photos could not be loaded</h2><p className="mt-1 text-sm text-slate-600">Payment has not started. Retry, retake the affected item, or explicitly continue without these photos.</p></div>
          <button type="button" onClick={onClose} aria-label="Close" className="min-h-11 min-w-11 rounded-lg text-xl text-slate-500">×</button>
        </div>
      </div>
      <div className="space-y-3 p-5">
        {failures.map(failure => <div key={failure.photoId} className="rounded-xl border border-amber-200 bg-amber-50 p-3">
          <div className="font-semibold text-slate-900">{failure.itemName}</div>
          <div className="text-sm text-slate-600">{failure.roomName} · {failure.captureTime ? new Date(failure.captureTime).toLocaleString('en-AE') : 'Capture time unavailable'}</div>
          <div className="mt-1 text-xs text-amber-800">{failure.error || 'No readable copy is available.'}</div>
          <button type="button" onClick={() => onRetake(failure)} className="mt-3 min-h-11 rounded-lg border border-amber-300 bg-white px-4 text-sm font-semibold text-amber-900">Retake photo</button>
        </div>)}
      </div>
      <div className="sticky bottom-0 flex flex-col gap-2 border-t border-slate-200 bg-white p-5 sm:flex-row">
        <button type="button" disabled={busy} onClick={onRetry} className="min-h-11 flex-1 rounded-xl bg-blue-600 px-4 font-semibold text-white disabled:opacity-50">{busy ? 'Checking photos…' : 'Retry'}</button>
        <button type="button" disabled={busy} onClick={onContinue} className="min-h-11 flex-1 rounded-xl border border-slate-300 px-4 font-semibold text-slate-700 disabled:opacity-50">Continue without these photos</button>
      </div>
    </div>
  </div>;
}
