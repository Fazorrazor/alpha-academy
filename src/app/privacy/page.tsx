// src/app/privacy/page.tsx
'use client';

import React from 'react';
import Link from 'next/link';
import { GraduationCap, ArrowLeft, Shield } from 'lucide-react';

export default function PrivacyPolicyPage() {
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
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#112D4E]">Privacy Policy</h1>
              <p className="text-xs text-zinc-400 mt-1">Effective Date: June 1, 2026</p>
            </div>
          </div>

          <div className="space-y-6 text-sm text-zinc-650 leading-relaxed">
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-[#112D4E]">1. Information We Collect</h2>
              <p>
                We collect personal information when you create an account, enroll in courses, or purchase subscriptions. 
                This includes your name, email address, phone number, and password hash (managed securely via Firebase Auth). 
                We also track your course enrollment status, progress timestamps, and quiz results to manage study records.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-[#112D4E]">2. Payment Processing</h2>
              <p>
                All subscription payments are handled securely by **Paystack**. Alpha Academy does not store or have direct access to your credit/debit card numbers or bank credentials. Paystack processes transaction information in accordance with PCI-DSS standards.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-[#112D4E]">3. How We Use Your Data</h2>
              <p>
                We use your data to provide access to restricted educational resources, calculate rankings for the peer leaderboard, send transactional notifications (welcome messages, subscription alerts via Resend and Termii), and issue verified PDF certificates upon course completion.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-[#112D4E]">4. Data Protection and Retention</h2>
              <p>
                We store your data within industry-standard Google Cloud / Firebase database services, protected by custom server-side security rules. Your profile remains active until you request account deletion.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-[#112D4E]">5. Third-Party Integrations</h2>
              <p>
                We share essential data with specific third-party providers required to operate the academy:
              </p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li><strong>Firebase Auth:</strong> User identity management.</li>
                <li><strong>Paystack:</strong> Payment collection and subscription tokenization.</li>
                <li><strong>Mux:</strong> Secure streaming of premium video content.</li>
                <li><strong>Resend / Termii:</strong> Delivery of confirmation emails and OTP/reminder SMS.</li>
              </ul>
            </section>

            <section className="space-y-3 pb-4">
              <h2 className="text-lg font-semibold text-[#112D4E]">6. Your Rights</h2>
              <p>
                You may request access to, correction of, or permanent deletion of your profile and progress data at any time by contacting our support desk.
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
