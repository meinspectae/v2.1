import { lazy, Suspense, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { client } from './api/client';
import { getPendingPayment, subscribeToPaymentResume } from './utils/paymentRecovery';
import AppLayout from './components/layout/AppLayout';
import NetworkStatusBanner from './components/NetworkStatusBanner';

// Code-split all route components for smaller initial bundle
const LoginPage = lazy(() => import('./pages/LoginPage'));
const SignUpPage = lazy(() => import('./pages/SignUpPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const VerifyEmailPage = lazy(() => import('./pages/VerifyEmailPage'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const NewInspection = lazy(() => import('./pages/NewInspection'));
const InspectionForm = lazy(() => import('./pages/InspectionForm'));
const ReportPage = lazy(() => import('./pages/ReportPage'));
const HistoryPage = lazy(() => import('./pages/HistoryPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const PaymentHistoryPage = lazy(() => import('./pages/PaymentHistoryPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const VerifyReportPage = lazy(() => import('./pages/VerifyReportPage'));

function PageLoader() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm text-slate-500">Loading...</p>
      </div>
    </div>
  );
}

function PaymentReturnRoute() {
  const { id = '' } = useParams();
  const location = useLocation();
  const { isAuthenticated, loading } = useAuth();
  const [state, setState] = useState<'confirming' | 'paid' | 'pending' | 'error'>('confirming');

  useEffect(() => {
    const sessionId = new URLSearchParams(location.search).get('session_id');
    if (!sessionId || new URLSearchParams(location.search).get('payment') !== 'success') return;
    let cancelled = false;
    client.api.fetch('/api/public/payments/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, reportId: id }),
    }).then(async response => {
      const data = await response.json().catch(() => ({}));
      if (!cancelled) setState(response.ok && data.paid ? 'paid' : response.ok ? 'pending' : 'error');
    }).catch(() => { if (!cancelled) setState('error'); });
    return () => { cancelled = true; };
  }, [id, location.search]);

  if (loading) return <PageLoader />;
  if (isAuthenticated) return <Navigate to={`/app/report/${encodeURIComponent(id)}${location.search}`} replace />;

  const openUrl = `meinspect://report/${encodeURIComponent(id)}${location.search}`;
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-sm">
        <h1 className="text-xl font-bold text-slate-900">{state === 'confirming' ? 'Confirming payment...' : 'Payment received. Open the MeInspect app to continue.'}</h1>
        {state === 'error' && <p className="mt-3 text-sm text-red-600">Payment confirmation is taking longer than expected. Your payment will be checked again in the app.</p>}
        <a href={openUrl} className="inline-block mt-6 px-6 py-3 bg-blue-600 text-white rounded-xl font-bold">Open the app</a>
        <a href={`/login?returnTo=${encodeURIComponent(`/report/${id}${location.search}`)}`} className="block mt-4 text-sm font-semibold text-blue-700 underline">Please sign in</a>
      </div>
    </div>
  );
}

function PendingPaymentRecovery() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState('Confirming payment...');

  useEffect(() => {
    if (!isAuthenticated) return;
    let running = false;
    let cancelled = false;
    const check = async () => {
      const pending = getPendingPayment();
      if (!pending || running || cancelled) return;
      running = true;
      setConfirming(true);
      setMessage('Confirming payment...');
      const started = Date.now();
      try {
        while (!cancelled && Date.now() - started < 60_000) {
          const response = await client.api.fetch(`/api/inspections/${encodeURIComponent(pending.reportId)}/reconcile-payment`, { method: 'POST' });
          const data = await response.json().catch(() => ({}));
          if (response.status === 401) {
            navigate(`/login?returnTo=${encodeURIComponent(`/report/${pending.reportId}`)}`, { replace: true });
            return;
          }
          if (response.ok && data.paid) {
            localStorage.removeItem('meinspect-pending-payment');
            setConfirming(false);
            navigate(`/report/${pending.reportId}`, { replace: true });
            return;
          }
          await new Promise(resolve => setTimeout(resolve, 3_000));
        }
        if (!cancelled) setMessage('Payment is still being confirmed. You can safely try again.');
      } catch {
        if (!cancelled) setMessage('Payment confirmation needs a connection. It will retry when the app resumes.');
      } finally {
        running = false;
      }
    };
    void check();
    const unsubscribe = subscribeToPaymentResume(() => { void check(); });
    return () => { cancelled = true; unsubscribe(); };
  }, [isAuthenticated, navigate]);

  if (!confirming) return null;
  return <div role="status" className="fixed inset-x-4 top-4 z-[100] mx-auto max-w-md rounded-xl bg-slate-900 px-4 py-3 text-center text-sm font-semibold text-white shadow-xl">{message}</div>;
}

function ProtectedRoute() {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-slate-500">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    const returnTo = `${location.pathname}${location.search}`;
    return <Navigate to={`/login?returnTo=${encodeURIComponent(returnTo)}`} replace />;
  }

  return <Outlet />;
}

function App() {
  return (
    <BrowserRouter>
      {/* Shows "No Internet Connection" banner when device goes offline */}
      <NetworkStatusBanner />
      <PendingPaymentRecovery />
      <Suspense fallback={<PageLoader />}>
        <Routes>
            {/* Public routes */}
            <Route path="/v/:id" element={<VerifyReportPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignUpPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />
            <Route path="/report/:id" element={<PaymentReturnRoute />} />

            {/* Protected routes */}
            <Route element={<ProtectedRoute />}>
              <Route path="/admin" element={<AdminPage />} />
              <Route element={<AppLayout />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/new" element={<NewInspection />} />
                <Route path="/inspect" element={<InspectionForm />} />
                <Route path="/app/report/:id" element={<ReportPage />} />
                <Route path="/history" element={<HistoryPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/payments" element={<PaymentHistoryPage />} />
              </Route>
            </Route>

            {/* Catch all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
    </BrowserRouter>
  );
}

export default App;
