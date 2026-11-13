import { useEffect, useRef, useState } from 'react';
import { capturePhoto, getLocation } from '../utils/helpers';
import { prepareCapturedPhoto } from '../utils/photoEncoding';
import type { Photo } from '../types';

/** Existing cover capture dialog: retain the entire frame in its original orientation. */
export default function PortraitCapture({ onSave, onClose }: { onSave: (photo: Photo) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [live, setLive] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let cancelled = false;
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1600 }, height: { ideal: 1600 } }, audio: false }).then(s => {
      if (cancelled) { s.getTracks().forEach(t => t.stop()); return; }
      stream.current = s;
      if (video.current) { video.current.srcObject = s; void video.current.play(); }
      setLive(true);
    }).catch(() => setLive(false));
    return () => { cancelled = true; stream.current?.getTracks().forEach(t => t.stop()); };
  }, []);
  const capture = async () => {
    setBusy(true);
    try {
      if (live && video.current?.videoWidth) {
        const v = video.current;
        const canvas = document.createElement('canvas'); canvas.width = v.videoWidth; canvas.height = v.videoHeight;
        canvas.getContext('2d')!.drawImage(v, 0, 0);
        const url = await prepareCapturedPhoto(canvas.toDataURL('image/png'), true);
        const location = await getLocation();
        setPhoto({ id: crypto.randomUUID(), url, timestamp: new Date().toISOString(), gpsLat: location?.latitude, gpsLng: location?.longitude });
        canvas.width = canvas.height = 0;
      } else { const p = await capturePhoto(); if (p) setPhoto(p); }
      stream.current?.getTracks().forEach(t => t.stop());
    } catch { setError('Camera could not capture a photo. Please check camera permission and try again.'); }
    finally { setBusy(false); }
  };
  return <div role="dialog" aria-modal="true" aria-label="Cover photo" className="fixed inset-0 z-[100] bg-slate-950/90 overflow-y-auto p-5 flex items-center justify-center">
    <div className="bg-white rounded-2xl p-5 w-full max-w-md space-y-4">
      <h2 className="text-lg font-semibold">{photo ? 'Review cover photo' : 'Capture cover photo'}</h2>
      <p className="text-sm text-slate-500">The complete photo is kept in its original orientation. Nothing is cropped or stretched.</p>
      <div className="relative bg-slate-100 mx-auto overflow-hidden rounded-lg" style={{ width: 'min(100%, 270px)', aspectRatio: '3 / 4' }}>
        {photo ? <img src={photo.url} alt="Cover preview" className="w-full h-full object-contain" /> : <video ref={video} muted playsInline className="w-full h-full object-contain" />}
        {!photo && !live && <span className="absolute inset-0 flex items-center justify-center text-slate-500 text-sm p-8 text-center">Portrait or landscape cover photo</span>}
      </div>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-3"><button disabled={busy} className="flex-1 bg-blue-600 text-white p-3 rounded-xl" onClick={photo ? () => { onSave(photo); onClose(); } : capture}>{busy ? 'Preparing photo…' : photo ? 'Use photo' : 'Take photo'}</button><button className="p-3 rounded-xl border" onClick={onClose}>Cancel</button></div>
    </div>
  </div>;
}
