// src/app/certificates/page.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard-layout';
import { useAuth } from '@/context/auth-context';
import { Award, Download, Share2, Compass, CheckCircle2, Calendar, ClipboardCheck, Loader2 } from 'lucide-react';
import type { Certificate } from '@/lib/types';

export default function CertificatesPage() {
  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/login');
      return;
    }

    async function fetchCertificates() {
      try {
        const response = await fetch('/api/v1/certificates');
        if (response.ok) {
          const data = await response.json();
          setCertificates(data.certificates || []);
        } else {
          console.error('Failed to load certificates');
        }
      } catch (err) {
        console.error('Network error loading certificates:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchCertificates();
  }, [user, authLoading, router]);

  const handleShare = (certId: string) => {
    // Generate shareable URL format
    const shareUrl = `${window.location.origin}/verify/${certId}`;
    navigator.clipboard.writeText(shareUrl);
    setCopiedId(certId);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '';
    // Handle both Firestore timestamp object and Javascript date
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp.seconds * 1000);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <DashboardLayout>
      <div className="p-6 md:p-10 space-y-8 font-sans max-w-6xl mx-auto pb-12">
        {/* Header Title */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-[#DBE2EF] pb-5">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-[#112D4E]">
              Verified Credentials
            </h1>
            <p className="text-zinc-500 text-sm mt-1">
              View, download, and share your earned professional completion certificates.
            </p>
          </div>
        </div>

        {/* LOADING STATE */}
        {loading || authLoading ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white border border-[#DBE2EF] rounded-3xl shadow-sm">
            <Loader2 className="h-10 w-10 text-[#3F72AF] animate-spin" />
            <p className="text-zinc-500 text-sm mt-4 animate-pulse">Loading certificates database...</p>
          </div>
        ) : certificates.length === 0 ? (
          /* EMPTY STATE */
          <div className="flex flex-col items-center justify-center text-center p-12 bg-white border border-[#DBE2EF] rounded-3xl shadow-sm max-w-2xl mx-auto space-y-6">
            <div className="relative">
              <div className="h-20 w-20 rounded-full bg-[#3F72AF]/5 border border-[#3F72AF]/10 flex items-center justify-center text-[#3F72AF]">
                <Award className="h-10 w-10 animate-pulse" />
              </div>
              <div className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-[#112D4E] border border-white flex items-center justify-center text-white text-xs font-bold shadow-md">
                0
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-extrabold text-[#112D4E]">No Credentials Earned Yet</h2>
              <p className="text-zinc-500 text-sm max-w-sm leading-relaxed">
                Complete all course lessons and pass the final exam assessment to generate your cryptographic certificate.
              </p>
            </div>
            <button
              onClick={() => router.push('/courses')}
              className="flex items-center gap-2 px-6 py-3 bg-[#3F72AF] hover:bg-[#3F72AF]/95 text-white font-bold text-sm rounded-xl transition-all shadow-md shadow-[#3F72AF]/10 cursor-pointer"
            >
              <Compass className="h-4.5 w-4.5" />
              Explore Study Pathways
            </button>
          </div>
        ) : (
          /* CERTIFICATES FOUND */
          <div className="space-y-6">
            {/* Quick stats banner */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 bg-white border border-[#DBE2EF] rounded-2xl p-6 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <div>
                  <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Completed</div>
                  <div className="text-xl font-black text-[#112D4E]">{certificates.length} Course{certificates.length > 1 ? 's' : ''}</div>
                </div>
              </div>
              <div className="flex items-center gap-4 border-t sm:border-t-0 sm:border-l border-[#DBE2EF] pt-4 sm:pt-0 sm:pl-6">
                <div className="h-12 w-12 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-500">
                  <Award className="h-6 w-6" />
                </div>
                <div>
                  <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Credentials</div>
                  <div className="text-xl font-black text-[#112D4E]">100% Verified</div>
                </div>
              </div>
              <div className="flex items-center gap-4 border-t sm:border-t-0 sm:border-l border-[#DBE2EF] pt-4 sm:pt-0 sm:pl-6">
                <div className="h-12 w-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-500">
                  <Calendar className="h-6 w-6" />
                </div>
                <div>
                  <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Active Learner</div>
                  <div className="text-xl font-black text-[#112D4E]">{profile?.totalPoints || 0} study pts</div>
                </div>
              </div>
            </div>

            {/* Grid of Certificates */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {certificates.map((cert) => (
                <div
                  key={cert.id}
                  className="bg-white border border-[#DBE2EF] rounded-3xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group"
                >
                  <div className="space-y-4">
                    {/* Visual Certificate Card Preview */}
                    <div className="relative aspect-[16/10] w-full rounded-2xl border border-zinc-200 bg-[#F9F7F7] overflow-hidden flex flex-col items-center justify-center p-4 text-center select-none shadow-inner group-hover:border-[#3F72AF]/40 transition-colors">
                      {/* Double gold border inside */}
                      <div className="absolute inset-2 border border-[#DBE2EF] pointer-events-none rounded-xl"></div>
                      <div className="absolute inset-2.5 border border-dashed border-[#DBE2EF] pointer-events-none rounded-xl"></div>

                      <div className="space-y-2 max-w-[85%]">
                        <Award className="h-10 w-10 text-[#3F72AF] mx-auto animate-pulse" />
                        <h4 className="font-extrabold text-xs tracking-widest text-[#112D4E] uppercase">
                          Certificate of Completion
                        </h4>
                        <p className="text-[9px] text-zinc-400">IS PROUDLY PRESENTED TO</p>
                        <h5 className="font-bold text-sm text-[#112D4E]">{cert.studentName}</h5>
                        <p className="text-[9px] text-zinc-400">FOR THE SUCCESSFUL MASTERY OF</p>
                        <h6 className="font-extrabold text-[11px] text-[#3F72AF] line-clamp-1">{cert.courseTitle}</h6>
                      </div>
                      
                      <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between text-[7px] text-zinc-400">
                        <span>ISSUED: {formatDate(cert.issuedAt)}</span>
                        <span>ID: {cert.id.substring(0, 12)}...</span>
                      </div>
                    </div>

                    {/* Meta Details */}
                    <div>
                      <h3 className="font-extrabold text-[#112D4E] group-hover:text-[#3F72AF] transition-colors leading-tight text-base">
                        {cert.courseTitle}
                      </h3>
                      <p className="text-zinc-400 text-xs mt-1 flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" />
                        Earned on {formatDate(cert.issuedAt)}
                      </p>
                    </div>
                  </div>

                  {/* Actions buttons */}
                  <div className="flex gap-3 mt-6 pt-4 border-t border-zinc-100">
                    <a
                      href={cert.downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#3F72AF] hover:bg-[#3F72AF]/95 text-white font-bold text-xs rounded-xl transition-all shadow-sm shadow-[#3F72AF]/10 cursor-pointer"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download PDF
                    </a>
                    <button
                      onClick={() => handleShare(cert.id)}
                      className="px-4 py-2.5 bg-zinc-50 border border-zinc-200 hover:bg-zinc-100 text-zinc-650 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                      title="Copy sharing link"
                    >
                      {copiedId === cert.id ? (
                        <>
                          <ClipboardCheck className="h-3.5 w-3.5 text-emerald-600 animate-scale-in" />
                          <span className="text-emerald-700">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Share2 className="h-3.5 w-3.5" />
                          <span>Share</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
