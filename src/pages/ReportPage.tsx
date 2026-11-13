import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReportDocument from '../components/ReportDocument';
import { reportContentHash, verificationId, verificationURL } from '../utils/reportVerification';
import { ReportDisclaimer, ReportDeclaration, ReportOptionalSections } from '../components/ReportQualitySections';
import QRCode from 'qrcode';
import { normalizeInspection, inspectionSummary, allPhotos } from '../utils/inspectionData';
import { fromBackend, restorePhotos, saveInspection, retryPhotoBackups } from '../utils/draftBackup';
import BackupNotice from '../components/BackupNotice';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { useInspectionStore } from '../store/inspectionStore';
import { useAuthStore } from '../store/authStore';
import { client } from '../api/client';
import { reconcileReportPayment } from '../utils/paymentRecovery';
import PaymentModal from '../components/PaymentModal';
import EmailReportModal from '../components/EmailReportModal';
import PhotoPreflightModal from '../components/PhotoPreflightModal';
import { excludePhotos, runPhotoPreflight, type PhotoDiagnostic } from '../utils/photoPreflight';
import {
  identifyReport,
  hasPurchasedReport,
  purchaseReport,
  isRevenueCatPlatform,
} from '../utils/revenuecat';
import {
  formatDate,
  formatDateTime,
  safeGoBack,
  notifyPaymentSuccess,
} from '../utils/helpers';
import {
  getPropertyTypeLabel,
  getConditionLabel,
  getConditionColor,
} from '../data/propertyTemplates';

// A4 Page dimensions at 96 DPI
const A4_WIDTH_PX = 794;
const A4_PAGE_HEIGHT = 1040;
const A4_CONTENT_HEIGHT = 960;

// ============================================
// Page Header — appears on every page
// ============================================
export function PageHeader({ inspection, reportHash }: { inspection: any; reportHash: string }) {
  const shortHash = reportHash ? reportHash.slice(0, 16) : '—';
  return (
    <div data-report-header style={{
      borderBottom: '1.5px solid #2563eb',
      padding: '6px 30px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      background: '#ffffff',
      fontSize: '8px',
      color: '#64748b',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <img src="/meinspect-logo.png" alt="MeInspect" style={{ width: '18px', height: '18px', objectFit: 'contain', borderRadius: '4px', display: 'block' }} />
        <span style={{ fontWeight: '700', color: '#1e293b', fontSize: '9px' }}>MeInspect</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ fontFamily: 'monospace', fontWeight: '600' }}>
          🔖 RPT-{inspection.id.slice(0, 8).toUpperCase()}
        </span>
        <span style={{ fontFamily: 'monospace', fontSize: '7.5px', color: '#94a3b8' }}>
          ⏱ Generated: {formatDateTime(inspection.completedAt || inspection.updatedAt || new Date().toISOString())}
        </span>
        {reportHash && (
          <span style={{ fontFamily: 'monospace', fontSize: '6.5px', color: '#94a3b8' }}>
            🔒 {shortHash}…
          </span>
        )}
      </div>
    </div>
  );
}

// ============================================
// Page Footer — appears on every page
// ============================================
export function PageFooter({ inspection, pageNumber, totalPages }: { inspection: any; pageNumber: number; totalPages?: number }) {
  const location = inspection.meta.location;
  const gpsCoords = location && typeof location.latitude === 'number' && typeof location.longitude === 'number'
    ? `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`
    : null;
    
  return (
    <div data-pdf-footer style={{
      borderTop: '1px solid #e2e8f0',
      padding: '5px 30px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      fontSize: '7.5px',
      color: '#94a3b8',
      background: '#f8fafc',
      marginTop: 'auto',
      flexShrink: 0,
    }}>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        <span>📍 GPS: {gpsCoords || 'Not Available'}</span>
        <span>🌐 IP: {inspection.meta.ipAddress || 'Not Available'}</span>
      </div>
      <div style={{ fontWeight: '600' }}>
        MeInspect · Property condition record
      </div>
    </div>
  );
}

