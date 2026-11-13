import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { client } from '../api/client';

const PENDING_PAYMENT_KEY = 'meinspect-pending-payment';

export interface PendingPayment {
  reportId: string;
  sessionId: string;
  checkoutUrl: string;
  createdAt: number;
}

export function savePendingPayment(payment: PendingPayment): void {
  try { localStorage.setItem(PENDING_PAYMENT_KEY, JSON.stringify(payment)); } catch {}
}

export function getPendingPayment(reportId?: string): PendingPayment | null {
  try {
    const raw = localStorage.getItem(PENDING_PAYMENT_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as PendingPayment;
    if (!value?.reportId || !value?.sessionId) return null;
    return reportId && value.reportId !== reportId ? null : value;
  } catch { return null; }
}

export function clearPendingPayment(reportId?: string): void {
  const pending = getPendingPayment();
  if (!pending || !reportId || pending.reportId === reportId) {
    try { localStorage.removeItem(PENDING_PAYMENT_KEY); } catch {}
  }
}

export async function reconcileReportPayment(reportId: string): Promise<{ paid: boolean; sessionId?: string }> {
  const response = await client.api.fetch(`/api/inspections/${encodeURIComponent(reportId)}/reconcile-payment`, {
    method: 'POST',
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Payment confirmation failed.');
  return data;
}

export async function pollReportPayment(
  reportId: string,
  onAttempt?: (attempt: number) => void,
  durationMs = 60_000,
  intervalMs = 3_000,
): Promise<boolean> {
  const started = Date.now();
  let attempt = 0;
  while (Date.now() - started < durationMs) {
    attempt += 1;
    onAttempt?.(attempt);
    const result = await reconcileReportPayment(reportId);
    if (result.paid) {
      clearPendingPayment(reportId);
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
  return false;
}

let deepLinksInitialized = false;

async function handlePaymentDeepLink(rawUrl: string): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  let target: URL;
  try { target = new URL(rawUrl); } catch { return false; }
  const customReport = target.protocol === 'meinspect:' && target.hostname === 'report';
  const httpsReport = target.protocol === 'https:' && target.hostname === 'app.meinspect.com' && target.pathname.startsWith('/report/');
  if (!customReport && !httpsReport) return false;

  const reportId = customReport ? target.pathname.replace(/^\//, '') : target.pathname.split('/')[2];
  if (!reportId) return false;
  await Browser.close().catch(() => undefined);
  const route = `/report/${encodeURIComponent(reportId)}${target.search}`;
  window.location.assign(route);
  return true;
}

export function initializePaymentDeepLinks(): void {
  if (deepLinksInitialized || !Capacitor.isNativePlatform()) return;
  deepLinksInitialized = true;
  void App.addListener('appUrlOpen', ({ url }) => { void handlePaymentDeepLink(url); });
  void App.getLaunchUrl().then(launch => { if (launch?.url) void handlePaymentDeepLink(launch.url); });
}

export function subscribeToPaymentResume(callback: () => void): () => void {
  const onVisible = () => { if (document.visibilityState === 'visible') callback(); };
  document.addEventListener('visibilitychange', onVisible);
  let removeNative: (() => Promise<void>) | undefined;
  if (Capacitor.isNativePlatform()) {
    void App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) callback();
    }).then(handle => { removeNative = () => handle.remove(); });
  }
  return () => {
    document.removeEventListener('visibilitychange', onVisible);
    void removeNative?.();
  };
}

export function paymentDeviceContext(): Record<string, string> {
  const ua = navigator.userAgent || '';
  const android = ua.match(/Android\s+([^;\)]+)/i)?.[1] || 'unknown';
  const model = ua.match(/Android[^;]*;\s*([^;\)]+?)(?:\s+Build\/|;|\))/i)?.[1]?.trim() || 'unknown';
  const chrome = ua.match(/(?:Chrome|CriOS)\/(\d+(?:\.\d+){0,3})/i)?.[1] || 'unknown';
  return { platform: Capacitor.getPlatform(), androidVersion: android, deviceModel: model, webViewOrChromeVersion: chrome };
}
