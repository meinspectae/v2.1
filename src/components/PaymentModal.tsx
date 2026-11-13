import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { client } from '../api/client';
import {
  getPendingPayment,
  paymentDeviceContext,
  reconcileReportPayment,
  savePendingPayment,
} from '../utils/paymentRecovery';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPaymentSuccess: () => void;
  amount: number;
  currency?: string;
  reportId: string;
  onDiscountApplied?: (discountedAmount: number, discountCode: string) => void;
}

const VALID_DISCOUNT_CODES: Record<string, { type: 'percent' | 'fixed'; value: number; label: string }> = {
  'WELCOME20': { type: 'percent', value: 20, label: '20% Off' },
  'LAUNCH50': { type: 'fixed', value: 50, label: 'AED 50 Off' },
  'MEINSPECT10': { type: 'percent', value: 10, label: '10% Off' },
  'INSPECTOR': { type: 'fixed', value: 100, label: 'AED 100 Off' },
  'FREE_REPORT': { type: 'percent', value: 100, label: '100% Off — Free Report' },
};

type PaymentStep = 'select' | 'processing' | 'success' | 'failed';

export default function PaymentModal({
  isOpen,
  onClose,
  onPaymentSuccess,
  amount,
  currency = 'AED',
  reportId,
  onDiscountApplied,
}: PaymentModalProps) {
  const [step, setStep] = useState<PaymentStep>('select');
  const [processingMsg, setProcessingMsg] = useState('');
  const [discountCode, setDiscountCode] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState<{ code: string; discount: number; finalAmount: number; label: string } | null>(null);
  const [discountError, setDiscountError] = useState('');
  const [paymentError, setPaymentError] = useState('');
  const [fallbackUrl, setFallbackUrl] = useState('');
  const startingRef = useRef(false);

  const finalAmount = appliedDiscount ? appliedDiscount.finalAmount : amount;

  useEffect(() => {
    if (!isOpen) return;
    setStep('select');
    setDiscountCode('');
    setAppliedDiscount(null);
    setDiscountError('');
    setPaymentError('');
    setFallbackUrl(getPendingPayment(reportId)?.checkoutUrl || '');
  }, [isOpen, reportId]);

  const logLaunchFailure = useCallback(async (stage: string, error: unknown) => {
    try {
      await client.api.fetch('/api/public/payments/client-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stage,
          error: error instanceof Error ? error.message : String(error),
          ...paymentDeviceContext(),
        }),
      });
    } catch {}
  }, []);

  const handleApplyDiscount = () => {
    const code = discountCode.trim().toUpperCase();
    if (!code) { setDiscountError('Enter a discount code'); return; }
    const offer = VALID_DISCOUNT_CODES[code];
    if (!offer) { setDiscountError('Invalid discount code'); return; }
    const discount = offer.type === 'percent' ? Math.round(amount * offer.value / 100) : offer.value;
    const final = Math.max(0, amount - discount);
    setAppliedDiscount({ code, discount: amount - final, finalAmount: final, label: offer.label });
    setDiscountError('');
    onDiscountApplied?.(final, code);
  };

  const openCheckout = useCallback(async (url: string) => {
    setFallbackUrl(url);
    if (Capacitor.isNativePlatform()) {
      await Browser.open({ url, presentationStyle: 'fullscreen' });
    } else {
      window.location.assign(url);
    }
  }, []);

  const startPayment = useCallback(async () => {
    if (startingRef.current || step === 'processing') return;
    startingRef.current = true;
    setStep('processing');
    setProcessingMsg('Connecting to payment gateway...');
    setPaymentError('');

    try {
      const res = await client.api.fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: finalAmount,
          currency: 'AED',
          inspectionId: reportId,
          discountCode: appliedDiscount?.code,
          discountAmount: appliedDiscount?.discount || 0,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || `Payment could not start (${res.status}).`);

      if (data.status === 'paid' || data.alreadyPaid) {
        setStep('success');
        onPaymentSuccess();
        window.setTimeout(onClose, 800);
        return;
      }
      if (!data.url || !data.sessionId) throw new Error('The payment page address was not returned.');

      savePendingPayment({ reportId, sessionId: data.sessionId, checkoutUrl: data.url, createdAt: Date.now() });
      setProcessingMsg('Opening secure payment page...');
      try {
        await openCheckout(data.url);
      } catch (openError) {
        await logLaunchFailure('open_checkout', openError);
        throw new Error('The payment page could not open. Use the browser link below or retry.');
      }
    } catch (error) {
      startingRef.current = false;
      await logLaunchFailure('create_checkout', error);
      setPaymentError("We couldn't start the payment. Please try again");
      setStep('failed');
    }
  }, [step, finalAmount, reportId, appliedDiscount, onPaymentSuccess, onClose, openCheckout, logLaunchFailure]);

  const checkExistingPayment = useCallback(async () => {
    setStep('processing');
    setProcessingMsg('Confirming payment...');
    setPaymentError('');
    try {
      const result = await reconcileReportPayment(reportId);
      if (!result.paid) throw new Error('Payment has not been confirmed yet. Please try again shortly.');
      setStep('success');
      onPaymentSuccess();
      window.setTimeout(onClose, 800);
    } catch (error) {
      setPaymentError(error instanceof Error ? error.message : 'Payment confirmation failed.');
      setStep('failed');
    }
  }, [reportId, onPaymentSuccess, onClose]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <motion.div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={step !== 'processing' ? onClose : undefined} />
        <motion.div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden" initial={{ scale: 0.9, y: 30 }} animate={{ scale: 1, y: 0 }}>
          <div className="relative bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 px-6 pt-6 pb-8">
            {step !== 'processing' && <button aria-label="Close payment modal" onClick={onClose} className="absolute top-4 right-4 w-11 h-11 rounded-full bg-white/10 text-white">×</button>}
            <p className="text-white/60 text-xs font-medium tracking-wider uppercase mb-3">Secure Payment</p>
            <h2 className="text-white text-xl font-bold">{step === 'select' ? 'Pay for Report' : step === 'processing' ? 'Processing...' : step === 'success' ? 'Payment Complete' : 'Payment Failed'}</h2>
            <div className="mt-3 flex items-baseline gap-2">
              {appliedDiscount && <span className="text-lg text-white/40 line-through">{currency} {amount.toLocaleString()}</span>}
              <span className="text-3xl font-extrabold text-white">{currency} {finalAmount.toLocaleString()}</span>
            </div>
            <p className="text-white/50 text-xs mt-1">Report ID: RPT-{reportId.slice(0, 8).toUpperCase()}</p>
          </div>

          <div className="px-6 py-6">
            {step === 'select' && <div className="space-y-4">
              <p className="text-sm text-slate-500 text-center">You will be redirected to Stripe to complete your payment securely.</p>
              <button onClick={startPayment} className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-slate-100 hover:border-blue-500 font-bold text-slate-700">Credit or Debit Card</button>
              <button onClick={checkExistingPayment} className="w-full text-sm font-semibold text-blue-700 underline">I already paid, check payment</button>
              <div className="pt-4 border-t border-slate-100">
                <div className="flex gap-2">
                  <input value={discountCode} onChange={e => setDiscountCode(e.target.value)} placeholder="Discount Code" className="flex-1 px-4 py-2.5 bg-slate-50 border-2 border-slate-100 rounded-xl text-sm" />
                  <button onClick={handleApplyDiscount} className="px-4 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-bold">Apply</button>
                </div>
                {discountError && <p className="text-xs text-red-500 mt-2">{discountError}</p>}
                {appliedDiscount && <p className="text-xs text-emerald-600 font-medium mt-2">✓ {appliedDiscount.label} applied</p>}
              </div>
            </div>}

            {step === 'processing' && <div className="py-12 text-center"><div className="w-16 h-16 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mx-auto mb-6" /><p className="text-slate-600 font-medium">{processingMsg}</p></div>}
            {step === 'success' && <div className="py-10 text-center"><div className="text-5xl mb-4">✓</div><h3 className="text-xl font-bold">Payment Successful</h3></div>}
            {step === 'failed' && <div className="py-8 text-center">
              <h3 className="text-xl font-bold text-slate-900 mb-2">Payment Failed</h3>
              <p role="alert" className="text-slate-500 text-sm mb-6">{paymentError || "We couldn't process your payment. Please try again."}</p>
              <div className="space-y-3">
                <button onClick={() => { setStep('select'); setPaymentError(''); }} className="w-full px-8 py-3 bg-slate-900 text-white rounded-xl text-sm font-bold">Retry</button>
                {fallbackUrl && <button onClick={() => openCheckout(fallbackUrl).catch(error => logLaunchFailure('fallback_open', error))} className="w-full text-sm font-semibold text-blue-700 underline">Open payment page in browser</button>}
                <button onClick={checkExistingPayment} className="w-full text-sm font-semibold text-blue-700 underline">I already paid, check payment</button>
              </div>
            </div>}
          </div>
          <div className="px-6 py-4 bg-slate-50 border-t text-center text-xs text-slate-400">Powered by Stripe</div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
