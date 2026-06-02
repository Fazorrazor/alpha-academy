// src/app/courses/[courseId]/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/auth-context';
import { db } from '@/lib/firebase/client';
import { doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import DashboardLayout from '@/components/dashboard-layout';
import {
  BookOpen,
  Clock,
  Lock,
  PlayCircle,
  FileText,
  CheckCircle,
  ChevronRight,
  ArrowLeft,
  Calendar,
  Sparkles,
  AlertCircle,
  Users
} from 'lucide-react';

interface Course {
  id: string;
  title: string;
  description: string;
  estimatedDurationMinutes: number;
  totalLessons: number;
  tags: string[];
}

interface Lesson {
  id: string;
  title: string;
  description: string;
  type: 'video' | 'pdf';
  order: number;
}

const DEFAULT_COURSES: Record<string, Course> = {
  'course-1': {
    id: 'course-1',
    title: 'Advanced System Design & Architecture',
    description: 'Learn to design highly scalable, fault-tolerant systems. Covers microservices, load balancing, caching, database sharding, and event-driven architectures.',
    estimatedDurationMinutes: 600,
    totalLessons: 5,
    tags: ['Architecture', 'Scalability', 'Backend'],
  },
  'course-2': {
    id: 'course-2',
    title: 'Financial Markets & Algorithmic Trading',
    description: 'Master quantitative finance and automated trading strategies. Covers market mechanics, technical indicators, order books, and building trading bots in Python.',
    estimatedDurationMinutes: 480,
    totalLessons: 3,
    tags: ['Trading', 'Python', 'Quantitative'],
  },
  'course-3': {
    id: 'course-3',
    title: 'Applied Machine Learning & Neural Networks',
    description: 'Design and train deep learning models. Practical guide to supervised learning, NLP, computer vision, and deploying neural networks to production.',
    estimatedDurationMinutes: 720,
    totalLessons: 3,
    tags: ['AI', 'Neural Networks', 'TensorFlow'],
  },
  'course-4': {
    id: 'course-4',
    title: 'Systems Programming with Rust',
    description: 'Write high-performance, memory-safe software without a garbage collector. Master concurrency, lifetimes, and safety guarantees.',
    estimatedDurationMinutes: 540,
    totalLessons: 3,
    tags: ['Rust', 'Systems', 'Performance'],
  },
};

const DEFAULT_LESSONS: Record<string, Lesson[]> = {
  'course-1': [
    { id: 'c1-l1', title: 'Introduction to System Design & Architectural Goals', description: 'Understand SLA, throughput, availability metrics, and core constraints.', type: 'video', order: 1 },
    { id: 'c1-l2', title: 'Understanding Scalability: Vertical vs Horizontal', description: 'Deep dive into load distribution patterns, stateless systems, and network bounds.', type: 'video', order: 2 },
    { id: 'c1-l3', title: 'Load Balancing Strategies & Reverse Proxies', description: 'Explore round-robin, least connections, hashing mechanisms, Nginx, and HAProxy.', type: 'video', order: 3 },
    { id: 'c1-l4', title: 'Caching Strategies: Memcached and Redis', description: 'Cache-aside, write-through, eviction policies, and session storage patterns.', type: 'pdf', order: 4 },
    { id: 'c1-l5', title: 'Database Sharding & Replication Topologies', description: 'Partitioning keys, consistent hashing, master-slave topologies, and consensus protocols.', type: 'video', order: 5 },
  ],
  'course-2': [
    { id: 'c2-l1', title: 'Foundations of Financial Markets & Order Books', description: 'Limit order books, bid-ask spreads, market participants, and execution structures.', type: 'video', order: 1 },
    { id: 'c2-l2', title: 'Technical Indicators & Quantitative Signals', description: 'Moving averages, RSI, Bollinger Bands, and building clean signals in Python.', type: 'pdf', order: 2 },
    { id: 'c2-l3', title: 'Building an Execution System in Python', description: 'Connect to websocket feeds, manage positions, and submit algorithmic orders.', type: 'video', order: 3 },
  ],
  'course-3': [
    { id: 'c3-l1', title: 'Linear Algebra & Gradient Descent Fundamentals', description: 'Review vectors, matrix transformations, cost functions, and batch updates.', type: 'video', order: 1 },
    { id: 'c3-l2', title: 'Building a Multi-Layer Perceptron from Scratch', description: 'Forward propagation, backpropagation, and weights optimization in numpy.', type: 'video', order: 2 },
    { id: 'c3-l3', title: 'Convolutional Neural Networks for Image Recognition', description: 'Pooling, filters, activation mapping, and fine-tuning pretrained CNN models.', type: 'pdf', order: 3 },
  ],
  'course-4': [
    { id: 'c4-l1', title: 'Rust Safety Guarantees & Memory Management', description: 'Ownership model, stacking, heap allocation, and safe heap pointers.', type: 'video', order: 1 },
    { id: 'c4-l2', title: 'Understanding Lifetimes & Borrow Checker', description: 'References, mutable vs immutable rules, and explicit lifetime annotations.', type: 'pdf', order: 2 },
    { id: 'c4-l3', title: 'Safe Concurrency & Message Passing in Rust', description: 'Channels, Arc, Mutex, and thread execution bounds without data races.', type: 'video', order: 3 },
  ],
};

interface PageProps {
  params: Promise<{ courseId: string }>;
}

export default function CourseDetailPage({ params }: PageProps) {
  const router = useRouter();
  const { user, profile, loading, logout } = useAuth();
  
  const unwrappedParams = React.use(params);
  const courseId = unwrappedParams.courseId;

  const [course, setCourse] = useState<Course | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [enrolled, setEnrolled] = useState<boolean>(false);
  const [completedLessons, setCompletedLessons] = useState<string[]>([]);
  const [hasStarted, setHasStarted] = useState<boolean>(false);
  const [isEnrolling, setIsEnrolling] = useState<boolean>(false);
  const [isLoadingContent, setIsLoadingContent] = useState<boolean>(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Route protection guard
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  // Load course details, lessons and enrollment status
  useEffect(() => {
    if (!user || !courseId) return;

    const fetchData = async () => {
      setIsLoadingContent(true);
      setMessage(null);
      try {
        // 1. Fetch user enrollment status for this course
        const enrollRes = await fetch('/api/v1/enrollments');
        if (enrollRes.ok) {
          const enrollData = await enrollRes.json();
          if (enrollData.enrollments) {
            const matchedEnroll = enrollData.enrollments.find((e: { courseId: string }) => e.courseId === courseId);
            const hasEnrollment = !!matchedEnroll;
            setEnrolled(hasEnrollment);

            if (hasEnrollment) {
              if (matchedEnroll.lastAccessedAt) {
                setHasStarted(true);
              }

              // Send access ping
              fetch('/api/v1/enrollments/access', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ courseId }),
              }).catch((err) => console.error('Failed to send access ping:', err));

              // Fetch student's progress for this course
              const progressSnap = await getDocs(
                query(
                  collection(db, 'progress'),
                  where('uid', '==', user.uid),
                  where('courseId', '==', courseId),
                  where('completed', '==', true)
                )
              );
              if (!progressSnap.empty) {
                const completedIds = progressSnap.docs.map((doc) => doc.data().lessonId);
                setCompletedLessons(completedIds);
                if (completedIds.length > 0) {
                  setHasStarted(true);
                }
              } else {
                setCompletedLessons([]);
              }
            }
          }
        }

        // 2. Fetch specific course details from Firestore
        const courseDoc = await getDoc(doc(db, 'courses', courseId));
        if (courseDoc.exists()) {
          const courseData = courseDoc.data();
          setCourse({
            id: courseDoc.id,
            title: courseData.title || '',
            description: courseData.description || '',
            estimatedDurationMinutes: courseData.estimatedDurationMinutes || 120,
            totalLessons: courseData.totalLessons || 5,
            tags: courseData.tags || [],
          });
        } else {
          // Fallback to default mockup course
          if (DEFAULT_COURSES[courseId]) {
            setCourse(DEFAULT_COURSES[courseId]);
          } else {
            setMessage({ type: 'error', text: 'Course curriculum not found.' });
          }
        }

        // 3. Fetch specific course lessons
        const lessonsSnap = await getDocs(
          query(collection(db, `courses/${courseId}/lessons`), where('status', '==', 'published'))
        );
        if (!lessonsSnap.empty) {
          const fetchedLessons = lessonsSnap.docs
            .map((doc) => ({
              id: doc.id,
              title: doc.data().title || '',
              description: doc.data().description || '',
              type: (doc.data().type as 'video' | 'pdf') || 'video',
              order: doc.data().order || 1,
            }))
            .sort((a, b) => a.order - b.order);
          setLessons(fetchedLessons);
        } else {
          // Fallback to default lessons
          if (DEFAULT_LESSONS[courseId]) {
            setLessons(DEFAULT_LESSONS[courseId]);
          }
        }
      } catch (err) {
        console.error('Failed to load course details:', err);
        // Fallback to local mockup maps
        if (DEFAULT_COURSES[courseId]) {
          setCourse(DEFAULT_COURSES[courseId]);
        }
        if (DEFAULT_LESSONS[courseId]) {
          setLessons(DEFAULT_LESSONS[courseId]);
        }
      } finally {
        setIsLoadingContent(false);
      }
    };

    fetchData();
  }, [user, courseId]);

  const isSubscribed = profile?.subscription === 'active' || profile?.subscription === 'cancelled';

  const handleEnroll = async () => {
    if (!isSubscribed) {
      router.push('/dashboard');
      return;
    }

    setIsEnrolling(true);
    setMessage(null);

    try {
      const res = await fetch('/api/v1/enrollments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId }),
      });

      const data = await res.json();
      if (res.ok) {
        setEnrolled(true);
        setMessage({ type: 'success', text: 'Enrollment successful! You can now start studying this course.' });
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to enroll in course.' });
      }
    } catch (err) {
      console.error('Enrollment error:', err);
      setMessage({ type: 'error', text: 'Connection failed. Please try again.' });
    } finally {
      setIsEnrolling(false);
    }
  };

  const handleLessonClick = (lessonId: string) => {
    if (!isSubscribed) {
      setMessage({ type: 'error', text: 'Unlock Premium membership in your dashboard to view instructional content.' });
      return;
    }
    if (!enrolled) {
      setMessage({ type: 'error', text: 'Please enroll in the course first to unlock lesson materials.' });
      return;
    }
    // Route to content viewer
    router.push(`/courses/${courseId}/lessons/${lessonId}`);
  };

  if (loading || !user || !profile || isLoadingContent) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#F9F7F7] text-[#112D4E]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#3F72AF] border-t-transparent"></div>
          <p className="text-zinc-600 text-sm font-medium animate-pulse">Loading course detail map...</p>
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#F9F7F7] text-[#112D4E] p-4 text-center">
        <AlertCircle className="h-12 w-12 text-red-500 mb-4 animate-bounce" />
        <h2 className="text-2xl font-bold">Course Not Found</h2>
        <p className="text-zinc-550 mt-1 max-w-md">
          The requested course syllabus is either archived or does not exist in our catalog.
        </p>
        <button
          onClick={() => router.push('/courses')}
          className="mt-6 flex items-center gap-2 px-4 py-2 border border-[#DBE2EF] bg-white hover:bg-[#F9F7F7] rounded-xl text-sm font-semibold"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Catalog
        </button>
      </div>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 md:p-10 max-w-4xl mx-auto pb-28 md:pb-10">
        {/* Back Link */}
        <button
          onClick={() => router.push('/courses')}
          className="flex items-center gap-2 text-zinc-500 hover:text-[#112D4E] text-xs font-bold mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Explore
        </button>

        {/* Feedback Alert */}
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

        {/* Hero Section */}
        <div className="bg-white border border-[#DBE2EF] rounded-2xl p-6 md:p-8 shadow-sm mb-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 h-40 w-40 bg-[#3F72AF]/5 rounded-full blur-3xl pointer-events-none"></div>

          <div className="flex flex-wrap gap-1.5 mb-4">
            {course.tags.map((tag) => (
              <span
                key={tag}
                className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#F9F7F7] border border-[#DBE2EF] text-zinc-550"
              >
                {tag}
              </span>
            ))}
          </div>

          <h2 className="text-2xl md:text-3xl font-extrabold text-[#112D4E] tracking-tight mb-3">
            {course.title}
          </h2>
          <p className="text-zinc-550 text-sm leading-relaxed mb-6 max-w-3xl">
            {course.description}
          </p>

          <div className="flex flex-wrap items-center gap-6 text-zinc-500 text-xs font-semibold mb-6">
            <span className="flex items-center gap-1.5">
              <BookOpen className="h-4 w-4 text-[#3F72AF]" />
              {course.totalLessons} Lessons
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-[#3F72AF]" />
              {Math.round(course.estimatedDurationMinutes / 60)} Hours Duration
            </span>
            <span className="flex items-center gap-1.5">
              <Users className="h-4 w-4 text-[#3F72AF]" />
              1,245 Students enrolled
            </span>
            <span className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4 text-[#3F72AF]" />
              Updated recently
            </span>
          </div>

          {/* Enrollment CTAs */}
          <div className="flex items-center gap-3">
            {enrolled ? (
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5 text-emerald-650 bg-emerald-50 border border-emerald-250 px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm">
                  <CheckCircle className="h-4 w-4" />
                  Successfully Enrolled
                </span>
                <button
                  onClick={() => {
                    const nextLesson = lessons.find((l) => !completedLessons.includes(l.id)) || lessons[0];
                    handleLessonClick(nextLesson?.id);
                  }}
                  className="flex items-center gap-1.5 px-5 py-2.5 bg-[#3F72AF] hover:bg-[#3F72AF]/95 text-white text-sm font-bold rounded-xl shadow-md shadow-[#3F72AF]/10 transition-all cursor-pointer"
                >
                  {hasStarted ? 'Resume Course' : 'Start Course'}
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={handleEnroll}
                disabled={isEnrolling}
                className="flex items-center gap-2 px-6 py-3 bg-[#3F72AF] hover:bg-[#3F72AF]/90 disabled:opacity-50 text-white font-bold text-sm rounded-xl shadow-md shadow-[#3F72AF]/10 transition-all cursor-pointer"
              >
                {isEnrolling ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                ) : !isSubscribed ? (
                  <span className="flex items-center gap-1.5">
                    Unlock with Premium
                    <Sparkles className="h-4 w-4 text-amber-300 fill-amber-300" />
                  </span>
                ) : (
                  'Enroll in Course'
                )}
              </button>
            )}
          </div>
        </div>

        {/* Syllabus / Lessons List */}
        <section className="space-y-4">
          <h3 className="text-xl font-bold text-[#112D4E] flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-[#3F72AF]" />
            Course Syllabus ({lessons.length} modules)
          </h3>

          <div className="bg-white border border-[#DBE2EF] rounded-2xl divide-y divide-[#DBE2EF] overflow-hidden shadow-sm">
            {lessons.map((lesson, idx) => {
              const isLocked = !isSubscribed || !enrolled;
              const isCompleted = completedLessons.includes(lesson.id);
              return (
                <div
                  key={lesson.id}
                  onClick={() => handleLessonClick(lesson.id)}
                  className={`p-5 flex items-start gap-4 transition-all select-none cursor-pointer ${
                    isLocked
                      ? 'bg-zinc-50/50 hover:bg-zinc-50 opacity-90'
                      : 'hover:bg-[#F9F7F7]'
                  }`}
                >
                  {/* Indicator column */}
                  <div className="mt-1 shrink-0">
                    {isLocked ? (
                      <div className="h-9 w-9 rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-400">
                        <Lock className="h-4 w-4" />
                      </div>
                    ) : isCompleted ? (
                      <div className="h-9 w-9 rounded-full bg-emerald-50 border border-emerald-250 flex items-center justify-center text-emerald-650 shadow-sm">
                        <CheckCircle className="h-5 w-5" />
                      </div>
                    ) : lesson.type === 'video' ? (
                      <div className="h-9 w-9 rounded-full bg-[#3F72AF]/10 border border-[#3F72AF]/20 flex items-center justify-center text-[#3F72AF]">
                        <PlayCircle className="h-5 w-5" />
                      </div>
                    ) : (
                      <div className="h-9 w-9 rounded-full bg-orange-50 border border-orange-200/60 flex items-center justify-center text-orange-600">
                        <FileText className="h-5 w-5" />
                      </div>
                    )}
                  </div>

                  {/* Body columns */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase font-bold text-zinc-400">
                        Module {idx + 1}
                      </span>
                      <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-550 border border-zinc-200">
                        {lesson.type}
                      </span>
                    </div>
                    <h4 className="font-bold text-[#112D4E] text-sm md:text-base mt-1">
                      {lesson.title}
                    </h4>
                    <p className="text-zinc-550 text-xs md:text-sm mt-1 leading-relaxed">
                      {lesson.description}
                    </p>
                  </div>

                  {/* Right side arrow */}
                  <div className="shrink-0 self-center">
                    {!isLocked && (
                      <ChevronRight className="h-5 w-5 text-zinc-400" />
                    )}
                  </div>
                </div>
              );
            })}
            {/* Final Assessment / Quiz Block */}
            <div
              onClick={() => {
                if (!isSubscribed) {
                  setMessage({ type: 'error', text: 'Unlock Premium membership to take the final assessment.' });
                  return;
                }
                if (!enrolled) {
                  setMessage({ type: 'error', text: 'Please enroll in the course first to unlock the assessment.' });
                  return;
                }
                router.push(`/courses/${courseId}/quizzes/final`);
              }}
              className={`p-5 flex items-start gap-4 transition-all select-none cursor-pointer border-t-2 border-dashed border-[#DBE2EF] bg-[#F9F7F7] ${
                (!isSubscribed || !enrolled)
                  ? 'opacity-80'
                  : 'hover:bg-[#3F72AF]/5'
              }`}
            >
              <div className="mt-1 shrink-0">
                {(!isSubscribed || !enrolled) ? (
                  <div className="h-9 w-9 rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-400">
                    <Lock className="h-4 w-4" />
                  </div>
                ) : (
                  <div className="h-9 w-9 rounded-full bg-[#3F72AF]/10 border border-[#3F72AF]/20 flex items-center justify-center text-[#3F72AF]">
                    <Sparkles className="h-5 w-5" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase font-bold text-amber-550 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                    Final Assessment
                  </span>
                </div>
                <h4 className="font-bold text-[#112D4E] text-sm md:text-base mt-1">
                  Certification Quiz
                </h4>
                <p className="text-zinc-550 text-xs md:text-sm mt-1 leading-relaxed">
                  Test your knowledge to earn your official completion certificate.
                </p>
              </div>
              <div className="shrink-0 self-center">
                {isSubscribed && enrolled && (
                  <ChevronRight className="h-5 w-5 text-zinc-400" />
                )}
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Mobile Sticky CTA Footer */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-[#DBE2EF] shadow-[0_-20px_40px_rgba(0,0,0,0.05)] z-40">
        <div className="flex items-center justify-between gap-4 max-w-4xl mx-auto">
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider truncate">{course.title}</p>
            <p className="text-[#112D4E] font-extrabold text-sm truncate">{enrolled ? 'Course Enrolled' : 'Ready to learn?'}</p>
          </div>
          <div className="shrink-0">
            {enrolled ? (
              <button
                onClick={() => {
                  const nextLesson = lessons.find((l) => !completedLessons.includes(l.id)) || lessons[0];
                  handleLessonClick(nextLesson?.id);
                }}
                className="flex items-center gap-1.5 px-6 py-2.5 bg-[#3F72AF] text-white text-sm font-bold rounded-xl shadow-md shadow-[#3F72AF]/20 transition-all"
              >
                {hasStarted ? 'Resume' : 'Start'}
                <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={handleEnroll}
                disabled={isEnrolling}
                className="flex items-center gap-2 px-6 py-2.5 bg-[#3F72AF] disabled:opacity-50 text-white font-bold text-sm rounded-xl shadow-md shadow-[#3F72AF]/20 transition-all"
              >
                {isEnrolling ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                ) : !isSubscribed ? (
                  <span className="flex items-center gap-1.5">
                    Premium <Sparkles className="h-4 w-4 text-amber-300 fill-amber-300" />
                  </span>
                ) : (
                  'Enroll'
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
