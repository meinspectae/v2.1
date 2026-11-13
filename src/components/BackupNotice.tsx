import { useBackupStatus, retryPhotoBackups, restorePhotos } from '../utils/draftBackup';
import { useInspectionStore } from '../store/inspectionStore';
import { allPhotos } from '../utils/inspectionData';

export default function BackupNotice() {
  const { error, saving } = useBackupStatus();
  const current = useInspectionStore(s => s.currentInspection);
  const pending = current ? allPhotos(current).filter(p => p.backupStatus !== 'backed_up').length : 0;
  return <div role={error ? 'alert' : 'status'} className={`mb-3 rounded-lg px-3 py-2 text-xs ${error || pending ? 'bg-amber-50 text-amber-900 border border-amber-200' : 'bg-slate-50 text-slate-500'}`}>
    {error || (pending ? `${pending} photo(s) not yet backed up. Keep the app open until backup finishes.` : saving ? 'Saving changes…' : 'Draft changes saved on this device. Photos backed up to cloud.')}
    {(!!error || pending > 0) && <button className="ml-2 underline font-semibold" onClick={() => { void retryPhotoBackups(); if (current) { void useInspectionStore.getState().syncCurrentInspection(); void restorePhotos(current.id); } }}>Retry backup</button>}
  </div>;
}