// ============================================
// Main Report Page Component
// ============================================
export default function ReportPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getInspection } = useInspectionStore();
  const printRef = useRef<HTMLDivElement>(null);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [reportHash, setReportHash] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [totalPages, setTotalPages] = useState(0);
  const [reportScale, setReportScale] = useState(1);
  const [reportHeight, setReportHeight] = useState<number | null>(null);
  const [photoFailures, setPhotoFailures] = useState<PhotoDiagnostic[]>([]);
  const [photoCheckBusy, setPhotoCheckBusy] = useState(false);
  const [pendingAction, setPendingAction] = useState<'download' | 'email' | 'print'>('download');

  // iOS native in-app purchase state (RevenueCat). Web/Android are untouched
  // and continue to use the Stripe PaymentModal flow below.
  const isIOSNative = Capacitor.getPlatform() === 'ios';
  const [iapState, setIapState] = useState<'idle' | 'checking' | 'purchasing' | 'confirming' | 'error'>('idle');
  const [iapError, setIapError] = useState('');
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { user } = useAuthStore();
  const { setCurrentInspection } = useInspectionStore();
  const localInspection = id ? getInspection(id) : useInspectionStore.getState().currentInspection;
  // FIX (payment history / completed reports re-paywalling bug): "View Report"
  // from PaymentHistoryPage only has an inspection ID (no full local object),
  // and even from History/Completed lists the on-device copy of an inspection
  // paid for on a different device may simply not exist in local storage yet.
  // Previously that made `inspection` undefined -> the page rendered
  // "Inspection not found" and any retry funneled the user back into a
  // purchase flow. Now: if there's an `id` but nothing locally, fetch the
  // authoritative record straight from the backend (source of truth for
  // paymentData) and adopt it as the current inspection before falling back
  // to any "not found" state.
  const [fetchedInspection, setFetchedInspectionState] = useState<any | null>(null);
  const [fetchingInspection, setFetchingInspection] = useState(false);
  const rawInspection = localInspection || fetchedInspection;
  const inspection = useMemo(() => rawInspection ? normalizeInspection(rawInspection) : null, [rawInspection]);
  const [pdfSize, setPdfSize] = useState<number | null>(null);
  useEffect(() => { if (rawInspection?.id) void restorePhotos(rawInspection.id); }, [rawInspection?.id]);

  useEffect(() => {
    if (localInspection || !id) {
      setFetchingInspection(false);
      return;
    }
    let cancelled = false;
    setFetchedInspectionState(null);
    setFetchingInspection(true);
    (async () => {
      try {
        const res = await client.api.fetch(`/api/inspections/${id}`);
        if (!res.ok) return;
        const { data } = await res.json();
        if (cancelled || !data) return;
        let paymentStatus: any = {};
        if (data.paymentData && typeof data.paymentData === 'string') {
          try { paymentStatus = JSON.parse(data.paymentData); } catch {}
        } else if (data.payment && typeof data.payment === 'object') {
          paymentStatus = data.payment;
        }
        const tryParseJSON = (v: any, fallback: any) => {
          if (v && typeof v === 'object') return v;
          if (typeof v === 'string') { try { return JSON.parse(v); } catch { return fallback; } }
          return fallback;
        };
        const mapped = fromBackend(data);
        if (cancelled) return;
        setFetchedInspectionState(mapped);
        // Adopt it into the store too, so History/back navigation and other
        // pages relying on currentInspection stay consistent.
        setCurrentInspection(mapped as any);
      } catch (e) {
        console.warn('[ReportPage] Fallback fetch of inspection failed:', e);
      } finally {
        if (!cancelled) setFetchingInspection(false);
      }
    })();
    return () => { cancelled = true; };
  // Loading/result state must not cancel the request that sets that state.
  }, [id, localInspection, user?.id, setCurrentInspection]);

  const [isPaid, setIsPaid] = useState(inspection?.payment?.paid || false);

  // Reactively update isPaid when inspection.payment.paid changes (e.g., after store sync)
  useEffect(() => {
    if (inspection?.payment?.paid && !isPaid) {
      setIsPaid(true);
    }
  }, [inspection?.payment?.paid]);

  // Check backend for authoritative payment status (server is source of truth)
  // This handles the case where user comes from history and local data is stale
  useEffect(() => {
    if (!inspection?.id || isPaid) return;
    const checkBackendPayment = async () => {
      try {
        const res = await client.api.fetch(`/api/inspections/${inspection.id}`);
        if (res.ok) {
          const { data } = await res.json();
          // GET /api/inspections/:id returns raw DB row; paymentData is a JSON string
          let paymentStatus: any = {};
          if (data.paymentData && typeof data.paymentData === 'string') {
            try { paymentStatus = JSON.parse(data.paymentData); } catch {}
          } else if (data.payment && typeof data.payment === 'object') {
            paymentStatus = data.payment;
          }
          if (paymentStatus?.paid === true) {
            setIsPaid(true);
            // Update local store so future navigations reflect payment
            const { recordPayment } = useInspectionStore.getState();
            recordPayment(inspection.id, {
              paid: true,
              amount: paymentStatus.amount || 0,
              currency: paymentStatus.currency || 'AED',
              method: paymentStatus.method || 'card',
              paidAt: paymentStatus.paidAt,
              sessionId: paymentStatus.sessionId,
            });
          }
        }
      } catch (e) {
        // Silent fail — user can still see the report page
      }
    };
    checkBackendPayment();
  }, [inspection?.id]);

  // --- iOS RevenueCat purchase confirmation polling ---
  // The backend webhook (/api/webhooks/revenuecat) is the ONLY thing that ever
  // flips paymentData.paid for an in-app purchase. This helper repeatedly asks
  // the backend for the authoritative status; it never unlocks anything itself.
  const pollBackendForUnlock = useCallback((maxAttempts = 20, intervalMs = 3000) => {
    if (!inspection?.id) return;
    let attempts = 0;
    const tick = async () => {
      attempts += 1;
      try {
        const res = await client.api.fetch(`/api/inspections/${inspection.id}`);
        if (res.ok) {
          const { data } = await res.json();
          let paymentStatus: any = {};
          if (data.paymentData && typeof data.paymentData === 'string') {
            try { paymentStatus = JSON.parse(data.paymentData); } catch {}
          } else if (data.payment && typeof data.payment === 'object') {
            paymentStatus = data.payment;
          }
          if (paymentStatus?.paid === true) {
            setIsPaid(true);
            setIapState('idle');
            setIapError('');
            const { recordPayment } = useInspectionStore.getState();
            recordPayment(inspection.id, {
              paid: true,
              amount: paymentStatus.amount || 0,
              currency: paymentStatus.currency || 'AED',
              method: 'apple_pay',
              paidAt: paymentStatus.paidAt,
            });
            // Fire payment-success confirmation email (iOS RevenueCat/IAP path).
            // Idempotent + best-effort.
            notifyPaymentSuccess({
              email: user?.email || '',
              name: user?.name || '',
              amount: paymentStatus.amount || 0,
              currency: paymentStatus.currency || 'AED',
              reportId: inspection.id,
            });
            return;
          }
        }
      } catch (e) {
        console.warn('[ReportPage] Backend unlock poll failed:', e);
      }
      if (attempts < maxAttempts) {
        pollTimerRef.current = setTimeout(tick, intervalMs);
      } else {
        // SAFETY NET: the webhook never confirmed within the poll window. Ask
        // the backend to reconcile directly against RevenueCat's own record of
        // this purchase before showing an error — so the user is never
        // permanently stuck if the webhook path had an issue.
        let reconciled = false;
        try {
          const rec = await client.api.fetch(`/api/inspections/${inspection.id}/reconcile-purchase`, {
            method: 'POST',
          });
          if (rec.ok) {
            const recData = await rec.json().catch(() => ({}));
            if (recData?.paid === true) {
              setIsPaid(true);
              setIapState('idle');
              setIapError('');
              const { recordPayment } = useInspectionStore.getState();
              recordPayment(inspection.id, {
                paid: true,
                amount: 0,
                currency: 'AED',
                method: 'apple_pay',
                paidAt: new Date().toISOString(),
              });
              // Fire payment-success confirmation email (iOS reconciliation path).
              // Idempotent + best-effort.
              notifyPaymentSuccess({
                email: user?.email || '',
                name: user?.name || '',
                amount: 0,
                currency: 'AED',
                reportId: inspection.id,
              });
              reconciled = true;
            }
          }
        } catch (e) {
          console.warn('[ReportPage] RevenueCat reconciliation failed:', e);
        }
        if (!reconciled) {
          // Never fail silently — give the user a clear, retry-able state.
          setIapState('error');
          setIapError('Still confirming your purchase with Apple. This can take a moment — please try again shortly.');
        }
      }
    };
    tick();
  }, [inspection?.id, user?.email, user?.name]);

  // Clean up any pending poll timer on unmount.
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, []);

  // On iOS, identify this report to RevenueCat (appUserID = inspectionId) and
  // check whether it was already purchased before showing a purchase button —
  // this alone never unlocks the report, it just avoids a redundant charge.
  useEffect(() => {
    if (!isIOSNative || !inspection?.id || isPaid) return;
    let cancelled = false;
    (async () => {
      setIapState('checking');
      try {
        await identifyReport(inspection.id);
        const alreadyPurchased = await hasPurchasedReport();
        if (cancelled) return;
        if (alreadyPurchased) {
          // RevenueCat already has a transaction for this report — wait for
          // the backend webhook to confirm and unlock (never trust the client).
          setIapState('confirming');
          pollBackendForUnlock();
        } else {
          setIapState('idle');
        }
      } catch (err) {
        if (cancelled) return;
        console.error('[ReportPage] RevenueCat identify/check failed:', err);
        setIapState('idle');
      }
    })();
    return () => { cancelled = true; };
  }, [isIOSNative, inspection?.id, isPaid, pollBackendForUnlock]);

  const handleNativePurchase = useCallback(async () => {
    setIapState('purchasing');
    setIapError('');
    const outcome = await purchaseReport();
    if (outcome.status === 'success') {
      // Purchase accepted by Apple/RevenueCat — but the client NEVER unlocks
      // the report itself. Show a confirming state and wait for the verified
      // backend webhook to flip paymentData.paid.
      setIapState('confirming');
      pollBackendForUnlock();
    } else if (outcome.status === 'cancelled') {
      setIapState('error');
      setIapError('Purchase was cancelled.');
    } else {
      setIapState('error');
      setIapError(outcome.message);
    }
  }, [pollBackendForUnlock]);

  // Unified "unlock" entry point used by every CTA below. iOS uses the native
  // RevenueCat purchase flow; web/Android keep the existing Stripe flow
  // completely unchanged.
  const handleUnlockClick = useCallback(() => {
    if (isIOSNative) {
      if (iapState === 'purchasing' || iapState === 'confirming') return;
      handleNativePurchase();
    } else {
      setShowPaymentModal(true);
    }
  }, [isIOSNative, iapState, handleNativePurchase]);

  // Handle payment redirect success
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');
    
    if (params.get('payment') === 'success' && sessionId) {
      // Verify with backend instead of trusting URL
      const verifyPayment = async () => {
        try {
          const res = await client.api.fetch(`/api/checkout/${sessionId}`);
          if (res.ok) {
            const { data } = await res.json();
            if (data.status === 'paid') {
              setIsPaid(true);
              // Update local store
              if (inspection) {
                useInspectionStore.getState().recordPayment(inspection.id, {
                  paid: true,
                  amount: 199,
                  currency: 'AED',
                  method: 'card',
                  sessionId,
                });
                // Fire payment-success confirmation email (Stripe redirect / web + Android).
                // Idempotent + best-effort.
                notifyPaymentSuccess({
                  email: user?.email || '',
                  name: user?.name || '',
                  amount: data.amount || 199,
                  currency: data.currency || 'AED',
                  reportId: inspection.id,
                });
              }
            }
          }
        } catch (err) {
          console.error('Payment verification failed:', err);
        } finally {
          // Clean up URL
          window.history.replaceState({}, '', window.location.pathname);
        }
      };
      verifyPayment();
    }
  }, [inspection?.id, user?.email, user?.name]);

  // Sync inspector name from profile if generic
  useEffect(() => {
    if (inspection && user?.name && (!inspection.meta.inspectorName || inspection.meta.inspectorName === 'Inspector')) {
      inspection.meta.inspectorName = user.name;
    }
  }, [inspection, user?.name]);

  // Generate data integrity hash
  useEffect(() => {
    if (!inspection) return;
    let cancelled = false;
    reportContentHash(inspection).then(async hash => {
      const qr = await QRCode.toDataURL(verificationURL(verificationId(inspection.id, hash)), { width: 240, margin: 2, errorCorrectionLevel: 'M' });
      if (!cancelled) { setReportHash(hash); setQrCode(qr); }
    }).catch(() => setProgress('Could not prepare report verification. Please retry.'));
    return () => { cancelled = true; };
  }, [inspection]);

  // Responsive scaling — fit A4 report into mobile viewport
  useEffect(() => {
    const calculateScale = () => {
      const viewportWidth = window.innerWidth;
      const padding = 32; // 16px each side
      const availableWidth = viewportWidth - padding;
      if (availableWidth < A4_WIDTH_PX) {
        setReportScale(availableWidth / A4_WIDTH_PX);
      } else {
        setReportScale(1);
      }
    };
    calculateScale();
    window.addEventListener('resize', calculateScale);
    return () => window.removeEventListener('resize', calculateScale);
  }, []);

  // Calculate total pages and report height after render
  useEffect(() => {
    if (!printRef.current || !inspection) return;
    const timer = setTimeout(() => {
      if (printRef.current) {
        const height = printRef.current.scrollHeight;
        setTotalPages(Math.ceil(height / A4_CONTENT_HEIGHT));
        setReportHeight(height);
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [inspection, reportHash]);

  // Retry fetching location and IP if missing (e.g., permission was slow)
  useEffect(() => {
    if (!inspection) return;
    const meta: Partial<typeof inspection.meta> = inspection.meta || {};
    const needsLocation = !meta.location || typeof meta.location.latitude !== 'number';
    const needsIp = !meta.ipAddress;
    if (!needsLocation && !needsIp) return;

    const retryMetadata = async () => {
      try {
        const { getLocation, getIPAddress } = await import('../utils/helpers');
        const [loc, ip] = await Promise.all([
          needsLocation ? getLocation() : Promise.resolve(null),
          needsIp ? getIPAddress() : Promise.resolve(null),
        ]);
        if ((loc || ip) && inspection) {
          const updatedMeta = { ...inspection.meta };
          if (loc) updatedMeta.location = loc;
          if (ip) updatedMeta.ipAddress = ip;
          const updatedInspection = { ...inspection, meta: updatedMeta };
          useInspectionStore.getState().setCurrentInspection(updatedInspection);
        }
      } catch (e) {
        console.warn('[ReportPage] Failed to fetch location/IP:', e);
      }
    };
    retryMetadata();
  }, [inspection?.id]);

  if (!inspection) {
    if (fetchingInspection) {
      return (
        <div className="text-center py-16">
          <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-500">Loading your report…</p>
        </div>
      );
    }
    return (
      <div className="text-center py-16">
        <p className="text-slate-500">Inspection not found.</p>
        <button onClick={() => navigate('/')} className="mt-4 text-blue-600 hover:text-blue-700 font-medium">
          Go to Dashboard
        </button>
      </div>
    );
  }

  // The same final list drives every rendered row and every summary bucket.
  const summary = inspectionSummary(inspection);
  const totalItems = summary.total;
  const checkedItems = summary.rated;
  const damagedItems = summary.issues;
  const goodItems = summary.good;
  const fairItems = summary.fair;
  const totalPhotos = summary.photos;

  const REPORT_PRICE = 199;

  const propertyDisplayName = [
    inspection.property.buildingName,
    inspection.property.unitNumber ? `Unit ${inspection.property.unitNumber}` : '',
  ].filter(Boolean).join(' ') || inspection.property.makaniNumber || 'Property';

  const propertyAddress = [
    inspection.property.area,
    inspection.property.city,
  ].filter(Boolean).join(', ') || '—';

  // Owner's name for report title/filename (landlord is treated as the property owner)
  const ownerName = inspection.landlord?.name || 'Owner';
  const reportDateStr = formatDate(inspection.completedAt || inspection.updatedAt || new Date().toISOString());

  const sanitizeFilename = (s: string) => s
    .replace(/[\\/:*?"<>|]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\s/g, '-');

  // Report title/filename: Address, Owner's name, Date — short identifiable string
  const reportTitleString = sanitizeFilename(
    `${propertyDisplayName}-${propertyAddress}-${ownerName}-${reportDateStr}`.replace(/—/g, '-')
  );

  // Photo-sized room fragments: never shrink an entire multi-page room into one page.
  const roomGroups: Array<typeof inspection.rooms> = [];
  for (const room of inspection.rooms) {
    let fragments: typeof room.items = [];
    let height = 100;
    let part = 0;
    const flush = () => {
      if (!fragments.length) return;
      roomGroups.push([{ ...room, name: room.name + (part ? ' (continued)' : ''), items: fragments }]);
      fragments = []; height = 100; part++;
    };
    for (const item of room.items) {
      const groups = Math.max(1, Math.ceil(item.photos.length / 2));
      for (let p = 0; p < groups; p++) {
        const photos = item.photos.slice(p * 2, p * 2 + 2);
        const itemHeight = 55 + Math.ceil((item.comments || '').length / 95) * 15 + (photos.length ? 245 : 0);
        if (height + itemHeight > 900) flush();
        fragments.push({ ...item, id: item.id + (p ? `-photos-${p}` : ''), name: item.name + (p ? ' (photos continued)' : ''), photos });
        height += itemHeight;
      }
    }
    flush();
    if (!room.items.length) roomGroups.push([room]);
  }

  const executePreparedAction = (action: 'download' | 'email' | 'print') => {
    if (!isPaid) { handleUnlockClick(); return; }
    void generatePDF(action === 'email' ? 'email' : 'download');
  };

  const prepareAction = async (action: 'download' | 'email' | 'print') => {
    // Starting payment must never wait on report-photo preparation. Photo
    // checks run only after the server has confirmed the report is paid.
    if (!isPaid) { setPendingAction(action); handleUnlockClick(); return; }
    setPendingAction(action);
    setPhotoCheckBusy(true);
    setProgress('Checking every report photo…');
    try {
      await retryPhotoBackups();
      const current = normalizeInspection(useInspectionStore.getState().getInspection(inspection.id) || inspection);
      const result = await runPhotoPreflight(current);
      useInspectionStore.getState().setCurrentInspection(result.inspection);
      setPhotoFailures(result.failed);
      if (result.failed.length) {
        setProgress(`${result.failed.length} photos could not be loaded. Payment has not started.`);
        return;
      }
      setProgress(`${result.diagnostics.length} photos checked and ready.`);
      window.setTimeout(() => executePreparedAction(action), 100);
    } catch (error) {
      setProgress(`Photo check could not finish: ${error instanceof Error ? error.message : 'Unknown error'}. Payment has not started.`);
    } finally { setPhotoCheckBusy(false); }
  };

  const handleDownloadClick = () => { void prepareAction('download'); };

  const handlePaymentSuccess = async () => {
    if (!inspection) return;
    try {
      const result = await reconcileReportPayment(inspection.id);
      if (!result.paid) {
        setProgress('Confirming payment...');
        return;
      }
      setIsPaid(true);
      await useInspectionStore.getState().syncFromBackend();
      setTimeout(() => { void generatePDF(pendingAction === 'email' ? 'email' : 'download'); }, 1500);
    } catch (error) {
      setProgress(error instanceof Error ? error.message : 'Payment confirmation failed.');
    }
  };

  // ============================================
  // PDF Generation
  // ============================================
  const generatePDF = async (delivery: 'download' | 'email' = 'download') => {
    if (!printRef.current) {
      setProgress('Report content not ready. Please wait a moment and try again.');
      return;
    }
    setGenerating(true);
    setProgress('Generating PDF... Please wait.');

    try {
      await retryPhotoBackups();
      const current = useInspectionStore.getState().getInspection(inspection.id) || inspection;
      const latest = { ...current, completedAt: current.completedAt || new Date().toISOString() };
      if (allPhotos(latest).filter(p => p.includeInReport !== false).some(p => p.backupStatus !== 'backed_up' || !p.url)) throw new Error('Some included photos are not yet backed up or restored. Run the photo check again before finalising.');
      if (!await saveInspection(latest)) throw new Error('The inspection could not be saved to cloud. Your draft is kept.');
      useInspectionStore.getState().setCurrentInspection(latest);
      const contentHash = await reportContentHash(latest);
      const qr = await QRCode.toDataURL(verificationURL(verificationId(latest.id, contentHash)), { width: 240, margin: 2, errorCorrectionLevel: 'M' });
      setReportHash(contentHash); setQrCode(qr);
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const response = await client.api.fetch('/api/upload/pdf', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inspectionId: latest.id, contentHash }),
      });
      if (!response.ok) throw new Error('Cloud report storage is unavailable. Please retry.');
      const target = await response.json();
      let pdfBlob: Blob;
      if (target.registered) {
        const stored = await fetch(target.downloadUrl);
        if (!stored.ok) throw new Error('Could not retrieve the registered report.');
        pdfBlob = await stored.blob();
      } else {
        const { renderReportPDF } = await import('../utils/reportPdf');
        pdfBlob = await renderReportPDF(printRef.current!, setProgress);
      }
      if (pdfBlob.size > 40 * 1024 * 1024) throw new Error('Report exceeds the 40 MB sharing limit.');
      setPdfSize(pdfBlob.size);
      setProgress('PDF ready: ' + (pdfBlob.size / 1024 / 1024).toFixed(2) + ' MB');
      if (!window.confirm('Final PDF size: ' + (pdfBlob.size / 1024 / 1024).toFixed(2) + ' MB (maximum 40 MB). Finalise and share?')) return;
      if (!target.registered) {
        setProgress('Backing up the final PDF and registering verification…');
        const uploaded = await fetch(target.uploadUrl, { method: 'PUT', body: pdfBlob, headers: { 'Content-Type': 'application/pdf' } });
        if (!uploaded.ok) throw new Error('PDF upload failed. Your draft is kept.');
        const registered = await client.api.fetch('/api/inspections/' + latest.id + '/finalise', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contentHash, path: target.path }),
        });
        if (!registered.ok) { const error = await registered.json(); throw new Error(error.error || 'Report verification could not be registered.'); }
        target.path = (await registered.json()).path;
      }
      const completed = { ...latest, pdfUrl: target.path, pdfSize: pdfBlob.size, status: 'completed' as const, reportGenerated: true };
      if (!await saveInspection(completed)) throw new Error('Report registered but completion could not be saved. Retry to retrieve the same PDF.');
      useInspectionStore.getState().setCurrentInspection(completed);
      if (delivery === 'email') { setShowEmailModal(true); }
      else if (Capacitor.isNativePlatform()) {
        const base64 = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve((reader.result as string).split(',')[1]); reader.onerror = reject; reader.readAsDataURL(pdfBlob); });
        await Filesystem.writeFile({ path: reportTitleString + '.pdf', data: base64, directory: Directory.Documents });
        const uri = await Filesystem.getUri({ path: reportTitleString + '.pdf', directory: Directory.Documents });
        try { await Share.share({ title: 'Property Inspection Report', url: uri.uri, dialogTitle: 'Share Report PDF' }); } catch { /* User cancelled sharing; registered PDF remains available. */ }
      } else {
        const url = URL.createObjectURL(pdfBlob);
        const a = document.createElement('a'); a.href = url; a.download = reportTitleString + '.pdf'; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      }
      setProgress('Report finalised and verification registered — ' + (pdfBlob.size / 1024 / 1024).toFixed(2) + ' MB');
    } catch (err) {
      console.error('PDF generation error:', err);
      setProgress(`PDF could not be prepared: ${err instanceof Error ? err.message : 'Unknown error'}. Your draft and evidence have been kept.`);
    } finally {
      setGenerating(false);
    }
  };

  const handlePrint = () => { void prepareAction('print'); };

  const continueWithoutFailedPhotos = async () => {
    const current = normalizeInspection(useInspectionStore.getState().getInspection(inspection.id) || inspection);
    const updated = excludePhotos(current, photoFailures.map(failure => failure.photoId));
    useInspectionStore.getState().setCurrentInspection(updated);
    await saveInspection(updated);
    setPhotoFailures([]);
    setProgress(`${photoFailures.length} photos will be excluded and identified on the cover.`);
    window.setTimeout(() => executePreparedAction(pendingAction), 100);
  };

  const retakeFailedPhoto = (failure: PhotoDiagnostic) => {
    const store = useInspectionStore.getState();
    store.setCurrentInspection(inspection);
    if (failure.roomId) {
      const roomIndex = inspection.rooms.findIndex(room => room.id === failure.roomId);
      if (roomIndex >= 0) { store.setCurrentRoomIndex(roomIndex); store.setCurrentStep(roomIndex + 1); }
    } else if (failure.roomName === 'Property') {
      store.setCurrentStep(inspection.rooms.length + 1);
    }
    navigate('/inspect', { state: { retakePhotoId: failure.photoId, itemId: failure.itemId } });
  };

  const getConditionBg = (condition: string | null) => {
    switch (condition) {
      case 'very_good': return 'background: linear-gradient(135deg, #d1fae5, #a7f3d0); color: #065f46;';
      case 'good': return 'background: linear-gradient(135deg, #dcfce7, #bbf7d0); color: #166534;';
      case 'fair': return 'background: linear-gradient(135deg, #fef3c7, #fde68a); color: #92400e;';
      case 'poor': return 'background: linear-gradient(135deg, #fee2e2, #fecaca); color: #991b1b;';
      default: return 'background: #f8fafc; color: #94a3b8; border: 1px dashed #cbd5e1;';
    }
  };

  const parseInlineStyle = (styleStr: string) => {
    const style: any = {};
    styleStr.split(';').forEach(s => {
      const [k, v] = s.split(':');
      if (k && v) {
        const key = k.trim().replace(/-./g, x => x[1].toUpperCase());
        style[key] = v.trim();
      }
    });
    return style;
  };

  const coverPhoto = (inspection.overallPhotos && inspection.overallPhotos.length > 0)
    ? inspection.overallPhotos[0]
    : null;

  const createdAt = inspection.createdAt && !isNaN(new Date(inspection.createdAt).getTime())
    ? inspection.createdAt
    : inspection.updatedAt || new Date().toISOString();

  const hdr = <PageHeader inspection={inspection} reportHash={reportHash} />;
  const ftr = (n: number) => <PageFooter inspection={inspection} pageNumber={n} totalPages={totalPages} />;

  return (
    <div className="max-w-4xl mx-auto px-2 sm:px-0">
      <BackupNotice />
      {pdfSize !== null && <p role="status" className="mb-3 text-sm text-slate-600">Final PDF size: {(pdfSize / 1024 / 1024).toFixed(2)} MB / 40 MB</p>}
      {/* Action Bar */}
      <div className="flex items-center justify-between mb-4 no-print flex-wrap gap-2">
        <button onClick={() => safeGoBack(navigate, '/history')} className="flex items-center gap-2 text-slate-600 hover:text-slate-800 text-sm font-medium">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <div className="flex items-center gap-2 flex-wrap">
          {progress && <span className="text-xs text-blue-600 font-medium animate-pulse">{progress}</span>}
          <button
            onClick={handleDownloadClick}
            disabled={generating}
            className={`px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 transition-all ${
              generating
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-700 hover:to-teal-700 shadow-lg shadow-emerald-500/25'
            }`}
          >
            {generating ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Generating PDF...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                {isPaid ? 'Download PDF' : (isIOSNative ? 'Unlock to Download' : 'Pay to Download')}
              </>
            )}
          </button>
          <button
            onClick={() => { void prepareAction('email'); }}
            disabled={generating}
            className="px-3 sm:px-5 py-2 sm:py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-xs sm:text-sm font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all flex items-center gap-2 shadow-lg shadow-blue-500/25"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            {isPaid ? 'Email Report' : (isIOSNative ? 'Unlock to Email' : 'Pay to Email')}
          </button>
          <button
            onClick={handlePrint}
            className="px-3 sm:px-5 py-2 sm:py-2.5 bg-white border-2 border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print
          </button>
        </div>
      </div>

      {!isPaid && (
        <div className="mb-6 p-6 bg-blue-50 border-2 border-blue-200 rounded-2xl flex flex-col sm:flex-row items-center gap-4 shadow-sm animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white text-xl shadow-lg shadow-blue-500/20">
            💳
          </div>
          <div className="flex-1 text-center sm:text-left">
            <h3 className="text-lg font-bold text-blue-900">Report Locked</h3>
            <p className="text-sm text-blue-700">
              {isIOSNative
                ? 'Complete your in-app purchase to download the full professional PDF report and email it to all parties.'
                : 'Complete your payment to download the full professional PDF report and email it to all parties.'}
            </p>
            {isIOSNative && iapState === 'error' && iapError && (
              <p className="text-sm text-red-600 font-medium mt-2">{iapError}</p>
            )}
          </div>
          {isIOSNative ? (
            <button
              onClick={handleUnlockClick}
              disabled={iapState === 'purchasing' || iapState === 'confirming' || iapState === 'checking'}
              className="px-8 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/25 whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {iapState === 'checking' && 'Checking...'}
              {iapState === 'purchasing' && 'Processing...'}
              {iapState === 'confirming' && 'Confirming purchase...'}
              {(iapState === 'idle' || iapState === 'error') && (iapError ? 'Try Again' : 'Unlock Report')}
            </button>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={() => { void prepareAction('download'); }}
                className="px-8 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/25 whitespace-nowrap"
              >
                Pay AED {REPORT_PRICE}
              </button>
              <button
                onClick={() => { void handlePaymentSuccess(); }}
                className="text-sm font-semibold text-blue-700 underline"
              >
                I already paid, check payment
              </button>
            </div>
          )}
        </div>
      )}

      {/* REPORT CONTENT — A4 WIDTH, scaled to fit */}
      <div
        className="report-wrapper"
        style={{
          width: '100%',
          overflowX: 'hidden',
          overflowY: 'visible',
          height: reportScale < 1 && reportHeight ? `${reportHeight * reportScale + 20}px` : 'auto',
          filter: !isPaid ? 'blur(4px) grayscale(50%)' : 'none',
          pointerEvents: !isPaid ? 'none' : 'auto',
          userSelect: !isPaid ? 'none' : 'auto',
        }}
      >
        <div
          ref={printRef}
          id="report-content"
          style={{
            width: `${A4_WIDTH_PX}px`,
            padding: '56.69px',
            boxSizing: 'border-box',
            background: '#ffffff',
            overflow: 'hidden',
            borderRadius: '16px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
            transformOrigin: 'top left',
            transform: reportScale < 1 ? `scale(${reportScale})` : undefined,
            marginLeft: reportScale < 1 ? '0' : 'auto',
            marginRight: 'auto',
          }}
        >
          <ReportDocument inspection={inspection} reportHash={reportHash} qrCode={qrCode} header={hdr} footer={ftr(1)} />
        </div>
      </div>

      {/* Modals */}
      <PhotoPreflightModal
        failures={photoFailures}
        busy={photoCheckBusy}
        onRetry={() => { void prepareAction(pendingAction); }}
        onRetake={retakeFailedPhoto}
        onContinue={() => { void continueWithoutFailedPhotos(); }}
        onClose={() => setPhotoFailures([])}
      />
      <PaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        onPaymentSuccess={handlePaymentSuccess}
        amount={REPORT_PRICE}
        reportId={inspection.id}
      />

      <EmailReportModal
        isOpen={showEmailModal}
        onClose={() => setShowEmailModal(false)}
        recipients={[
          ...(inspection.tenant.email ? [{ name: inspection.tenant.name, email: inspection.tenant.email, role: 'tenant' }] : []),
          ...(inspection.landlord.email ? [{ name: inspection.landlord.name, email: inspection.landlord.email, role: 'landlord' }] : []),
          ...(inspection.meta.inspectorEmail ? [{ name: inspection.meta.inspectorName, email: inspection.meta.inspectorEmail, role: 'inspector' }] : []),
        ]}
        reportName={propertyDisplayName}
        reportId={inspection.id}
        inspection={inspection}
      />
    </div>
  );
}

