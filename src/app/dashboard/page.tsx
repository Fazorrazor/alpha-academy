// src/app/dashboard/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/auth-context';
import DashboardLayout from '@/components/dashboard-layout';
import { db } from '@/lib/firebase/client';
import { doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import {
  BookOpen,
  CheckCircle2,
  Clock,
  HelpCircle,
  AlertCircle,
  ChevronRight,
  ExternalLink,
  Flame,
  CreditCard
} from 'lucide-react';

interface MockCourse {
  id: string;
  title: string;
  category: string;
  progress: number;
  lessonsCompleted: number;
  totalLessons: number;
  lastAccessed: string;
}

const MOCK_COURSES: MockCourse[] = [
  {
    id: 'course-1',
    title: 'Advanced System Design & Architecture',
    category: 'Software Engineering',
    progress: 75,
    lessonsCompleted: 15,
    totalLessons: 20,
    lastAccessed: '2 hours ago',
  },
  {
    id: 'course-2',
    title: 'Financial Markets & Algorithmic Trading',
    category: 'Finance',
    progress: 40,
    lessonsCompleted: 8,
    totalLessons: 20,
    lastAccessed: 'Yesterday',
  },
  {
    id: 'course-3',
    title: 'Applied Machine Learning & Neural Networks',
    category: 'Data Science',
    progress: 10,
    lessonsCompleted: 2,
    totalLessons: 20,
    lastAccessed: '3 days ago',
  },
];

function getFormattedExpiryDate(val: unknown): string {
  if (!val) return 'N/A';
  const obj = val as Record<string, unknown>;
  if (typeof obj.toDate === 'function') {
    return (obj.toDate as () => Date)().toLocaleDateString(undefined, { dateStyle: 'medium' });
  }
  if (typeof obj.seconds === 'number') {
    return new Date(obj.seconds * 1000).toLocaleDateString(undefined, { dateStyle: 'medium' });
  }
  try {
    return new Date(val as string | number | Date).toLocaleDateString(undefined, { dateStyle: 'medium' });
  } catch (err) {
    console.error('Failed to parse expiry date:', err);
    return 'N/A';
  }
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, profile, loading, logout, refreshProfile } = useAuth();
  const [cancellingSub, setCancellingSub] = useState(false);
  const [subscribingPlan, setSubscribingPlan] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [activeCourses, setActiveCourses] = useState<any[]>([]);
  const [isLoadingCourses, setIsLoadingCourses] = useState(true);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Route protection guard
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  // Load real active courses & progress
  useEffect(() => {
    if (!user) return;

    const fetchActiveCourses = async () => {
      setIsLoadingCourses(true);
      try {
        const enrollRes = await fetch('/api/v1/enrollments');
        if (!enrollRes.ok) throw new Error('Failed to fetch enrollments');
        const enrollData = await enrollRes.json();
        const enrollmentsList = enrollData.enrollments || [];

        // Sort enrollments: lastAccessedAt desc, fallback to enrolledAt desc
        enrollmentsList.sort((a: any, b: any) => {
          const timeA = a.lastAccessedAt?._seconds || a.lastAccessedAt?.seconds || a.enrolledAt?._seconds || a.enrolledAt?.seconds || 0;
          const timeB = b.lastAccessedAt?._seconds || b.lastAccessedAt?.seconds || b.enrolledAt?._seconds || b.enrolledAt?.seconds || 0;
          return timeB - timeA;
        });

        if (enrollmentsList.length === 0) {
          setActiveCourses([]);
          return;
        }

        const coursesWithProgress = await Promise.all(
          enrollmentsList.map(async (enrollment: any) => {
            const courseId = enrollment.courseId;
            let courseTitle = 'Unknown Course';
            let category = 'General';
            let totalLessons = 5;

            try {
              const courseDoc = await getDoc(doc(db, 'courses', courseId));
              if (courseDoc.exists()) {
                const courseData = courseDoc.data();
                courseTitle = courseData.title || courseTitle;
                totalLessons = courseData.totalLessons || totalLessons;

                if (courseData.subjectId) {
                  const subjectDoc = await getDoc(doc(db, 'subjects', courseData.subjectId));
                  if (subjectDoc.exists()) {
                    category = subjectDoc.data().title || category;
                  }
                }
              }
            } catch (err) {
              console.error(`Error fetching course ${courseId}:`, err);
            }

            let lessonsCompleted = 0;
            try {
              const progressQuery = query(
                collection(db, 'progress'),
                where('uid', '==', user.uid),
                where('courseId', '==', courseId),
                where('completed', '==', true)
              );
              const progressSnap = await getDocs(progressQuery);
              lessonsCompleted = progressSnap.size;
            } catch (err) {
              console.error(`Error progress for ${courseId}:`, err);
            }

            const progressPercent = Math.min(
              100,
              Math.round((lessonsCompleted / totalLessons) * 100)
            );

            let lastAccessed = 'Recently';
            if (enrollment.enrolledAt) {
              const date = enrollment.enrolledAt.toDate
                ? enrollment.enrolledAt.toDate()
                : new Date(enrollment.enrolledAt.seconds * 1000);
              lastAccessed = date.toLocaleDateString(undefined, { dateStyle: 'medium' });
            }

            return {
              id: courseId,
              title: courseTitle,
              category,
              progress: progressPercent,
              lessonsCompleted,
              totalLessons,
              lastAccessed,
            };
          })
        );

        setActiveCourses(coursesWithProgress);
      } catch (err) {
        console.error('Error fetching active courses:', err);
      } finally {
        setIsLoadingCourses(false);
      }
    };

    fetchActiveCourses();
  }, [user]);

  const handleSubscribe = async (plan: 'monthly' | 'annual') => {
    setSubscribingPlan(plan);
    setMessage(null);
    try {
      const res = await fetch('/api/v1/subscriptions/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });

      const data = await res.json();
      if (res.ok && data.authorizationUrl) {
        // Redirect to Paystack Checkout page
        window.location.href = data.authorizationUrl;
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to initialize payment checkout.' });
      }
    } catch (err) {
      console.error('Subscription error:', err);
      setMessage({ type: 'error', text: 'Connection failed. Please try again.' });
    } finally {
      setSubscribingPlan(null);
    }
  };

  const handleCancelSubscription = async () => {
    setIsCancelModalOpen(false);

    setCancellingSub(true);
    setMessage(null);
    try {
      const res = await fetch('/api/v1/subscriptions/cancel', {
        method: 'POST',
      });

      const data = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: 'Subscription renewal cancelled successfully.' });
        await refreshProfile(); // reload profile to show updated status
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to cancel subscription.' });
      }
    } catch (err) {
      console.error('Cancellation error:', err);
      setMessage({ type: 'error', text: 'An unexpected connection error occurred.' });
    } finally {
      setCancellingSub(false);
    }
  };

  if (loading || !user || !profile) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#F9F7F7] text-[#112D4E]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#3F72AF] border-t-transparent"></div>
          <p className="text-zinc-600 text-sm font-medium animate-pulse">Loading dashboard environment...</p>
        </div>
      </div>
    );
  }

  const isSubscribed = profile.subscription === 'active' || profile.subscription === 'cancelled';
  const hasExpired = profile.subscription === 'expired';

  return (
    <DashboardLayout>
      <div className="p-6 md:p-10 max-w-6xl mx-auto">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-[#112D4E] tracking-tight">
              Welcome back, {profile.displayName?.split(' ')[0] || 'Scholar'}!
            </h1>
            <p className="text-zinc-500 text-sm mt-1">
              Resume your modules or explore certifications.
            </p>
          </div>
          {/* Streak Indicator */}
          <div className="flex items-center gap-3 px-4 py-2 bg-orange-50 border border-orange-205 rounded-full text-orange-700 text-sm font-semibold self-start shadow-sm">
            <Flame className="h-4 w-4 text-orange-600 fill-orange-500 animate-pulse" />
            <span>3 Day Study Streak</span>
          </div>
        </header>

        {/* Global Feedback Banner */}
        {message && (
          <div
            className={`flex items-start gap-3 rounded-2xl p-4 text-sm mb-6 border ${
              message.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : 'bg-red-50 border-red-200 text-red-650'
            }`}
          >
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
            <span>{message.text}</span>
          </div>
        )}

        {/* Top Section Layout: Courses and Subscription status */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">
          {/* Left / Center: Active Courses */}
          <section className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-[#112D4E] flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-[#3F72AF]" />
                Active Courses
              </h2>
              <Link href="/courses" className="text-[#3F72AF] hover:text-[#3F72AF]/80 text-xs font-semibold flex items-center gap-1">
                Explore catalog <ChevronRight className="h-3 w-3" />
              </Link>
            </div>

            <div className="space-y-4">
              {isLoadingCourses ? (
                <div className="bg-white border border-[#DBE2EF] rounded-2xl p-8 flex flex-col items-center justify-center text-center shadow-sm">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#3F72AF] border-t-transparent mb-2"></div>
                  <span className="text-sm text-[#3F72AF]">Loading active courses...</span>
                </div>
              ) : activeCourses.length === 0 ? (
                <div className="bg-white border border-[#DBE2EF] rounded-2xl p-8 flex flex-col items-center justify-center text-center shadow-sm">
                  <BookOpen className="h-8 w-8 text-zinc-350 mb-3" />
                  <p className="font-bold text-[#112D4E]">No active courses yet</p>
                  <p className="text-xs text-zinc-500 max-w-sm mt-1 mb-4 leading-relaxed">
                    Choose from our selection of premium software engineering, quantitative trading, or data science tracks.
                  </p>
                  <Link
                    href="/courses"
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#3F72AF] hover:bg-[#3F72AF]/90 text-white rounded-xl text-xs font-bold transition-all active:scale-[0.98] shadow-sm shadow-[#3F72AF]/10"
                  >
                    Browse Catalog <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              ) : (
                activeCourses.map((course) => (
                  <div
                    key={course.id}
                    className="bg-white border border-[#DBE2EF] hover:border-[#3F72AF]/40 rounded-2xl p-5 transition-all shadow-sm group"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-[#F9F7F7] text-zinc-500 border border-[#DBE2EF]">
                          {course.category}
                        </span>
                        <h3 className="font-bold text-[#112D4E] mt-2 group-hover:text-[#3F72AF] transition-colors">
                          {course.title}
                        </h3>
                      </div>
                      <span className="text-xs text-zinc-400 font-medium shrink-0">
                        Enrolled {course.lastAccessed}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-4 flex items-center gap-4">
                      <div className="flex-1 bg-[#DBE2EF] h-2.5 rounded-full overflow-hidden border border-[#DBE2EF]">
                        <div
                          className="bg-[#3F72AF] h-full rounded-full transition-all duration-500"
                          style={{ width: `${course.progress}%` }}
                        ></div>
                      </div>
                      <span className="text-xs font-bold text-zinc-600 shrink-0">
                        {course.progress}%
                      </span>
                    </div>

                    <div className="mt-4 flex justify-between items-center pt-3 border-t border-zinc-100 text-xs">
                      <span className="text-zinc-550 font-medium flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5 text-zinc-400" />
                        {course.lessonsCompleted} of {course.totalLessons} lessons
                      </span>
                      <Link
                        href={`/courses/${course.id}`}
                        className="text-[#3F72AF] font-bold hover:text-[#3F72AF]/80 flex items-center gap-0.5"
                      >
                        Resume Study <ChevronRight className="h-4.5 w-4.5" />
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Right: Billing & Subscription Status Card */}
          <section className="space-y-6">
            <h2 className="text-xl font-bold text-[#112D4E] flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-[#3F72AF]" />
              Membership & Billing
            </h2>

            {/* If fully active membership */}
            {isSubscribed ? (
              <div className="bg-white border border-[#DBE2EF] rounded-2xl p-6 space-y-6 relative overflow-hidden shadow-sm">
                {/* Decorative glow */}
                <div className="absolute top-0 right-0 h-24 w-24 bg-[#3F72AF]/5 rounded-full blur-2xl pointer-events-none"></div>

                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xs uppercase font-bold tracking-wider text-[#3F72AF]">
                      Premium Student
                    </span>
                    <h3 className="text-2xl font-extrabold text-[#112D4E] mt-1">
                      {profile.subscriptionPlan === 'annual' ? 'Annual Pass' : 'Monthly Pass'}
                    </h3>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#3F72AF]/10 text-[#3F72AF] border border-[#3F72AF]/20">
                    {profile.subscription === 'active' ? 'Active' : 'Cancelled'}
                  </span>
                </div>

                <div className="space-y-3.5 text-sm pt-4 border-t border-[#DBE2EF]">
                  <div className="flex justify-between items-center text-zinc-500">
                    <span className="flex items-center gap-1.5">
                      <Clock className="h-4 w-4" />
                      {profile.subscription === 'active' ? 'Renews on:' : 'Expires on:'}
                    </span>
                    <span className="font-semibold text-zinc-700">
                      {getFormattedExpiryDate(profile.subscriptionExpiresAt)}
                    </span>
                  </div>
                </div>

                <div className="pt-2">
                  {profile.subscription === 'active' ? (
                    <button
                      onClick={() => setIsCancelModalOpen(true)}
                      disabled={cancellingSub}
                      className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#F9F7F7] hover:bg-[#DBE2EF]/30 border border-[#DBE2EF] hover:border-red-200 hover:text-red-650 py-3 text-sm font-semibold transition-all disabled:opacity-50 active:scale-[0.98] cursor-pointer shadow-sm"
                    >
                      {cancellingSub ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"></div>
                      ) : (
                        'Cancel Auto-Renewal'
                      )}
                    </button>
                  ) : (
                    <div className="rounded-xl bg-[#F9F7F7] border border-[#DBE2EF] p-3 text-xs text-zinc-550 text-center">
                      Renewal is cancelled. Membership expires at the end of the current cycle.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* If not subscribed / expired */
              <div className="bg-white border border-[#DBE2EF] rounded-2xl p-6 space-y-6 relative overflow-hidden shadow-sm">
                {/* Decorative glow */}
                <div className="absolute top-0 right-0 h-24 w-24 bg-[#3F72AF]/5 rounded-full blur-2xl pointer-events-none"></div>

                <div>
                  <span className="text-xs uppercase font-bold tracking-wider text-[#3F72AF]">
                    Membership status
                  </span>
                  <h3 className="text-2xl font-extrabold text-[#112D4E] mt-1">
                    Free Tier
                  </h3>
                  <p className="text-xs text-zinc-500 mt-2 leading-relaxed">
                    {hasExpired
                      ? 'Your Premium subscription has expired. Resubscribe to restore access to all certification modules.'
                      : 'Subscribe to Alpha Academy Premium to unlock quizzes, full course materials, and custom-signed PDF credentials.'}
                  </p>
                </div>

                <div className="space-y-3 pt-4 border-t border-[#DBE2EF]">
                  {/* Monthly subscription button */}
                  <button
                    onClick={() => handleSubscribe('monthly')}
                    disabled={subscribingPlan !== null}
                    className="w-full relative flex items-center justify-center rounded-xl bg-[#3F72AF] hover:bg-[#3F72AF]/90 py-3 text-sm font-bold text-white transition-all disabled:opacity-50 active:scale-[0.98] cursor-pointer shadow-md shadow-[#3F72AF]/10"
                  >
                    {subscribingPlan === 'monthly' ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                    ) : (
                      <span className="flex items-center gap-1.5">
                        Upgrade Monthly — GH₵ 50
                        <ExternalLink className="h-3.5 w-3.5" />
                      </span>
                    )}
                  </button>

                  {/* Annual subscription button */}
                  <button
                    onClick={() => handleSubscribe('annual')}
                    disabled={subscribingPlan !== null}
                    className="w-full flex items-center justify-center rounded-xl bg-[#F9F7F7] border border-[#DBE2EF] hover:bg-[#DBE2EF]/30 py-3 text-sm font-bold text-[#112D4E] transition-all disabled:opacity-50 active:scale-[0.98] cursor-pointer shadow-sm"
                  >
                    {subscribingPlan === 'annual' ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-400 border-t-transparent"></div>
                    ) : (
                      <span className="flex items-center gap-1.5">
                        Get Annual Pass — GH₵ 500
                        <ExternalLink className="h-3.5 w-3.5 text-zinc-500" />
                      </span>
                    )}
                  </button>
                  <p className="text-[10px] text-center text-zinc-450 mt-1">
                    Powered securely by Paystack. Secure auto-renewals apply.
                  </p>
                </div>
              </div>
            )}

            {/* Quick Helper Links */}
            <div className="bg-white border border-[#DBE2EF] rounded-2xl p-5 space-y-3 shadow-sm">
              <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                Support & Inquiries
              </h4>
              <div className="space-y-2 text-xs text-zinc-500">
                <a href="#" className="flex items-center justify-between hover:text-[#3F72AF] transition-colors">
                  <span>How payments work?</span>
                  <HelpCircle className="h-3.5 w-3.5 text-zinc-400" />
                </a>
                <a href="#" className="flex items-center justify-between hover:text-[#3F72AF] transition-colors">
                  <span>Terms & Billing Policy</span>
                  <HelpCircle className="h-3.5 w-3.5 text-zinc-400" />
                </a>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Custom Cancel Subscription Modal */}
      {isCancelModalOpen && isMounted && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#112D4E]/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl border border-[#DBE2EF] w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6">
              <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mb-4">
                <AlertCircle className="h-6 w-6 text-red-500" />
              </div>
              <h3 className="text-xl font-bold text-[#112D4E] mb-2">Cancel Subscription?</h3>
              <p className="text-sm text-zinc-500 leading-relaxed">
                Are you sure you want to cancel your subscription auto-renewal? You will keep access to all premium features until your current billing cycle expires.
              </p>
            </div>
            <div className="bg-[#F9F7F7] px-6 py-4 flex gap-3 justify-end border-t border-[#DBE2EF]">
              <button
                onClick={() => setIsCancelModalOpen(false)}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-zinc-600 hover:bg-[#DBE2EF]/50 transition-colors"
              >
                Keep Subscription
              </button>
              <button
                onClick={handleCancelSubscription}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-red-500 hover:bg-red-600 text-white shadow-sm transition-colors active:scale-95"
              >
                Yes, Cancel
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </DashboardLayout>
  );
}
