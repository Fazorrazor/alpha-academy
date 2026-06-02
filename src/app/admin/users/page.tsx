'use client';

import React, { useState, useEffect, useCallback } from 'react';
import AdminLayout from '@/components/admin-layout';
import {
  Users, Search, ShieldOff, Shield, AlertCircle,
  ChevronDown, Loader2, BadgeCheck, Clock, XCircle,
  Crown, Mail, Calendar, Star
} from 'lucide-react';

interface AdminUser {
  uid: string;
  email: string | null;
  displayName: string;
  photoURL: string | null;
  role: 'student' | 'admin';
  subscription: 'active' | 'expired' | 'cancelled' | 'trial' | 'none';
  subscriptionPlan: 'monthly' | 'annual' | null;
  subscriptionExpiresAt: { seconds: number } | null;
  totalPoints: number;
  suspended: boolean;
  createdAt: { seconds: number } | null;
}

const SUBSCRIPTION_FILTERS = [
  { label: 'All Users', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Expired', value: 'expired' },
  { label: 'No Subscription', value: 'none' },
];

function SubscriptionBadge({ status }: { status: AdminUser['subscription'] }) {
  const map: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    active: {
      label: 'Active',
      color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      icon: <BadgeCheck className="h-3 w-3" />,
    },
    expired: {
      label: 'Expired',
      color: 'bg-red-50 text-red-600 border-red-200',
      icon: <Clock className="h-3 w-3" />,
    },
    cancelled: {
      label: 'Cancelled',
      color: 'bg-zinc-100 text-zinc-500 border-zinc-200',
      icon: <XCircle className="h-3 w-3" />,
    },
    trial: {
      label: 'Trial',
      color: 'bg-blue-50 text-blue-600 border-blue-200',
      icon: <Star className="h-3 w-3" />,
    },
    none: {
      label: 'No Sub',
      color: 'bg-zinc-100 text-zinc-500 border-zinc-200',
      icon: <XCircle className="h-3 w-3" />,
    },
  };

  const badge = map[status] ?? map['none'];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold uppercase rounded-full border ${badge.color}`}>
      {badge.icon}
      {badge.label}
    </span>
  );
}

function Avatar({ user }: { user: AdminUser }) {
  const initials = user.displayName
    ? user.displayName.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
    : (user.email?.[0] ?? '?').toUpperCase();

  if (user.photoURL) {
    return (
      <img
        src={user.photoURL}
        alt={user.displayName}
        className="h-10 w-10 rounded-full object-cover border-2 border-white shadow-sm"
      />
    );
  }

  return (
    <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center border-2 border-white shadow-sm shrink-0">
      <span className="text-indigo-700 text-xs font-bold">{initials}</span>
    </div>
  );
}

function formatDate(ts: { seconds: number } | null): string {
  if (!ts) return '—';
  return new Date(ts.seconds * 1000).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [suspending, setSuspending] = useState<string | null>(null);

  const fetchUsers = useCallback(async (subscriptionFilter: string) => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(
        `/api/v1/admin/users?subscription=${subscriptionFilter}&limit=100`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load users');
      setUsers(data.users || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers(filter);
  }, [filter, fetchUsers]);

  const handleSuspend = async (uid: string, currentlySuspended: boolean) => {
    const action = currentlySuspended ? 'unsuspend' : 'suspend';
    if (!confirm(`Are you sure you want to ${action} this user?`)) return;

    setSuspending(uid);
    try {
      const res = await fetch(`/api/v1/admin/users/${uid}/suspend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suspended: !currentlySuspended }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update suspension');

      setUsers((prev) =>
        prev.map((u) => (u.uid === uid ? { ...u, suspended: data.suspended } : u))
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setSuspending(null);
    }
  };

  // Client-side search filter
  const filtered = users.filter((u) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      u.email?.toLowerCase().includes(q) ||
      u.displayName?.toLowerCase().includes(q)
    );
  });

  const stats = {
    total: users.length,
    active: users.filter((u) => u.subscription === 'active').length,
    suspended: users.filter((u) => u.suspended).length,
  };

  return (
    <AdminLayout>
      <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-zinc-900 tracking-tight">
              Manage Students
            </h1>
            <p className="text-sm text-zinc-500 mt-0.5">
              View subscription status, search accounts, and suspend access.
            </p>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total Users', value: stats.total, icon: <Users className="h-5 w-5 text-indigo-500" />, color: 'bg-indigo-50' },
            { label: 'Active Subscribers', value: stats.active, icon: <BadgeCheck className="h-5 w-5 text-emerald-500" />, color: 'bg-emerald-50' },
            { label: 'Suspended', value: stats.suspended, icon: <ShieldOff className="h-5 w-5 text-red-400" />, color: 'bg-red-50' },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-2xl border border-zinc-200 p-5 shadow-sm flex items-center gap-4">
              <div className={`h-11 w-11 rounded-xl ${s.color} flex items-center justify-center shrink-0`}>
                {s.icon}
              </div>
              <div>
                <p className="text-2xl font-extrabold text-zinc-900">{s.value}</p>
                <p className="text-xs text-zinc-500 font-medium mt-0.5">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="p-4 bg-red-50 text-red-600 border border-red-200 rounded-xl flex items-center gap-3 text-sm">
            <AlertCircle className="h-5 w-5 shrink-0" />
            {error}
          </div>
        )}

        {/* Table card */}
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
          {/* Toolbar */}
          <div className="p-4 border-b border-zinc-100 flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
              <input
                type="text"
                placeholder="Search by name or email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
            </div>

            {/* Filter dropdown */}
            <div className="relative">
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="appearance-none pl-4 pr-9 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-medium text-zinc-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
              >
                {SUBSCRIPTION_FILTERS.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <div className="p-16 flex justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-16 text-center">
              <div className="h-14 w-14 bg-zinc-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Users className="h-7 w-7 text-zinc-400" />
              </div>
              <h3 className="text-base font-bold text-zinc-900">No users found</h3>
              <p className="text-zinc-500 text-sm mt-1">
                {search ? 'Try a different search term.' : 'No users match this filter yet.'}
              </p>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-zinc-50 border-b border-zinc-100">
                      <th className="text-left text-xs font-bold text-zinc-500 uppercase tracking-wide px-6 py-3">User</th>
                      <th className="text-left text-xs font-bold text-zinc-500 uppercase tracking-wide px-4 py-3">Subscription</th>
                      <th className="text-left text-xs font-bold text-zinc-500 uppercase tracking-wide px-4 py-3">Expires</th>
                      <th className="text-left text-xs font-bold text-zinc-500 uppercase tracking-wide px-4 py-3">Points</th>
                      <th className="text-left text-xs font-bold text-zinc-500 uppercase tracking-wide px-4 py-3">Joined</th>
                      <th className="text-left text-xs font-bold text-zinc-500 uppercase tracking-wide px-4 py-3">Status</th>
                      <th className="text-right text-xs font-bold text-zinc-500 uppercase tracking-wide px-6 py-3">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {filtered.map((user) => (
                      <tr
                        key={user.uid}
                        className={`hover:bg-zinc-50/70 transition-colors ${user.suspended ? 'opacity-60' : ''}`}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <Avatar user={user} />
                            <div className="min-w-0">
                              <p className="font-semibold text-zinc-900 truncate flex items-center gap-1.5">
                                {user.displayName || 'Anonymous'}
                                {user.role === 'admin' && (
                                  <Crown className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                                )}
                              </p>
                              <p className="text-xs text-zinc-400 truncate flex items-center gap-1 mt-0.5">
                                <Mail className="h-3 w-3" />
                                {user.email ?? '—'}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="space-y-1">
                            <SubscriptionBadge status={user.subscription} />
                            {user.subscriptionPlan && (
                              <p className="text-[11px] text-zinc-400 capitalize">
                                {user.subscriptionPlan}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <p className="text-sm text-zinc-600 flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                            {formatDate(user.subscriptionExpiresAt)}
                          </p>
                        </td>
                        <td className="px-4 py-4">
                          <p className="text-sm font-semibold text-zinc-900 flex items-center gap-1">
                            <Star className="h-3.5 w-3.5 text-amber-400" />
                            {user.totalPoints?.toLocaleString() ?? 0}
                          </p>
                        </td>
                        <td className="px-4 py-4">
                          <p className="text-sm text-zinc-500">{formatDate(user.createdAt)}</p>
                        </td>
                        <td className="px-4 py-4">
                          {user.suspended ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold uppercase rounded-full border bg-red-50 text-red-600 border-red-200">
                              <ShieldOff className="h-3 w-3" />
                              Suspended
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold uppercase rounded-full border bg-zinc-50 text-zinc-500 border-zinc-200">
                              <Shield className="h-3 w-3" />
                              Active
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          {user.role !== 'admin' && (
                            <button
                              onClick={() => handleSuspend(user.uid, user.suspended)}
                              disabled={suspending === user.uid}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all disabled:opacity-50 ${
                                user.suspended
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                  : 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'
                              }`}
                            >
                              {suspending === user.uid ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : user.suspended ? (
                                <><Shield className="h-3 w-3" /> Unsuspend</>
                              ) : (
                                <><ShieldOff className="h-3 w-3" /> Suspend</>
                              )}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden divide-y divide-zinc-100">
                {filtered.map((user) => (
                  <div
                    key={user.uid}
                    className={`p-4 space-y-3 ${user.suspended ? 'opacity-60' : ''}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar user={user} />
                        <div className="min-w-0">
                          <p className="font-semibold text-zinc-900 truncate text-sm">
                            {user.displayName || 'Anonymous'}
                          </p>
                          <p className="text-xs text-zinc-400 truncate">{user.email}</p>
                        </div>
                      </div>
                      <SubscriptionBadge status={user.subscription} />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-zinc-500 space-y-0.5">
                        <p>Joined {formatDate(user.createdAt)}</p>
                        <p className="flex items-center gap-1">
                          <Star className="h-3 w-3 text-amber-400" />
                          {user.totalPoints?.toLocaleString() ?? 0} pts
                        </p>
                      </div>
                      {user.role !== 'admin' && (
                        <button
                          onClick={() => handleSuspend(user.uid, user.suspended)}
                          disabled={suspending === user.uid}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all disabled:opacity-50 ${
                            user.suspended
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-red-50 text-red-600 border-red-200'
                          }`}
                        >
                          {suspending === user.uid ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : user.suspended ? (
                            <><Shield className="h-3 w-3" /> Unsuspend</>
                          ) : (
                            <><ShieldOff className="h-3 w-3" /> Suspend</>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Footer count */}
          {!loading && filtered.length > 0 && (
            <div className="px-6 py-3 border-t border-zinc-100 bg-zinc-50/50">
              <p className="text-xs text-zinc-400">
                Showing {filtered.length} of {users.length} users
              </p>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
