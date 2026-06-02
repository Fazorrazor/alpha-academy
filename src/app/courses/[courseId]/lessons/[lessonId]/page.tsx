// src/app/courses/[courseId]/lessons/[lessonId]/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/auth-context';
import { db } from '@/lib/firebase/client';
import { doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import DashboardLayout from '@/components/dashboard-layout';
import DiscussionsPanel from '@/components/discussions-panel';
import {
  PlayCircle,
  FileText,
  CheckCircle,
  ChevronRight,
  ChevronLeft,
  ArrowLeft,
  Sparkles,
  AlertCircle,
  Info,
  Menu,
  X,
  Lock
} from 'lucide-react';

interface Course {
  id: string;
  title: string;
  description: string;
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
    description: 'Learn to design highly scalable, fault-tolerant systems.',
  },
  'course-2': {
    id: 'course-2',
    title: 'Financial Markets & Algorithmic Trading',
    description: 'Master quantitative finance and automated trading strategies.',
  },
  'course-3': {
    id: 'course-3',
    title: 'Applied Machine Learning & Neural Networks',
    description: 'Design and train deep learning models.',
  },
  'course-4': {
    id: 'course-4',
    title: 'Systems Programming with Rust',
    description: 'Write high-performance, memory-safe software without a garbage collector.',
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
  params: Promise<{ courseId: string; lessonId: string }>;
}

export default function LessonPage({ params }: PageProps) {
  const router = useRouter();
  const { user, profile, loading, logout, refreshProfile } = useAuth();

  const unwrappedParams = React.use(params);
  const courseId = unwrappedParams.courseId;
  const lessonId = unwrappedParams.lessonId;

  const [course, setCourse] = useState<Course | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [currentLesson, setCurrentLesson] = useState<Lesson | null>(null);
  const [completedLessons, setCompletedLessons] = useState<string[]>([]);
  
  const [isMarkingComplete, setIsMarkingComplete] = useState<boolean>(false);
  const [isLoadingContent, setIsLoadingContent] = useState<boolean>(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  // Content verification state
  const [isMediaFinished, setIsMediaFinished] = useState<boolean>(false);
  const [mediaProgress, setMediaProgress] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  // Reset verification when lesson changes
  useEffect(() => {
    setIsMediaFinished(false);
    setMediaProgress(0);
    setIsPlaying(false);
  }, [lessonId]);

  // Simulate video playback progress
  useEffect(() => {
    if (isPlaying && mediaProgress < 100) {
      const timer = setTimeout(() => {
        setMediaProgress(prev => {
          const next = prev + 25; // Completes in 4 seconds for simulation
          if (next >= 100) {
            setIsMediaFinished(true);
            setIsPlaying(false);
            return 100;
          }
          return next;
        });
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isPlaying, mediaProgress]);

  // Route protection guard
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  // Load lesson data, course syllabus & progress
  useEffect(() => {
    if (!user || !courseId || !lessonId) return;

    const fetchData = async () => {
      setIsLoadingContent(true);
      setMessage(null);
      try {
        // 1. Fetch user enrollment for validation
        const enrollRes = await fetch('/api/v1/enrollments');
        if (enrollRes.ok) {
          const enrollData = await enrollRes.json();
          if (enrollData.enrollments) {
            const hasEnrollment = enrollData.enrollments.some((e: { courseId: string }) => e.courseId === courseId);
            if (!hasEnrollment) {
              router.push(`/courses/${courseId}`);
              return;
            }

            // Send access ping to track last accessed time
            fetch('/api/v1/enrollments/access', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ courseId }),
            }).catch((err) => console.error('Failed to send access ping:', err));
          }
        }

        // 2. Fetch specific course details
        const courseDoc = await getDoc(doc(db, 'courses', courseId));
        if (courseDoc.exists()) {
          const courseData = courseDoc.data();
          setCourse({
            id: courseDoc.id,
            title: courseData.title || '',
            description: courseData.description || '',
          });
        } else if (DEFAULT_COURSES[courseId]) {
          setCourse(DEFAULT_COURSES[courseId]);
        }

        // 3. Fetch lessons list
        const lessonsSnap = await getDocs(
          query(collection(db, `courses/${courseId}/lessons`), where('status', '==', 'published'))
        );
        let sortedLessons: Lesson[] = [];
        if (!lessonsSnap.empty) {
          sortedLessons = lessonsSnap.docs
            .map((doc) => ({
              id: doc.id,
              title: doc.data().title || '',
              description: doc.data().description || '',
              type: (doc.data().type as 'video' | 'pdf') || 'video',
              order: doc.data().order || 1,
            }))
            .sort((a, b) => a.order - b.order);
        } else if (DEFAULT_LESSONS[courseId]) {
          sortedLessons = DEFAULT_LESSONS[courseId];
        }
        setLessons(sortedLessons);

        // 4. Find current lesson
        const matched = sortedLessons.find((l) => l.id === lessonId);
        if (matched) {
          setCurrentLesson(matched);
        } else {
          setMessage({ type: 'error', text: 'Module content could not be located.' });
        }

        // 5. Fetch completed lessons from student progress collection
        // For simplicity in mocked/emulator setups we query the progress subcollection
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
        }
      } catch (err) {
        console.error('Failed to load lesson viewport:', err);
        // Emulators fallback
        if (DEFAULT_COURSES[courseId]) setCourse(DEFAULT_COURSES[courseId]);
        if (DEFAULT_LESSONS[courseId]) {
          const sorted = DEFAULT_LESSONS[courseId];
          setLessons(sorted);
          const matched = sorted.find((l) => l.id === lessonId);
          if (matched) setCurrentLesson(matched);
        }
      } finally {
        setIsLoadingContent(false);
      }
    };

    fetchData();
  }, [user, courseId, lessonId, router]);

  const handleMarkAsCompleted = async () => {
    if (!currentLesson) return;

    setIsMarkingComplete(true);
    setMessage(null);

    try {
      const res = await fetch('/api/v1/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lessonId: currentLesson.id,
          courseId,
          completed: true,
          lastPositionSeconds: 100,
          watchedPercent: 100,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setCompletedLessons((prev) => [...new Set([...prev, currentLesson.id])]);
        await refreshProfile(); // Refresh session points on top header
        
        if (data.pointsAwarded > 0) {
          setMessage({
            type: 'success',
            text: `🎉 Congratulations! Module completed. You earned +10 points!`,
          });
        } else {
          setMessage({
            type: 'success',
            text: 'Module marked as completed.',
          });
        }
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to submit progress.' });
      }
    } catch (err) {
      console.error('Progress record error:', err);
      setMessage({ type: 'error', text: 'Network connection failed.' });
    } finally {
      setIsMarkingComplete(false);
    }
  };

  const handleNavigateLesson = (dir: 'next' | 'prev') => {
    if (!lessons.length || !currentLesson) return;
    const currentIdx = lessons.findIndex((l) => l.id === currentLesson.id);
    if (dir === 'next' && currentIdx < lessons.length - 1) {
      router.push(`/courses/${courseId}/lessons/${lessons[currentIdx + 1].id}`);
    } else if (dir === 'prev' && currentIdx > 0) {
      router.push(`/courses/${courseId}/lessons/${lessons[currentIdx - 1].id}`);
    }
  };

  if (loading || !user || !profile || isLoadingContent) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#F9F7F7] text-[#112D4E]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#3F72AF] border-t-transparent"></div>
          <p className="text-zinc-650 text-sm font-medium animate-pulse">Initializing media engine...</p>
        </div>
      </div>
    );
  }

  const currentLessonIdx = lessons.findIndex((l) => l.id === currentLesson?.id);
  const isFirstLesson = currentLessonIdx === 0;
  const isLastLesson = currentLessonIdx === lessons.length - 1;
  const isCurrentCompleted = currentLesson ? completedLessons.includes(currentLesson.id) : false;

  return (
    <DashboardLayout>
      <div className="h-full flex flex-col lg:flex-row overflow-hidden">
        {/* Left Side: Viewer Pane */}
        <section className="flex-1 p-6 md:p-8 overflow-y-auto space-y-6">
          {/* Header Actions */}
          <div className="flex items-center justify-between pb-2">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push(`/courses/${courseId}`)}
                className="flex items-center gap-2 text-zinc-500 hover:text-[#112D4E] text-xs font-bold transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Syllabus Outline</span>
                <span className="sm:hidden">Back</span>
              </button>
              
              <button
                onClick={() => setIsMobileMenuOpen(true)}
                className="flex lg:hidden items-center gap-1.5 px-3 py-1.5 bg-white border border-[#DBE2EF] rounded-lg text-xs font-bold text-[#112D4E] shadow-sm active:bg-zinc-50"
              >
                <Menu className="h-3.5 w-3.5" />
                Modules
              </button>
            </div>

            {/* Score points badge */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-[#3F72AF]/10 border border-[#3F72AF]/20 rounded-full text-[#3F72AF] text-xs font-bold shadow-sm">
              <Sparkles className="h-3.5 w-3.5 animate-pulse text-amber-500 fill-amber-400" />
              <span className="hidden sm:inline">Current Score: {profile.totalPoints || 0} pts</span>
              <span className="sm:hidden">{profile.totalPoints || 0} pts</span>
            </div>
          </div>

          {/* Feedback message */}
          {message && (
            <div
              className={`flex items-start gap-3 rounded-2xl p-4 text-sm border ${
                message.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : 'bg-red-50 border-red-200 text-red-650'
              }`}
            >
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <span>{message.text}</span>
            </div>
          )}

          {/* Interactive Media Screen */}
          {currentLesson ? (
            <div className="space-y-6">
              {/* Media viewport card */}
              <div className="sticky md:static top-[-24px] z-30 bg-white border border-[#DBE2EF] rounded-2xl overflow-hidden shadow-xl ring-4 ring-[#F9F7F7]">
                {currentLesson.type === 'video' ? (
                  /* Video Player viewport container */
                  <div className="relative aspect-video bg-zinc-950 flex flex-col items-center justify-center text-white">
                    {/* Simulated streaming player */}
                    <div className="absolute inset-0 bg-gradient-to-tr from-[#112D4E]/25 to-transparent z-0"></div>
                    
                    {mediaProgress === 100 ? (
                      <CheckCircle className="h-16 w-16 text-emerald-500 relative z-10" />
                    ) : isPlaying ? (
                      <div className="relative z-10 w-48">
                        <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
                          <div className="h-full bg-[#3F72AF] transition-all duration-1000" style={{ width: `${mediaProgress}%` }}></div>
                        </div>
                        <p className="text-center text-xs mt-2 text-zinc-400 font-bold">Playing... {mediaProgress}%</p>
                      </div>
                    ) : (
                      <PlayCircle 
                        onClick={() => setIsPlaying(true)}
                        className="h-16 w-16 text-[#3F72AF]/90 fill-white/10 hover:scale-105 duration-200 cursor-pointer relative z-10 animate-pulse" 
                      />
                    )}

                    <p className="text-xs text-zinc-400 font-medium mt-3 relative z-10">
                      {mediaProgress === 100 ? 'Video Completed' : 'Streaming secure HLS delivery system...'}
                    </p>
                    <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between text-xs text-zinc-350 z-10 px-2 bg-black/40 py-2.5 rounded-lg backdrop-blur-sm">
                      <span className="font-semibold">0:00 / 12:45</span>
                      <span className="flex items-center gap-1.5 font-bold text-[#3F72AF]">
                        <span className="h-2 w-2 rounded-full bg-red-650 animate-ping"></span>
                        1080p stream
                      </span>
                    </div>
                  </div>
                ) : (
                  /* PDF document viewer viewport container */
                  <div className="p-10 bg-[#F9F7F7] flex flex-col items-center justify-center text-[#112D4E] min-h-[320px]">
                    <FileText className="h-20 w-20 text-orange-600 mb-4 animate-bounce" />
                    <h4 className="font-extrabold text-lg text-center max-w-md">
                      {currentLesson.title} — Reference Guide
                    </h4>
                    <p className="text-xs text-zinc-550 mt-1 max-w-sm text-center">
                      Interactive PDF handbook and study guidelines are ready for secure download.
                    </p>
                    <button 
                      onClick={() => {
                        setIsMediaFinished(true);
                        // window.open(pdfUrl, '_blank');
                      }}
                      className="mt-6 flex items-center gap-2 px-5 py-2.5 bg-white border border-[#DBE2EF] hover:bg-[#DBE2EF]/30 text-zinc-700 font-semibold rounded-xl text-sm transition-all cursor-pointer shadow-sm"
                    >
                      Download Reference Document (PDF)
                    </button>
                    {isMediaFinished && (
                      <p className="text-xs text-emerald-650 font-bold mt-4 flex items-center gap-1.5">
                        <CheckCircle className="h-4 w-4" />
                        Document downloaded.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Lesson Details */}
              <div className="bg-white border border-[#DBE2EF] rounded-2xl p-6 md:p-8 space-y-4 shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <h3 className="text-xl md:text-2xl font-extrabold text-[#112D4E] tracking-tight min-w-0">
                      {currentLesson.title}
                    </h3>

                    <div className="shrink-0">
                      {isCurrentCompleted ? (
                        <span className="flex items-center justify-center gap-1 text-emerald-650 bg-emerald-50 border border-emerald-250 px-3 py-1.5 rounded-full text-xs font-bold w-full sm:w-auto">
                          <CheckCircle className="h-4 w-4" />
                          Completed
                        </span>
                      ) : (
                        <button
                          onClick={handleMarkAsCompleted}
                          disabled={isMarkingComplete || !isMediaFinished}
                          title={!isMediaFinished ? "Please finish the media to unlock" : ""}
                          className={`flex w-full sm:w-auto items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl transition-all shadow-md ${
                            !isMediaFinished 
                              ? 'bg-zinc-100 text-zinc-500 border border-zinc-200 cursor-not-allowed shadow-none'
                              : 'bg-gradient-to-r from-[#112D4E] to-[#3F72AF] hover:opacity-95 text-white cursor-pointer'
                          }`}
                        >
                          {isMarkingComplete ? (
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"></div>
                          ) : !isMediaFinished ? (
                            <>
                              <Lock className="h-3.5 w-3.5" />
                              <span className="truncate">
                                {currentLesson.type === 'video' ? 'Watch Video to Unlock' : 'Read PDF to Unlock'}
                              </span>
                            </>
                          ) : (
                            'Complete Module'
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  <p className="text-zinc-550 text-sm leading-relaxed">
                    {currentLesson.description}
                  </p>
                </div>

              <DiscussionsPanel
                courseId={courseId}
                lessonId={currentLesson.id}
                isPremium={profile.subscription === 'active'}
              />

              {/* Navigation Footer */}
              <div className="flex items-center justify-between pt-4">
                <button
                  onClick={() => handleNavigateLesson('prev')}
                  disabled={isFirstLesson}
                  className="flex items-center gap-1.5 px-4 py-2.5 border border-[#DBE2EF] bg-white text-zinc-500 hover:text-[#112D4E] hover:bg-[#F9F7F7] disabled:opacity-30 disabled:pointer-events-none rounded-xl text-xs font-bold transition-all"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous Module
                </button>
                <button
                  onClick={() => handleNavigateLesson('next')}
                  disabled={isLastLesson}
                  className="flex items-center gap-1.5 px-4 py-2.5 border border-[#DBE2EF] bg-white text-zinc-500 hover:text-[#112D4E] hover:bg-[#F9F7F7] disabled:opacity-30 disabled:pointer-events-none rounded-xl text-xs font-bold transition-all"
                >
                  Next Module
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-[#DBE2EF] rounded-2xl p-12 text-center shadow-sm">
              <AlertCircle className="h-10 w-10 text-zinc-400 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-[#112D4E]">Lesson not found</h3>
              <p className="text-zinc-550 text-sm mt-1">
                Please use the sidebar outline to select a valid module.
              </p>
            </div>
          )}
        </section>

        {/* Mobile Sidebar Backdrop */}
        {isMobileMenuOpen && (
          <div 
            className="fixed inset-0 bg-[#112D4E]/40 backdrop-blur-sm z-40 lg:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}

        {/* Right Side: Course Outline Sidebar */}
        <aside className={`fixed inset-y-0 right-0 z-50 w-[85%] max-w-sm bg-white border-l border-[#DBE2EF] shadow-2xl transform transition-transform duration-300 lg:relative lg:translate-x-0 lg:w-80 lg:shadow-none lg:flex flex-col shrink-0 ${isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full'}`}>
          <div className="p-5 border-b border-[#DBE2EF] bg-[#F9F7F7] flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold text-zinc-400">
                Active Course Outline
              </span>
              <h4 className="font-extrabold text-[#112D4E] text-sm mt-1 truncate">
                {course?.title || 'Syllabus Modules'}
              </h4>
            </div>
            <button onClick={() => setIsMobileMenuOpen(false)} className="lg:hidden p-2 text-zinc-500 hover:text-[#112D4E] hover:bg-zinc-200 rounded-full transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 divide-y divide-[#DBE2EF]">
            {lessons.map((lesson, idx) => {
              const isActive = lesson.id === currentLesson?.id;
              const isCompleted = completedLessons.includes(lesson.id);

              return (
                <div
                  key={lesson.id}
                  onClick={() => {
                    router.push(`/courses/${courseId}/lessons/${lesson.id}`);
                    setIsMobileMenuOpen(false);
                  }}
                  className={`p-4 flex items-start gap-3 transition-all cursor-pointer select-none ${
                    isActive
                      ? 'bg-[#3F72AF]/10 border-l-4 border-l-[#3F72AF]'
                      : 'hover:bg-[#F9F7F7]'
                  }`}
                >
                  <div className="mt-0.5 shrink-0">
                    {isCompleted ? (
                      <CheckCircle className="h-4 w-4 text-emerald-650" />
                    ) : lesson.type === 'video' ? (
                      <PlayCircle className={`h-4 w-4 ${isActive ? 'text-[#3F72AF]' : 'text-zinc-400'}`} />
                    ) : (
                      <FileText className={`h-4 w-4 ${isActive ? 'text-[#3F72AF]' : 'text-zinc-400'}`} />
                    )}
                  </div>
                  <div className="min-w-0">
                    <span className="text-[9px] uppercase font-bold text-zinc-400">
                      Module {idx + 1} — {lesson.type}
                    </span>
                    <h5 className={`font-bold text-xs mt-0.5 ${isActive ? 'text-[#3F72AF]' : 'text-[#112D4E]'} truncate`}>
                      {lesson.title}
                    </h5>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-4 border-t border-[#DBE2EF] bg-zinc-50 flex items-start gap-2.5">
            <Info className="h-4 w-4 text-[#3F72AF] shrink-0 mt-0.5" />
            <p className="text-[10px] text-zinc-500 leading-relaxed">
              Completing each module awards **10 points** to your student profile score. Pass the final assessment to claim certification.
            </p>
          </div>
        </aside>
      </div>
    </DashboardLayout>
  );
}
