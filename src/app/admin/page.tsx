'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/admin-layout';
import { useAuth } from '@/context/auth-context';
import {
  Users,
  Video,
  BookOpen,
  TrendingUp,
  Activity,
  CreditCard,
  Plus
} from 'lucide-react';

export default function AdminDashboardPage() {
  const router = useRouter();
  const { profile } = useAuth();

  // If somehow not admin, fallback (though AdminLayout guards this)
  if (profile && profile.role !== 'admin') {
    if (typeof window !== 'undefined') {
      router.push('/dashboard');
    }
    return null;
  }

  const [statsData, setStatsData] = React.useState<any>(null);
  const [loadingStats, setLoadingStats] = React.useState(true);
  const [statsError, setStatsError] = React.useState<string | null>(null);

  React.useEffect(() => {
    // Only fetch if profile is loaded and is admin
    if (!profile || profile.role !== 'admin') return;

    let isMounted = true;
    async function fetchStats() {
      try {
        const res = await fetch('/api/v1/admin/stats');
        if (!res.ok) {
          throw new Error('Failed to fetch stats');
        }
        const data = await res.json();
        if (isMounted) {
          setStatsData(data.stats);
        }
      } catch (err: any) {
        if (isMounted) setStatsError(err.message || 'Error loading stats');
      } finally {
        if (isMounted) setLoadingStats(false);
      }
    }

    fetchStats();
    return () => { isMounted = false; };
  }, [profile]);

  const displayStats = [
    { label: 'Total Students', value: statsData?.totalStudents ?? 0, icon: Users, color: 'text-blue-600', bg: 'bg-blue-100' },
    { label: 'Active Subscriptions', value: statsData?.activeSubscriptions ?? 0, icon: CreditCard, color: 'text-emerald-600', bg: 'bg-emerald-100' },
    { label: 'Published Courses', value: statsData?.publishedCourses ?? 0, icon: Video, color: 'text-purple-600', bg: 'bg-purple-100' },
    { label: 'Learning Subjects', value: statsData?.learningSubjects ?? 0, icon: BookOpen, color: 'text-amber-600', bg: 'bg-amber-100' },
  ];

  return (
    <AdminLayout>
      <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8">
        
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-zinc-900 tracking-tight">
              Admin Overview
            </h1>
            <p className="text-zinc-500 text-sm mt-1">
              Welcome back. Here is what is happening across Alpha Academy today.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => router.push('/admin/courses?action=new')}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-sm transition-all"
            >
              <Plus className="h-4 w-4" />
              New Course
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {loadingStats ? (
            Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="bg-white rounded-2xl p-6 border border-zinc-200 shadow-sm flex items-start gap-4 animate-pulse">
                <div className="h-12 w-12 rounded-xl bg-zinc-200 shrink-0" />
                <div className="flex-1 space-y-2 py-1">
                  <div className="h-4 bg-zinc-200 rounded w-1/2" />
                  <div className="h-6 bg-zinc-200 rounded w-1/3" />
                </div>
              </div>
            ))
          ) : statsError ? (
            <div className="col-span-1 sm:col-span-2 lg:col-span-4 bg-red-50 rounded-2xl p-6 border border-red-100 flex flex-col items-center justify-center text-center">
              <p className="text-sm text-red-600 font-medium">Failed to load statistics.</p>
              <button onClick={() => window.location.reload()} className="mt-2 text-xs text-red-700 underline hover:no-underline">Try again</button>
            </div>
          ) : (
            displayStats.map((stat, idx) => {
              const Icon = stat.icon;
              return (
                <div key={idx} className="bg-white rounded-2xl p-6 border border-zinc-200 shadow-sm flex items-start gap-4">
                  <div className={`h-12 w-12 rounded-xl flex items-center justify-center shrink-0 ${stat.bg} ${stat.color}`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-zinc-500">{stat.label}</p>
                    <h3 className="text-2xl font-extrabold text-zinc-900 mt-1">{stat.value.toLocaleString()}</h3>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Two Column Layout for Activity & Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
          
          {/* Main Activity Feed (2 columns wide on LG) */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
                <h3 className="text-lg font-bold text-zinc-900 flex items-center gap-2">
                  <Activity className="h-5 w-5 text-zinc-400" />
                  Recent System Activity
                </h3>
              </div>
              <div className="p-6">
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="h-16 w-16 bg-zinc-50 rounded-full flex items-center justify-center mb-4 border border-zinc-100">
                    <TrendingUp className="h-8 w-8 text-zinc-300" />
                  </div>
                  <p className="text-zinc-500 font-medium text-sm">No recent activity found.</p>
                  <p className="text-zinc-400 text-xs mt-1">Audit logs and enrollment events will appear here.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Links (1 column wide on LG) */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-zinc-100">
                <h3 className="text-lg font-bold text-zinc-900">Quick Links</h3>
              </div>
              <div className="divide-y divide-zinc-100">
                <button
                  onClick={() => router.push('/admin/users')}
                  className="w-full flex items-center justify-between p-4 hover:bg-zinc-50 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                      <Users className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-zinc-900">Manage Students</p>
                      <p className="text-xs text-zinc-500">View and suspend users</p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => router.push('/admin/subjects')}
                  className="w-full flex items-center justify-between p-4 hover:bg-zinc-50 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
                      <BookOpen className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-zinc-900">Edit Subjects</p>
                      <p className="text-xs text-zinc-500">Categories and tags</p>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>

        </div>

      </div>
    </AdminLayout>
  );
}
