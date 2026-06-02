// src/app/terms/page.tsx
'use client';

import React from 'react';
import Link from 'next/link';
import { GraduationCap, ArrowLeft, FileText } from 'lucide-react';

export default function TermsOfServicePage() {
  return (
    <div className="relative flex min-h-screen flex-col bg-[#F9F7F7] text-[#112D4E] font-sans overflow-hidden">
      {/* Background ambient mesh glows */}
      <div className="absolute top-[-10%] left-[-10%] h-[600px] w-[600px] rounded-full bg-[#DBE2EF]/60 blur-[130px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] h-[600px] w-[600px] rounded-full bg-[#3F72AF]/10 blur-[130px] pointer-events-none"></div>

      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-[#DBE2EF]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="h-9 w-9 rounded-xl bg-white border border-[#DBE2EF] flex items-center justify-center text-[#3F72AF] shadow-sm transition-transform group-hover:-translate-x-0.5">
              <ArrowLeft className="h-4 w-4" />
            </div>
            <span className="font-semibold text-sm text-zinc-500 group-hover:text-[#112D4E] transition-colors">
              Back to Home
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-[#3F72AF]" />
            <span className="font-bold text-sm bg-gradient-to-r from-[#112D4E] to-[#3F72AF] bg-clip-text text-transparent">
              Alpha Academy
            </span>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-3xl mx-auto px-4 py-16 relative z-10">
        <div className="bg-white border border-[#DBE2EF] rounded-2xl p-8 md:p-12 shadow-sm space-y-8">
          <div className="flex items-center gap-3 pb-6 border-b border-[#DBE2EF]">
            <div className="h-10 w-10 rounded-xl bg-[#3F72AF]/10 flex items-center justify-center text-[#3F72AF]">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#112D4E]">Terms of Service</h1>
              <p className="text-xs text-zinc-400 mt-1">Effective Date: June 1, 2026</p>
            </div>
          </div>

          <div className="space-y-6 text-sm text-zinc-650 leading-relaxed">
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-[#112D4E]">1. Acceptance of Terms</h2>
              <p>
                By registering an account or purchasing a membership subscription at Alpha Academy, you agree to comply with and be bound by these Terms of Service. If you do not agree to these terms, you must refrain from using the platform.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-[#112D4E]">2. Subscriptions and Billing</h2>
              <p>
                Access to premium study materials, lessons, and certification modules requires an active monthly or annual subscription. 
                Subscriptions automatically renew on their respective billing cycles. 
                You can cancel your subscription at any time through your dashboard settings. Payments are non-refundable.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-[#112D4E]">3. Account Usage and Restrictions</h2>
              <p>
                Accounts are for individual use only. Shared credentials, simultaneous logins from disparate locations, or automated extraction (scraping) of videos and PDF study resources are strictly prohibited. Violating these terms will result in permanent suspension without a refund.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-[#112D4E]">4. Educational Policy & Certificates</h2>
              <p>
                Professional certificates are awarded automatically upon complete verification of progress and passing quiz scores. Attempting to bypass lesson tracking, tamper with API responses, or submit simulated scores is a violation of academic integrity and results in certificate revocation.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-[#112D4E]">5. Intellectual Property</h2>
              <p>
                All course curriculums, lesson scripts, instructional videos, downloadable PDF materials, logos, and software are the exclusive intellectual property of Alpha Academy and its content authors. No content may be re-distributed or sold.
              </p>
            </section>

            <section className="space-y-3 pb-4">
              <h2 className="text-lg font-semibold text-[#112D4E]">6. Limitation of Liability</h2>
              <p>
                Courses and content are provided "as is" for educational reference. Alpha Academy makes no guarantees regarding financial returns, employment opportunities, or specific exam performance.
              </p>
            </section>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-8 text-center text-xs text-zinc-400 border-t border-[#DBE2EF] bg-white">
        <p>&copy; {new Date().getFullYear()} Alpha Academy. All rights reserved.</p>
      </footer>
    </div>
  );
}
