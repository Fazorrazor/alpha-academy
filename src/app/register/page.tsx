// src/app/register/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createUserWithEmailAndPassword, updateProfile, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '@/lib/firebase/client';
import { useAuth } from '@/context/auth-context';
import { GraduationCap, Mail, Lock, User, Eye, EyeOff, AlertCircle, ArrowRight } from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  const { user, profile, loading } = useAuth();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Auto-redirect if already authenticated and profile is synced
  useEffect(() => {
    if (user && profile) {
      router.push('/dashboard');
    }
  }, [user, profile, router]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !email || !password || !confirmPassword) {
      setErrorMsg('Please fill in all fields.');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      // Update display name on Firebase Auth client-side
      await updateProfile(userCredential.user, {
        displayName: fullName,
      });
      // AuthContext will capture onAuthStateChanged, synchronize cookies, and create Firestore doc
    } catch (err: unknown) {
      console.error('Registration error:', err);
      const error = err as { code?: string; message?: string };
      switch (error.code) {
        case 'auth/email-already-in-use':
          setErrorMsg('The email address is already in use by another account.');
          break;
        case 'auth/invalid-email':
          setErrorMsg('The email address is invalid.');
          break;
        case 'auth/weak-password':
          setErrorMsg('The password is too weak.');
          break;
        default:
          setErrorMsg(error.message || 'Failed to create an account.');
      }
      setIsSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      // AuthContext will automatically capture onAuthStateChanged and call /api/v1/auth/login
    } catch (err: unknown) {
      console.error('Google registration error:', err);
      const error = err as { code?: string; message?: string };
      if (error.code !== 'auth/popup-closed-by-user') {
        setErrorMsg(error.message || 'Failed to sign in with Google.');
      }
      setIsSubmitting(false);
    }
  };

  if (loading || (user && profile)) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#F9F7F7] text-[#112D4E]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#3F72AF] border-t-transparent"></div>
          <p className="text-[#3F72AF] text-sm font-medium animate-pulse">Setting up your profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#F9F7F7] px-4 py-12 font-sans sm:px-6 lg:px-8">
      {/* Decorative background glows */}
      <div className="absolute top-[-10%] right-[-10%] h-[500px] w-[500px] rounded-full bg-[#DBE2EF]/60 blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] left-[-10%] h-[500px] w-[500px] rounded-full bg-[#3F72AF]/10 blur-[120px] pointer-events-none"></div>

      <div className="w-full max-w-md space-y-8 relative z-10">
        {/* Branding logo & header */}
        <div className="flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white border border-[#DBE2EF] shadow-sm text-[#3F72AF] mb-4 transition-transform hover:scale-105 duration-300">
            <GraduationCap className="h-8 w-8" />
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-[#112D4E]">
            Create an Account
          </h2>
          <p className="mt-2 text-sm text-zinc-500">
            Join Alpha Academy to start your educational journey
          </p>
        </div>

        {/* Auth card */}
        <div className="bg-white border border-[#DBE2EF] rounded-2xl p-8 shadow-xl space-y-6">
          {errorMsg && (
            <div className="flex items-start gap-3 rounded-lg bg-red-50 border border-red-200 p-4 text-red-750 text-sm animate-shake">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Registration form */}
          <form className="space-y-4" onSubmit={handleRegister}>
            <div>
              <label htmlFor="fullName" className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
                Full Name
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-400">
                  <User className="h-5 w-5" />
                </span>
                <input
                  id="fullName"
                  name="fullName"
                  type="text"
                  required
                  placeholder="Kofi Mensah"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="block w-full rounded-xl border border-[#DBE2EF] bg-[#F9F7F7] py-2.5 pl-11 pr-4 text-[#112D4E] placeholder-zinc-400 focus:border-[#3F72AF] focus:ring-1 focus:ring-[#3F72AF]/30 outline-none transition-all duration-200 text-sm"
                />
              </div>
            </div>

            <div>
              <label htmlFor="email" className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
                Email Address
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-400">
                  <Mail className="h-5 w-5" />
                </span>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  placeholder="name@domain.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full rounded-xl border border-[#DBE2EF] bg-[#F9F7F7] py-2.5 pl-11 pr-4 text-[#112D4E] placeholder-zinc-400 focus:border-[#3F72AF] focus:ring-1 focus:ring-[#3F72AF]/30 outline-none transition-all duration-200 text-sm"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
                Password
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-400">
                  <Lock className="h-5 w-5" />
                </span>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full rounded-xl border border-[#DBE2EF] bg-[#F9F7F7] py-2.5 pl-11 pr-11 text-[#112D4E] placeholder-zinc-400 focus:border-[#3F72AF] focus:ring-1 focus:ring-[#3F72AF]/30 outline-none transition-all duration-200 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-zinc-400 hover:text-zinc-600"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
                Confirm Password
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-400">
                  <Lock className="h-5 w-5" />
                </span>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="block w-full rounded-xl border border-[#DBE2EF] bg-[#F9F7F7] py-2.5 pl-11 pr-4 text-[#112D4E] placeholder-zinc-400 focus:border-[#3F72AF] focus:ring-1 focus:ring-[#3F72AF]/30 outline-none transition-all duration-200 text-sm"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="relative flex w-full items-center justify-center rounded-xl bg-[#3F72AF] hover:bg-[#3F72AF]/90 py-3 px-4 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-[#3F72AF]/40 disabled:opacity-50 disabled:pointer-events-none transition-all duration-300 shadow-lg shadow-[#3F72AF]/10 group active:scale-[0.98] mt-2"
            >
              {isSubmitting ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
              ) : (
                <span className="flex items-center gap-2">
                  Create Account
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </span>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#DBE2EF]"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-3 text-zinc-400 font-semibold tracking-wider">
                Or Register With
              </span>
            </div>
          </div>

          {/* Google Sign In */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={isSubmitting}
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-[#DBE2EF] bg-[#F9F7F7] hover:bg-[#DBE2EF]/30 py-3 px-4 text-sm font-semibold text-[#112D4E] hover:text-[#112D4E]/90 transition-all duration-200 active:scale-[0.98] shadow-sm"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" width="24" height="24">
              <path
                fill="#EA4335"
                d="M5.266 9.765A7.077 7.077 0 0 1 12 4.909c1.69 0 3.218.6 4.418 1.582l3.51-3.51C17.642 1.091 14.974 0 12 0 7.354 0 3.307 2.69 1.268 6.627l3.998 3.138z"
              />
              <path
                fill="#4285F4"
                d="M23.64 12.273c0-.818-.073-1.609-.205-2.373H12v4.582h6.532a5.579 5.579 0 0 1-2.427 3.664l3.8 2.945c2.218-2.045 3.736-5.055 3.736-8.818z"
              />
              <path
                fill="#FBBC05"
                d="M5.266 14.235L1.268 17.37C3.307 21.31 7.354 24 12 24c2.973 0 5.68-.982 7.625-2.655l-3.8-2.945a7.127 7.127 0 0 1-3.825 1.064c-3.155 0-5.836-2.145-6.734-5.23z"
              />
              <path
                fill="#34A853"
                d="M12 4.909c1.864 0 3.536.636 4.855 1.836l3.527-3.527C18.155 1.155 15.318 0 12 0 7.355 0 3.309 2.691 1.268 6.627l3.998 3.138C6.164 6.736 8.845 4.909 12 4.909z"
              />
            </svg>
            Register with Google
          </button>
        </div>

        {/* Under Card Links */}
        <p className="text-center text-sm text-zinc-500">
          Already have an account?{' '}
          <Link
            href="/login"
            className="font-semibold text-[#3F72AF] hover:text-[#3F72AF]/85 transition-colors"
          >
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}
