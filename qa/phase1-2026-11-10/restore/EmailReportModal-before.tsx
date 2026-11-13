import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { client } from '../api/client';

interface EmailReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipients: { name: string; email: string; role: string }[];
  reportName: string;
  reportId: string;
  inspection?: unknown;
}

type EmailStep = 'review' | 'sending' | 'success' | 'failed';

export default function EmailReportModal({
  isOpen,
  onClose,
  recipients,
  reportName,
  reportId,
}: EmailReportModalProps) {
  const [step, setStep] = useState<EmailStep>('review');
  const [sentCount, setSentCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (isOpen) {
      setStep('review');
      setSentCount(0);
      setErrorMessage('');
    }
  }, [isOpen]);

  const handleSend = async () => {
    setStep('sending');
    setErrorMessage('');
    try {
      const response = await client.api.fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inspectionId: reportId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        throw new Error(data.error || `Email sending failed (${response.status})`);
      }
      setSentCount(data.sentCount || 0);
      setStep('success');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Email sending failed.');
      setStep('failed');
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
        >
          <div className="border-b border-slate-100 px-6 py-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Email Report</h3>
                <p className="text-xs text-slate-500">Sent securely using inspection contact details</p>
              </div>
              <button aria-label="Close email modal" onClick={onClose} className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg hover:bg-slate-100">
                <span aria-hidden="true" className="text-2xl text-slate-400">×</span>
              </button>
            </div>
          </div>

          <div className="px-6 py-5">
            {step === 'review' && (
              <div className="space-y-4">
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-sm font-medium text-slate-700">{reportName}</p>
                  <p className="mt-1 font-mono text-xs text-slate-400">ID: {reportId.slice(0, 8).toUpperCase()}</p>
                </div>
                <div>
                  <p className="mb-2 text-sm font-medium text-slate-700">Recipients recorded on the inspection</p>
                  <div className="space-y-2">
                    {recipients.map(recipient => (
                      <div key={`${recipient.role}:${recipient.email}`} className="rounded-xl border border-slate-200 p-3">
                        <p className="text-sm font-medium text-slate-900">{recipient.name || recipient.role}</p>
                        <p className="text-xs text-slate-500">{recipient.email}</p>
                      </div>
                    ))}
                    <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
                      <p className="text-sm font-medium text-blue-900">Your signed-in email</p>
                      <p className="text-xs text-blue-700">A copy is always included.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {step === 'sending' && (
              <div className="py-10 text-center">
                <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600" />
                <p className="text-sm font-medium text-slate-700">Sending the fixed report email…</p>
              </div>
            )}

            {step === 'success' && (
              <div className="py-10 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl text-emerald-700">✓</div>
                <h4 className="text-lg font-semibold text-slate-900">Report Sent</h4>
                <p className="mt-1 text-sm text-slate-500">Successfully sent {sentCount} email{sentCount === 1 ? '' : 's'}.</p>
              </div>
            )}

            {step === 'failed' && (
              <div className="py-10 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-2xl text-red-700">×</div>
                <h4 className="text-lg font-semibold text-slate-900">Sending Failed</h4>
                <p className="mt-2 text-sm text-slate-500">{errorMessage}</p>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
            {step === 'review' && (
              <>
                <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200">Cancel</button>
                <button onClick={handleSend} className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700">Send Report</button>
              </>
            )}
            {step === 'sending' && <button disabled className="rounded-xl bg-slate-200 px-5 py-2 text-sm font-semibold text-slate-400">Sending…</button>}
            {step === 'failed' && <button onClick={handleSend} className="rounded-lg px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50">Retry</button>}
            {(step === 'success' || step === 'failed') && <button onClick={onClose} className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white">Done</button>}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
