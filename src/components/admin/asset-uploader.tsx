'use client';

import React, { useCallback, useRef, useState } from 'react';
import { Upload, FileText, Video, CheckCircle2, AlertCircle, X, Loader2 } from 'lucide-react';

export type AssetType = 'video' | 'pdf';

export interface UploadResult {
  type: AssetType;
  // pdf
  storagePath?: string;
  // video
  muxUploadId?: string;
  // shared
  filename: string;
}

interface AssetUploaderProps {
  courseId: string;
  type: AssetType;
  onUploadComplete: (result: UploadResult) => void;
  onUploadError?: (message: string) => void;
}

type UploadState = 'idle' | 'requesting' | 'uploading' | 'done' | 'error';

const ACCEPT: Record<AssetType, string> = {
  video: 'video/mp4,video/quicktime,video/webm,video/x-m4v',
  pdf: 'application/pdf',
};

const MAX_SIZE: Record<AssetType, number> = {
  video: 2 * 1024 * 1024 * 1024, // 2 GB
  pdf: 50 * 1024 * 1024,          // 50 MB
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export default function AssetUploader({
  courseId,
  type,
  onUploadComplete,
  onUploadError,
}: AssetUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<UploadState>('idle');
  const [progress, setProgress] = useState(0);
  const [filename, setFilename] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const reset = () => {
    setState('idle');
    setProgress(0);
    setFilename(null);
    setFileSize(null);
    setErrorMsg(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleError = (msg: string) => {
    setState('error');
    setErrorMsg(msg);
    onUploadError?.(msg);
  };

  const uploadFile = useCallback(
    async (file: File) => {
      // Validate size
      if (file.size > MAX_SIZE[type]) {
        handleError(
          `File too large. Maximum size is ${formatBytes(MAX_SIZE[type])}.`
        );
        return;
      }

      setFilename(file.name);
      setFileSize(formatBytes(file.size));
      setState('requesting');
      setProgress(0);

      try {
        // Step 1 — Get signed upload URL from our backend
        const res = await fetch('/api/v1/admin/upload-asset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type, filename: file.name, courseId }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Failed to get upload URL');
        }

        const data = await res.json();

        // Step 2 — Upload directly to the provider
        setState('uploading');

        if (type === 'pdf') {
          // Cloud Storage signed POST policy
          const formData = new FormData();
          const policy = data.uploadUrl as {
            url: string;
            fields: Record<string, string>;
          };

          // If it's a plain URL string (emulator mock or simple signed URL)
          if (typeof policy === 'string') {
            await fetch(policy, {
              method: 'PUT',
              body: file,
              headers: { 'Content-Type': 'application/pdf' },
            });
          } else {
            // Real signed POST policy
            Object.entries(policy.fields || {}).forEach(([k, v]) => {
              formData.append(k, v);
            });
            formData.append('file', file);
            await fetch(policy.url, { method: 'POST', body: formData });
          }

          setProgress(100);
          setState('done');
          onUploadComplete({
            type: 'pdf',
            storagePath: data.storagePath,
            filename: file.name,
          });
        } else {
          // Mux direct upload — plain PUT to their presigned URL
          // Use XMLHttpRequest for progress tracking
          await new Promise<void>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('PUT', data.uploadUrl);
            xhr.setRequestHeader('Content-Type', file.type || 'video/mp4');

            xhr.upload.onprogress = (e) => {
              if (e.lengthComputable) {
                setProgress(Math.round((e.loaded / e.total) * 100));
              }
            };

            xhr.onload = () => {
              if (xhr.status >= 200 && xhr.status < 300) {
                resolve();
              } else {
                reject(new Error(`Upload failed: ${xhr.statusText}`));
              }
            };

            xhr.onerror = () => reject(new Error('Network error during upload'));
            xhr.send(file);
          });

          setProgress(100);
          setState('done');
          onUploadComplete({
            type: 'video',
            muxUploadId: data.muxUploadId,
            filename: file.name,
          });
        }
      } catch (err: unknown) {
        handleError(
          err instanceof Error ? err.message : 'An unexpected error occurred'
        );
      }
    },
    [courseId, type, onUploadComplete, onUploadError]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  };

  const Icon = type === 'video' ? Video : FileText;
  const label = type === 'video' ? 'video file' : 'PDF';
  const acceptedTypes = type === 'video' ? 'MP4, MOV, WebM' : 'PDF';
  const maxSizeLabel = type === 'video' ? '2 GB' : '50 MB';

  // ── DONE ─────────────────────────────────────────────────────────────────
  if (state === 'done') {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 bg-emerald-100 rounded-xl flex items-center justify-center shrink-0">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-emerald-800 truncate max-w-[200px]">
              {filename}
            </p>
            <p className="text-xs text-emerald-600 mt-0.5">
              {type === 'video'
                ? 'Upload complete — Mux is processing your video'
                : `Upload complete — ${fileSize}`}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={reset}
          className="p-1.5 rounded-lg text-emerald-400 hover:text-emerald-700 hover:bg-emerald-100 transition-colors"
          title="Upload a different file"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  // ── ERROR ─────────────────────────────────────────────────────────────────
  if (state === 'error') {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 bg-red-100 rounded-xl flex items-center justify-center shrink-0">
            <AlertCircle className="h-5 w-5 text-red-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-red-800">Upload failed</p>
            <p className="text-xs text-red-600 mt-0.5">{errorMsg}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={reset}
          className="p-1.5 rounded-lg text-red-400 hover:text-red-700 hover:bg-red-100 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  // ── UPLOADING / REQUESTING ─────────────────────────────────────────────────
  if (state === 'uploading' || state === 'requesting') {
    return (
      <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 bg-indigo-100 rounded-xl flex items-center justify-center shrink-0">
            <Loader2 className="h-5 w-5 text-indigo-600 animate-spin" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-indigo-800 truncate">
              {filename}
            </p>
            <p className="text-xs text-indigo-600 mt-0.5">
              {state === 'requesting' ? 'Preparing upload…' : `Uploading… ${progress}%`}
            </p>
          </div>
        </div>
        <div className="w-full bg-indigo-200 rounded-full h-1.5 overflow-hidden">
          <div
            className="bg-indigo-600 h-1.5 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    );
  }

  // ── IDLE ─────────────────────────────────────────────────────────────────
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`rounded-xl border-2 border-dashed p-6 text-center cursor-pointer transition-all duration-200 ${
        isDragOver
          ? 'border-indigo-400 bg-indigo-50 scale-[1.01]'
          : 'border-zinc-200 bg-zinc-50 hover:border-indigo-300 hover:bg-indigo-50/50'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT[type]}
        onChange={handleFileChange}
        className="hidden"
      />
      <div className={`mx-auto h-12 w-12 rounded-2xl flex items-center justify-center mb-3 transition-colors ${
        isDragOver ? 'bg-indigo-100' : 'bg-zinc-100'
      }`}>
        <Icon className={`h-6 w-6 transition-colors ${isDragOver ? 'text-indigo-600' : 'text-zinc-400'}`} />
      </div>
      <p className={`text-sm font-semibold transition-colors ${isDragOver ? 'text-indigo-700' : 'text-zinc-700'}`}>
        Drop your {label} here
      </p>
      <p className="text-xs text-zinc-400 mt-1">
        or <span className="text-indigo-600 underline underline-offset-2">browse to choose</span>
      </p>
      <p className="text-[11px] text-zinc-400 mt-2">
        {acceptedTypes} · Max {maxSizeLabel}
      </p>
    </div>
  );
}
