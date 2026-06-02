// src/app/page.tsx
'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/auth-context';
import {
  GraduationCap,
  ArrowRight,
  ShieldCheck,
  Zap,
  BookOpen,
  Award,
  Star
} from 'lucide-react';

export default function LandingPage() {
  const { user, profile, loading } = useAuth();

  return (
    <div className="relative flex min-h-screen flex-col bg-[#F9F7F7] text-[#112D4E] font-sans overflow-hidden">
      {/* Background ambient mesh glows */}
      <div className="absolute top-[-10%] left-[-10%] h-[600px] w-[600px] rounded-full bg-[#DBE2EF]/60 blur-[130px] pointer-events-none"></div>
      <div className="absolute top-[20%] right-[-10%] h-[600px] w-[600px] rounded-full bg-[#3F72AF]/10 blur-[130px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] left-[20%] h-[600px] w-[600px] rounded-full bg-[#DBE2EF]/40 blur-[130px] pointer-events-none"></div>

      {/* Header / Navbar */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-[#DBE2EF]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-white border border-[#DBE2EF] flex items-center justify-center text-[#3F72AF] shadow-sm">
              <GraduationCap className="h-5 w-5" />
            </div>
            <span className="font-bold text-lg bg-gradient-to-r from-[#112D4E] to-[#3F72AF] bg-clip-text text-transparent">
              Alpha Academy
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-zinc-500">
            <a href="#features" className="hover:text-[#112D4E] transition-colors">Features</a>
            <a href="#pricing" className="hover:text-[#112D4E] transition-colors">Pricing</a>
            <a href="#catalog" className="hover:text-[#112D4E] transition-colors">Syllabus</a>
          </nav>

          <div className="flex items-center gap-4">
            {loading ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#3F72AF] border-t-transparent"></div>
            ) : user && profile ? (
              <Link
                href="/dashboard"
                className="flex items-center gap-2 rounded-xl bg-[#3F72AF] hover:bg-[#3F72AF]/90 px-4 py-2 text-sm font-semibold text-white transition-all duration-300 shadow-md shadow-[#3F72AF]/10 group active:scale-[0.98]"
              >
                Go to Dashboard
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-sm font-semibold text-zinc-500 hover:text-[#112D4E] transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  href="/register"
                  className="rounded-xl bg-[#112D4E] border border-[#112D4E] px-4 py-2 text-sm font-semibold text-white hover:bg-[#112D4E]/90 transition-all duration-200 shadow-sm"
                >
                  Join Free
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="relative pt-24 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#3F72AF]/10 border border-[#3F72AF]/20 text-[#3F72AF] text-xs font-semibold mb-6">
            <Star className="h-3 w-3 fill-[#3F72AF] text-[#3F72AF]" />
            <span>Premium Study & Certification Platform</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight bg-gradient-to-b from-[#112D4E] to-[#112D4E]/80 bg-clip-text text-transparent max-w-4xl mx-auto leading-[1.1]">
            Master High-Value Skills & Accelerate Your Career
          </h1>
          <p className="mt-6 text-base sm:text-lg text-zinc-650 max-w-2xl mx-auto leading-relaxed">
            Gain verified professional expertise through dynamic, self-paced modules, interactive challenges, and official Paystack-secured certificates.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row justify-center items-center gap-4">
            <Link
              href={user ? "/dashboard" : "/register"}
              className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-[#3F72AF] hover:bg-[#3F72AF]/90 px-8 py-3.5 text-base font-bold text-white transition-all duration-300 shadow-xl shadow-[#3F72AF]/10 group active:scale-[0.98]"
            >
              Get Started Now
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Link>
            <a
              href="#features"
              className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-white border border-[#DBE2EF] hover:border-[#3F72AF]/40 hover:bg-[#F9F7F7] px-8 py-3.5 text-base font-bold text-[#112D4E] transition-all active:scale-[0.98] shadow-sm"
            >
              Explore Features
            </a>
          </div>

          {/* Social Proof */}
          <div className="mt-16 pt-10 border-t border-[#DBE2EF] grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto text-zinc-400 text-sm">
            <div className="flex flex-col items-center">
              <span className="text-2xl font-bold text-[#112D4E]">10k+</span>
              <span>Active Students</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-2xl font-bold text-[#112D4E]">50+</span>
              <span>Premium Modules</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-2xl font-bold text-[#112D4E]">99.8%</span>
              <span>Satisfaction Rate</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-2xl font-bold text-[#112D4E]">GH₵ 0</span>
              <span>Hidden Commitments</span>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-20 bg-white border-t border-[#DBE2EF]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <h2 className="text-3xl font-extrabold text-[#112D4E] tracking-tight">
                Supercharged Learning Experience
              </h2>
              <p className="mt-4 text-zinc-650">
                Everything you need to level up your engineering and financial capability in one sleek sandbox.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Feature 1 */}
              <div className="bg-[#F9F7F7]/50 border border-[#DBE2EF] hover:border-[#3F72AF]/40 rounded-2xl p-6 transition-all shadow-sm">
                <div className="h-10 w-10 rounded-lg bg-[#3F72AF]/10 border border-[#3F72AF]/20 flex items-center justify-center text-[#3F72AF] mb-5">
                  <BookOpen className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-bold text-[#112D4E] mb-2">Curated Industry Syllabus</h3>
                <p className="text-zinc-600 text-sm leading-relaxed">
                  Study system architecture, systems programming, and algorithmic trading written by veterans.
                </p>
              </div>

              {/* Feature 2 */}
              <div className="bg-[#F9F7F7]/50 border border-[#DBE2EF] hover:border-[#3F72AF]/40 rounded-2xl p-6 transition-all shadow-sm">
                <div className="h-10 w-10 rounded-lg bg-[#3F72AF]/10 border border-[#3F72AF]/20 flex items-center justify-center text-[#3F72AF] mb-5">
                  <Zap className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-bold text-[#112D4E] mb-2">Interactive Quiz Sandboxes</h3>
                <p className="text-zinc-600 text-sm leading-relaxed">
                  Validate knowledge immediately with live-grading code quizzes and algorithmic tasks.
                </p>
              </div>

              {/* Feature 3 */}
              <div className="bg-[#F9F7F7]/50 border border-[#DBE2EF] hover:border-[#3F72AF]/40 rounded-2xl p-6 transition-all shadow-sm">
                <div className="h-10 w-10 rounded-lg bg-[#3F72AF]/10 border border-[#3F72AF]/20 flex items-center justify-center text-[#3F72AF] mb-5">
                  <Award className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-bold text-[#112D4E] mb-2">Verified PDF Certificates</h3>
                <p className="text-zinc-600 text-sm leading-relaxed">
                  Earn cryptographically secured certificates to add directly to your LinkedIn and CV.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-t border-[#DBE2EF]">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl font-extrabold text-[#112D4E] tracking-tight">
              Flexible, Transparent Plans
            </h2>
            <p className="mt-4 text-zinc-650">
              Unlock the complete catalog or start exploring with our Free Tier.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Free Tier */}
            <div className="bg-white border border-[#DBE2EF] rounded-2xl p-8 space-y-6 flex flex-col justify-between shadow-sm">
              <div>
                <h3 className="text-xl font-bold text-[#112D4E]">Free Tier</h3>
                <p className="text-zinc-500 text-sm mt-1">Perfect for getting started</p>
                <div className="mt-6 flex items-baseline text-[#112D4E]">
                  <span className="text-4xl font-extrabold tracking-tight">GH₵ 0</span>
                  <span className="ml-1 text-sm text-zinc-400">/ forever</span>
                </div>
                <ul className="mt-8 space-y-3.5 text-zinc-600 text-sm">
                  <li className="flex items-center gap-2.5">
                    <ShieldCheck className="h-4.5 w-4.5 text-[#3F72AF] shrink-0" />
                    Access to introductory modules
                  </li>
                  <li className="flex items-center gap-2.5">
                    <ShieldCheck className="h-4.5 w-4.5 text-[#3F72AF] shrink-0" />
                    Basic progress statistics
                  </li>
                  <li className="flex items-center gap-2.5 text-zinc-400">
                    <ShieldCheck className="h-4.5 w-4.5 text-zinc-200 shrink-0" />
                    Interactive graded quizzes
                  </li>
                  <li className="flex items-center gap-2.5 text-zinc-400">
                    <ShieldCheck className="h-4.5 w-4.5 text-zinc-200 shrink-0" />
                    Verified PDF credentials
                  </li>
                </ul>
              </div>
              <Link
                href={user ? "/dashboard" : "/register"}
                className="w-full text-center rounded-xl bg-[#F9F7F7] border border-[#DBE2EF] hover:bg-[#DBE2EF]/30 py-3 text-sm font-bold text-[#112D4E] transition-all shadow-sm"
              >
                Join Free
              </Link>
            </div>

            {/* Premium Tier */}
            <div className="bg-white border-2 border-[#3F72AF] rounded-2xl p-8 space-y-6 flex flex-col justify-between relative shadow-lg">
              <div className="absolute top-0 right-8 transform -translate-y-1/2 rounded-full bg-[#3F72AF] px-3.5 py-1 text-xs font-bold text-white uppercase tracking-wider">
                Full Access
              </div>
              <div>
                <h3 className="text-xl font-bold text-[#112D4E]">Premium Membership</h3>
                <p className="text-[#3F72AF] text-sm mt-1 font-semibold">Unlock everything instantly</p>
                <div className="mt-6 flex items-baseline text-[#112D4E]">
                  <span className="text-4xl font-extrabold tracking-tight">GH₵ 50</span>
                  <span className="ml-1 text-sm text-zinc-400">/ month</span>
                </div>
                <ul className="mt-8 space-y-3.5 text-zinc-650 text-sm">
                  <li className="flex items-center gap-2.5">
                    <ShieldCheck className="h-4.5 w-4.5 text-[#3F72AF] shrink-0" />
                    Access all advanced modules
                  </li>
                  <li className="flex items-center gap-2.5">
                    <ShieldCheck className="h-4.5 w-4.5 text-[#3F72AF] shrink-0" />
                    Interactive quiz sandboxes
                  </li>
                  <li className="flex items-center gap-2.5">
                    <ShieldCheck className="h-4.5 w-4.5 text-[#3F72AF] shrink-0" />
                    Verified PDF credentials
                  </li>
                  <li className="flex items-center gap-2.5">
                    <ShieldCheck className="h-4.5 w-4.5 text-[#3F72AF] shrink-0" />
                    Save 16% on the annual pass
                  </li>
                </ul>
              </div>
              <Link
                href={user ? "/dashboard" : "/register"}
                className="w-full text-center rounded-xl bg-[#3F72AF] hover:bg-[#3F72AF]/90 py-3 text-sm font-bold text-white transition-all duration-300 shadow-md shadow-[#3F72AF]/10"
              >
                Go Premium
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-[#DBE2EF] py-12 text-center text-xs text-zinc-400 space-y-4">
        <div className="flex items-center justify-center gap-2.5 text-[#112D4E] font-bold text-sm">
          <GraduationCap className="h-4 w-4 text-[#3F72AF]" />
          <span>Alpha Academy</span>
        </div>
        <p>&copy; {new Date().getFullYear()} Alpha Academy. All rights reserved. Powered securely by Paystack.</p>
        <div className="flex items-center justify-center gap-4 text-xs font-medium">
          <Link href="/privacy" className="hover:text-[#112D4E] transition-colors">Privacy Policy</Link>
          <span className="text-zinc-200">•</span>
          <Link href="/terms" className="hover:text-[#112D4E] transition-colors">Terms of Service</Link>
        </div>
      </footer>
    </div>
  );
}
