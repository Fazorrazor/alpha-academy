// src/app/settings/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard-layout';
import { useAuth } from '@/context/auth-context';
import { db, auth as clientAuth } from '@/lib/firebase/client';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { User, CreditCard, Lock, Save, Loader2, CheckCircle2, AlertTriangle, ShieldAlert, Sparkles } from 'lucide-react';

type TabType = 'profile' | 'billing' | 'security';

export default function SettingsPage() {
  const router = useRouter();
  const { user, profile, loading: authLoading, refreshProfile } = useAuth();

  const [activeTab, setActiveTab] = useState<TabType>('profile');
  
  // Profile state
  const [displayName, setDisplayName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileError, setProfileError] = useState('');

  // Security state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [securitySaving, setSecuritySaving] = useState(false);
  const [securitySuccess, setSecuritySuccess] = useState(false);
  const [securityError, setSecurityError] = useState('');

  // Billing state
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingSuccess, setBillingSuccess] = useState(false);
  const [billingError, setBillingError] = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/login');
      return;
    }

    if (profile) {
      setDisplayName(profile.displayName || '');
      setPhoneNumber(profile.phoneNumber || '');
    }
  }, [user, authLoading, profile, router]);

  // Handle Profile Update
  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;

    setProfileSaving(true);
    setProfileSuccess(false);
    setProfileError('');

    try {
      // 1. Update Firestore Profile Document directly (allowed by rules for owner)
      const profileRef = doc(db, 'profiles', user.uid);
      await updateDoc(profileRef, {
        displayName: displayName.trim(),
        phoneNumber: phoneNumber.trim() || null,
        updatedAt: new Date(),
      });

      // 2. Refresh local state
      await refreshProfile();
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 3000);
    } catch (err: any) {
      console.error('Error saving profile:', err);
      setProfileError(err.message || 'Failed to save profile. Please try again.');
    } finally {
      setProfileSaving(false);
    }
  };

  // Handle Password Update
  const handlePasswordSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !clientAuth.currentUser) return;

    if (newPassword !== confirmPassword) {
      setSecurityError('New passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      setSecurityError('Password must be at least 6 characters long');
      return;
    }

    setSecuritySaving(true);
    setSecuritySuccess(false);
    setSecurityError('');

    try {
      const email = user.email;
      if (!email) {
        throw new Error('User email not found. Cannot re-authenticate.');
      }

      // Re-authenticate user before updating password (standard Firebase Auth requirement)
      const credential = EmailAuthProvider.credential(email, currentPassword);
      await reauthenticateWithCredential(clientAuth.currentUser, credential);

      // Update password
      await updatePassword(clientAuth.currentUser, newPassword);

      setSecuritySuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setSecuritySuccess(false), 3000);
    } catch (err: any) {
      console.error('Error updating password:', err);
      if (err.code === 'auth/wrong-password') {
        setSecurityError('Current password is incorrect.');
      } else if (err.code === 'auth/requires-recent-login') {
        setSecurityError('For safety, this action requires you to log out and log back in before retrying.');
      } else {
        setSecurityError(err.message || 'Password update failed. Please verify credentials.');
      }
    } finally {
      setSecuritySaving(false);
    }
  };

  // Handle Cancel Subscription
  const handleCancelSubscription = async () => {
    if (!confirm('Are you sure you want to cancel your premium subscription? You will still retain access until the end of your billing cycle.')) {
      return;
    }

    setBillingLoading(true);
    setBillingSuccess(false);
    setBillingError('');

    try {
      const response = await fetch('/api/v1/subscriptions/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();

      if (response.ok && data.status === 'success') {
        setBillingSuccess(true);
        await refreshProfile();
      } else {
        setBillingError(data.message || 'Failed to cancel subscription.');
      }
    } catch (err) {
      console.error('Error cancelling subscription:', err);
      setBillingError('A network error occurred. Please check your connection.');
    } finally {
      setBillingLoading(false);
    }
  };

  // Format subscription dates
  const formatExpiryDate = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp.seconds * 1000);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <DashboardLayout>
      <div className="p-6 md:p-10 space-y-8 font-sans max-w-4xl mx-auto pb-12">
        {/* Header */}
        <div className="border-b border-[#DBE2EF] pb-5">
          <h1 className="text-2xl font-extrabold tracking-tight text-[#112D4E]">
            Account Settings
          </h1>
          <p className="text-zinc-500 text-sm mt-1">
            Manage your personal profile, credentials password security, and active billing subscription.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-[#DBE2EF] gap-6">
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-2 pb-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'profile'
                ? 'border-[#3F72AF] text-[#3F72AF]'
                : 'border-transparent text-zinc-400 hover:text-zinc-650'
            }`}
          >
            <User className="h-4.5 w-4.5" />
            Profile Details
          </button>
          <button
            onClick={() => setActiveTab('billing')}
            className={`flex items-center gap-2 pb-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'billing'
                ? 'border-[#3F72AF] text-[#3F72AF]'
                : 'border-transparent text-zinc-400 hover:text-zinc-650'
            }`}
          >
            <CreditCard className="h-4.5 w-4.5" />
            Billing & Subscription
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`flex items-center gap-2 pb-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'security'
                ? 'border-[#3F72AF] text-[#3F72AF]'
                : 'border-transparent text-zinc-400 hover:text-zinc-650'
            }`}
          >
            <Lock className="h-4.5 w-4.5" />
            Password Security
          </button>
        </div>

        {/* TAB CONTENTS */}

        {/* 1. PROFILE DETAILS */}
        {activeTab === 'profile' && (
          <div className="bg-white border border-[#DBE2EF] rounded-3xl p-8 shadow-sm animate-fade-in">
            <h2 className="text-lg font-extrabold text-[#112D4E] mb-6">Personal Information</h2>
            
            <form onSubmit={handleProfileSave} className="space-y-6">
              {profileSuccess && (
                <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl text-sm animate-scale-in">
                  <CheckCircle2 className="h-4.5 w-4.5 text-emerald-600" />
                  <span>Profile updated successfully!</span>
                </div>
              )}

              {profileError && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-650 px-4 py-3 rounded-xl text-sm animate-scale-in">
                  <ShieldAlert className="h-4.5 w-4.5" />
                  <span>{profileError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block">
                    Full Name (Appears on Certificate)
                  </label>
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full px-4 py-3 border border-[#DBE2EF] rounded-xl text-sm focus:outline-none focus:border-[#3F72AF] bg-[#F9F7F7] focus:bg-white transition-all text-[#112D4E]"
                    placeholder="Enter your full name"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block">
                    Contact Phone Number
                  </label>
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="w-full px-4 py-3 border border-[#DBE2EF] rounded-xl text-sm focus:outline-none focus:border-[#3F72AF] bg-[#F9F7F7] focus:bg-white transition-all text-[#112D4E]"
                    placeholder="e.g. +233 24 000 0000"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-400 uppercase block select-none">
                    Email Address (Read-Only)
                  </label>
                  <input
                    type="email"
                    disabled
                    value={user?.email || ''}
                    className="w-full px-4 py-3 border border-[#DBE2EF]/60 rounded-xl text-sm bg-zinc-50 text-zinc-400 cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-zinc-100 flex justify-end">
                <button
                  type="submit"
                  disabled={profileSaving}
                  className="flex items-center justify-center gap-2 px-6 py-3 bg-[#3F72AF] hover:bg-[#3F72AF]/95 text-white font-bold text-sm rounded-xl transition-all shadow-md shadow-[#3F72AF]/10 disabled:bg-[#3F72AF]/50 cursor-pointer"
                >
                  {profileSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Saving Details...</span>
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      <span>Save Profile</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* 2. BILLING & SUBSCRIPTION */}
        {activeTab === 'billing' && (
          <div className="bg-white border border-[#DBE2EF] rounded-3xl p-8 shadow-sm animate-fade-in space-y-8">
            <div>
              <h2 className="text-lg font-extrabold text-[#112D4E]">Subscription Management</h2>
              <p className="text-zinc-500 text-xs mt-1">Review your payment records and manage your premium billing cycles.</p>
            </div>

            {billingSuccess && (
              <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-250 text-emerald-700 px-4 py-3 rounded-xl text-sm animate-scale-in">
                <CheckCircle2 className="h-4.5 w-4.5 text-emerald-600" />
                <span>Subscription cancelled successfully. You retains access until the end of billing cycle.</span>
              </div>
            )}

            {billingError && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-650 px-4 py-3 rounded-xl text-sm animate-scale-in">
                <AlertTriangle className="h-4.5 w-4.5" />
                <span>{billingError}</span>
              </div>
            )}

            {/* Current Plan Summary Card */}
            {profile?.subscription === 'active' && (
              <div className="border border-[#DBE2EF] rounded-2xl p-6 bg-gradient-to-br from-white to-[#F9F7F7] flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="space-y-3">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-100 rounded-full text-emerald-600 text-xs font-bold">
                    <Sparkles className="h-3 w-3 animate-pulse text-amber-500 fill-amber-400" />
                    <span>Active Subscription</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-[#112D4E]">
                      Alpha Academy {profile.subscriptionPlan === 'annual' ? 'Annual Pass' : 'Monthly Pass'}
                    </h3>
                    <p className="text-zinc-400 text-xs mt-1">
                      Billing renews automatically. Next charge on{' '}
                      <strong className="text-zinc-650">{formatExpiryDate(profile.subscriptionExpiresAt)}</strong>
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleCancelSubscription}
                  disabled={billingLoading}
                  className="px-5 py-2.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-650 font-bold text-xs rounded-xl transition-all disabled:opacity-50 cursor-pointer"
                >
                  {billingLoading ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Processing...
                    </span>
                  ) : (
                    'Cancel Subscription'
                  )}
                </button>
              </div>
            )}

            {profile?.subscription === 'cancelled' && (
              <div className="border border-amber-200 rounded-2xl p-6 bg-amber-50/30 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-100 rounded-full text-amber-600 text-xs font-bold">
                    <AlertTriangle className="h-3 w-3" />
                    <span>Cancelled - Expiring Soon</span>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#112D4E]">
                      Premium Subscription Cancelled
                    </h3>
                    <p className="text-zinc-550 text-xs mt-1">
                      Your access remains active until{' '}
                      <strong>{formatExpiryDate(profile.subscriptionExpiresAt)}</strong>. After this, your account will fall back to the Free Tier.
                    </p>
                  </div>
                </div>
                
                <button
                  onClick={() => router.push('/dashboard')}
                  className="px-5 py-2.5 bg-[#3F72AF] hover:bg-[#3F72AF]/95 text-white font-bold text-xs rounded-xl transition-all cursor-pointer"
                >
                  Renew Subscription
                </button>
              </div>
            )}

            {(profile?.subscription === 'none' || profile?.subscription === 'expired' || !profile?.subscription) && (
              <div className="border border-[#DBE2EF] rounded-2xl p-8 bg-zinc-50 text-center max-w-md mx-auto space-y-4">
                <div className="h-12 w-12 rounded-full bg-zinc-100 flex items-center justify-center mx-auto text-zinc-400">
                  <CreditCard className="h-6 w-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-[#112D4E]">No Active Premium Pass</h3>
                  <p className="text-zinc-400 text-xs leading-relaxed">
                    You are currently using the Free Tier. Upgrade to access all courses, completion certificates, and instructor support.
                  </p>
                </div>
                <button
                  onClick={() => router.push('/dashboard')}
                  className="px-6 py-2.5 bg-[#3F72AF] hover:bg-[#3F72AF]/95 text-white font-bold text-xs rounded-xl transition-all shadow-sm cursor-pointer"
                >
                  Choose a Plan
                </button>
              </div>
            )}
          </div>
        )}

        {/* 3. PASSWORD SECURITY */}
        {activeTab === 'security' && (
          <div className="bg-white border border-[#DBE2EF] rounded-3xl p-8 shadow-sm animate-fade-in">
            <h2 className="text-lg font-extrabold text-[#112D4E] mb-6">Password Settings</h2>

            <form onSubmit={handlePasswordSave} className="space-y-6">
              {securitySuccess && (
                <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-250 text-emerald-700 px-4 py-3 rounded-xl text-sm animate-scale-in">
                  <CheckCircle2 className="h-4.5 w-4.5 text-emerald-600" />
                  <span>Password updated successfully!</span>
                </div>
              )}

              {securityError && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-650 px-4 py-3 rounded-xl text-sm animate-scale-in">
                  <AlertTriangle className="h-4.5 w-4.5" />
                  <span>{securityError}</span>
                </div>
              )}

              <div className="space-y-4 max-w-md">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block">
                    Current Password
                  </label>
                  <input
                    type="password"
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full px-4 py-3 border border-[#DBE2EF] rounded-xl text-sm focus:outline-none focus:border-[#3F72AF] bg-[#F9F7F7] focus:bg-white transition-all text-[#112D4E]"
                    placeholder="Enter current password"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block">
                    New Password
                  </label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-4 py-3 border border-[#DBE2EF] rounded-xl text-sm focus:outline-none focus:border-[#3F72AF] bg-[#F9F7F7] focus:bg-white transition-all text-[#112D4E]"
                    placeholder="Minimum 6 characters"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-3 border border-[#DBE2EF] rounded-xl text-sm focus:outline-none focus:border-[#3F72AF] bg-[#F9F7F7] focus:bg-white transition-all text-[#112D4E]"
                    placeholder="Retype new password"
                  />
                </div>
              </div>

              <div className="pt-6 border-t border-zinc-100 flex justify-end">
                <button
                  type="submit"
                  disabled={securitySaving}
                  className="flex items-center justify-center gap-2 px-6 py-3 bg-[#112D4E] hover:bg-[#112D4E]/95 text-white font-bold text-sm rounded-xl transition-all shadow-md disabled:opacity-50 cursor-pointer"
                >
                  {securitySaving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Updating...</span>
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      <span>Update Password</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
