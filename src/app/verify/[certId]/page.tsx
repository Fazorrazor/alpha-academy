// src/app/verify/[certId]/page.tsx
'use client';

import React, { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Award, Calendar, Download, AlertTriangle, Loader2, GraduationCap } from 'lucide-react';

interface VerificationData {
  id: string;
  courseTitle: string;
  studentName: string;
  issuedAt: {
    seconds: number;
    nanoseconds: number;
  };
  downloadUrl: string;
}

export default function VerifyCertificatePage({
  params,
}: {
  params: Promise<{ certId: string }>;
}) {
  const router = useRouter();
  const { certId } = use(params);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [certData, setCertData] = useState<VerificationData | null>(null);

  useEffect(() => {
    async function verifyCredential() {
      try {
        const response = await fetch(`/api/v1/certificates/verify/${certId}`);
        const data = await response.json();
        
        if (response.ok && data.status === 'success') {
          setCertData(data.verification);
        } else {
          setError(data.message || 'The requested completion certificate does not exist or has expired.');
        }
      } catch (err) {
        console.error('Failed to verify credential:', err);
        setError('A connection error occurred. Please try again.');
      } finally {
        setLoading(false);
      }
    }

    if (certId) {
      verifyCredential();
    }
  }, [certId]);

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '';
    const date = new Date(timestamp.seconds * 1000);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="min-h-screen bg-[#F9F7F7] flex flex-col items-center justify-center px-4 font-sans text-[#112D4E]">
      <div className="w-full max-w-lg bg-white border border-[#DBE2EF] rounded-3xl p-8 shadow-lg relative overflow-hidden text-center">
        {/* Header decoration */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 to-[#3F72AF]"></div>

        {/* Brand header */}
        <div className="flex items-center justify-center gap-2 mb-10 select-none">
          <div className="h-8 w-8 rounded-lg bg-[#F9F7F7] border border-[#DBE2EF] flex items-center justify-center text-[#3F72AF] shadow-sm">
            <GraduationCap className="h-4.5 w-4.5" />
          </div>
          <span className="font-bold text-base bg-gradient-to-r from-[#112D4E] to-[#3F72AF] bg-clip-text text-transparent">
            Alpha Academy
          </span>
        </div>

        {/* LOADING STATE */}
        {loading && (
          <div className="space-y-4 py-8 animate-pulse">
            <Loader2 className="h-12 w-12 text-[#3F72AF] animate-spin mx-auto" />
            <p className="text-zinc-550 text-sm font-semibold">Verifying cryptographic credential...</p>
          </div>
        )}

        {/* ERROR STATE */}
        {!loading && error && (
          <div className="space-y-6 py-6">
            <div className="h-16 w-16 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto text-amber-500">
              <AlertTriangle className="h-9 w-9 animate-bounce" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-extrabold text-[#112D4E]">Credential Not Found</h2>
              <p className="text-zinc-500 text-sm leading-relaxed max-w-sm mx-auto">
                {error}
              </p>
            </div>
            <div className="pt-6">
              <button
                onClick={() => router.push('/')}
                className="px-6 py-2.5 bg-[#112D4E] hover:bg-[#112D4E]/95 text-white font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Go to Homepage
              </button>
            </div>
          </div>
        )}

        {/* SUCCESS VERIFIED STATE */}
        {!loading && certData && (
          <div className="space-y-8 animate-scale-in">
            {/* Status indicator */}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-250 rounded-full text-emerald-700 text-xs font-bold shadow-sm">
              <ShieldCheck className="h-4.5 w-4.5 text-emerald-600 animate-pulse" />
              <span>Verified Course Credential</span>
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Recipient Student</p>
                <h2 className="text-2xl font-black tracking-tight text-[#112D4E]">
                  {certData.studentName}
                </h2>
              </div>

              <div className="h-[1px] w-24 bg-zinc-200 mx-auto"></div>

              <div className="space-y-1">
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Course Completed</p>
                <h3 className="text-lg font-extrabold text-[#3F72AF] max-w-sm mx-auto leading-tight">
                  {certData.courseTitle}
                </h3>
              </div>
            </div>

            {/* Metadatas */}
            <div className="grid grid-cols-2 gap-4 bg-[#F9F7F7] border border-[#DBE2EF] rounded-2xl p-4 text-left max-w-sm mx-auto">
              <div>
                <span className="text-[9px] font-bold text-zinc-400 uppercase block">Issuance Date</span>
                <span className="text-xs font-bold text-[#112D4E] flex items-center gap-1 mt-0.5">
                  <Calendar className="h-3.5 w-3.5 text-zinc-500" />
                  {formatDate(certData.issuedAt)}
                </span>
              </div>
              <div>
                <span className="text-[9px] font-bold text-zinc-400 uppercase block">Credential ID</span>
                <span className="text-xs font-bold text-[#112D4E] block truncate mt-0.5" title={certData.id}>
                  {certData.id.substring(0, 16)}...
                </span>
              </div>
            </div>

            {/* Download Certificate link */}
            <div className="pt-4 space-y-4">
              <a
                href={certData.downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full max-w-sm mx-auto flex items-center justify-center gap-2 py-3 bg-[#3F72AF] hover:bg-[#3F72AF]/95 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-[#3F72AF]/10 cursor-pointer"
              >
                <Download className="h-4 w-4" />
                Download Original PDF Certificate
              </a>
              
              <div className="text-[11px] text-zinc-400 pt-2 leading-relaxed">
                This digital credential is officially secured and verified by the Alpha Academy registration engine.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer promotion */}
      <div className="mt-8 text-center text-xs text-zinc-500">
        Want to build certified skills?{' '}
        <button
          onClick={() => router.push('/login')}
          className="text-[#3F72AF] hover:underline font-bold bg-transparent border-0 cursor-pointer"
        >
          Join Alpha Academy Today
        </button>
      </div>
    </div>
  );
}