// ============================================
// Helper Components
// ============================================

function ReportSection({ title, icon, accentColor, children, pageBreak }: {
  title: string; icon: string; accentColor: string; children: React.ReactNode; pageBreak?: boolean;
}) {
  return (
    <div style={{ marginBottom: '16px', pageBreakInside: 'avoid', breakInside: 'avoid', ...(pageBreak ? { pageBreakBefore: 'always', breakBefore: 'page' } : {}) }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', paddingBottom: '6px', borderBottom: '2px solid #e2e8f0', position: 'relative' }}>
        <div style={{ position: 'absolute', bottom: '-2px', left: 0, width: '40px', height: '2px', background: accentColor, borderRadius: '1px' }}></div>
        <div style={{ width: '22px', height: '22px', background: `${accentColor}15`, borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>{icon}</div>
        <h3 style={{ fontSize: '12px', fontWeight: '700', color: '#1e293b', letterSpacing: '-0.2px' }}>{title}</h3>
      </div>
      {children}
    </div>
  );
}

function InfoRowCompact({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '6px', alignItems: 'flex-start' }}>
      <span style={{ fontSize: '8px', fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase', flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: '9px', fontWeight: '600', color: '#334155', textAlign: 'right', whiteSpace: 'normal', wordBreak: 'break-word' }}>{value}</span>
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '4px', background: '#ffffff', borderRadius: '6px', border: '1px solid #f1f5f9' }}>
      <div style={{ fontSize: '10px', fontWeight: '800', color }}>{value}</div>
      <div style={{ fontSize: '7px', fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase' }}>{label}</div>
    </div>
  );
}
