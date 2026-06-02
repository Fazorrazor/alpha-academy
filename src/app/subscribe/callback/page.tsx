// src/app/subscribe/callback/page.tsx
'use client';

import React, { useEffect, useState, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { CheckCircle2, XCircle, Loader2, Sparkles, GraduationCap } from 'lucide-react';

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, refreshProfile } = useAuth();
  
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [errorMessage, setErrorMessage] = useState('');
  const verificationFired = useRef(false);

  useEffect(() => {
    // Route protection: If user is not authenticated yet, let them wait for initialization
    if (!user) return;

    // Prevent double execution in React StrictMode
    if (verificationFired.current) return;
    verificationFired.current = true;

    const reference = searchParams.get('reference');
    const plan = searchParams.get('plan') || 'monthly';

    if (!reference) {
      setStatus('error');
      setErrorMessage('No payment reference found. Please try again.');
      return;
    }

    async function verifyPayment() {
      try {
        const response = await fetch('/api/v1/subscriptions/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reference, plan }),
        });

        const data = await response.json();
        
        if (response.ok && data.status === 'success') {
          setStatus('success');
          // Reload profile status from Firestore so the layout updates immediately
          await refreshProfile();
          
          // Auto redirect to dashboard after 3 seconds
          setTimeout(() => {
            router.push('/dashboard');
          }, 3000);
        } else {
          setStatus('error');
          setErrorMessage(data.message || 'We could not verify your payment. Please contact support.');
        }
      } catch (err) {
        console.error('Payment verification failed:', err);
        setStatus('error');
        setErrorMessage('A network error occurred. Please check your connection and try again.');
      }
    }

    verifyPayment();
  }, [user, searchParams, refreshProfile, router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#F9F7F7] px-6 text-[#112D4E] font-sans">
      <div className="w-full max-w-md bg-white border border-[#DBE2EF] rounded-3xl p-8 text-center shadow-lg relative overflow-hidden">
        {/* Decorative subtle header background glow */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#112D4E] to-[#3F72AF]"></div>

        <div className="flex flex-col items-center">
          {/* Logo brand */}
          <div className="flex items-center gap-2 mb-8 select-none">
            <div className="h-8 w-8 rounded-lg bg-[#F9F7F7] border border-[#DBE2EF] flex items-center justify-center text-[#3F72AF] shadow-sm">
              <GraduationCap className="h-4.5 w-4.5" />
            </div>
            <span className="font-bold text-base bg-gradient-to-r from-[#112D4E] to-[#3F72AF] bg-clip-text text-transparent">
              Alpha Academy
            </span>
          </div>

          {/* VERIFYING STATE */}
          {status === 'verifying' && (
            <div className="space-y-6 animate-fade-in">
              <div className="relative">
                <Loader2 className="h-16 w-16 text-[#3F72AF] animate-spin mx-auto" />
                <Sparkles className="h-5 w-5 text-amber-500 fill-amber-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-extrabold tracking-tight">Verifying Payment</h2>
                <p className="text-zinc-500 text-sm leading-relaxed max-w-xs mx-auto">
                  Please hold on while we secure your premium membership status with Paystack...
                </p>
              </div>
            </div>
          )}

          {/* SUCCESS STATE */}
          {status === 'success' && (
            <div className="space-y-6 animate-scale-in">
              <div className="h-16 w-16 rounded-full bg-emerald-50 border border-emerald-250 flex items-center justify-center mx-auto text-emerald-600 shadow-sm animate-bounce">
                <CheckCircle2 className="h-10 w-10" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-extrabold tracking-tight text-emerald-700">Upgrade Complete!</h2>
                <p className="text-zinc-500 text-sm leading-relaxed">
                  Thank you! Your Premium subscription is now active. You have full access to all pathways.
                </p>
              </div>
              <div className="pt-4 space-y-3">
                <button
                  onClick={() => router.push('/dashboard')}
                  className="w-full py-3 bg-[#3F72AF] hover:bg-[#3F72AF]/95 text-white font-bold text-sm rounded-xl transition-all shadow-md shadow-[#3F72AF]/10 cursor-pointer"
                >
                  Enter Student Dashboard
                </button>
                <p className="text-[10px] text-zinc-400 animate-pulse">
                  Redirecting automatically in 3 seconds...
                </p>
              </div>
            </div>
          )}

          {/* ERROR STATE */}
          {status === 'error' && (
            <div className="space-y-6 animate-scale-in">
              <div className="h-16 w-16 rounded-full bg-red-50 border border-red-200 flex items-center justify-center mx-auto text-red-650 shadow-sm">
                <XCircle className="h-10 w-10" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-extrabold tracking-tight text-red-650">Payment Verification Failed</h2>
                <p className="text-zinc-500 text-sm leading-relaxed">
                  {errorMessage}
                </p>
              </div>
              <div className="pt-4">
                <button
                  onClick={() => router.push('/dashboard')}
                  className="w-full py-3 bg-[#112D4E] hover:bg-[#112D4E]/95 text-white font-bold text-sm rounded-xl transition-all cursor-pointer"
                >
                  Return to Dashboard
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen flex-col items-center justify-center bg-[#F9F7F7] text-[#112D4E]">
          <div className="flex flex-col items-center gap-4">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#3F72AF] border-t-transparent"></div>
            <p className="text-zinc-650 text-sm font-medium animate-pulse">Initializing callback context...</p>
          </div>
        </div>
      }
    >
      <CallbackContent />
    </Suspense>
  );
}
