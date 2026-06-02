// src/app/courses/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/auth-context';
import { db } from '@/lib/firebase/client';
import { collection, getDocs, query, where } from 'firebase/firestore';
import DashboardLayout from '@/components/dashboard-layout';
import {
  Search,
  BookOpen,
  Clock,
  Lock,
  ChevronRight,
  Filter,
  Sparkles,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

interface Subject {
  id: string;
  title: string;
  description: string;
}

interface Course {
  id: string;
  subjectId: string;
  title: string;
  description: string;
  estimatedDurationMinutes: number;
  totalLessons: number;
  tags: string[];
}

const DEFAULT_SUBJECTS: Subject[] = [
  { id: 'sub-se', title: 'Software Engineering', description: 'Design, build, and deploy systems at scale.' },
  { id: 'sub-fin', title: 'Finance & Quantitative Trading', description: 'Algorithmic trading and financial market analytics.' },
  { id: 'sub-ds', title: 'Data Science & Machine Learning', description: 'Deep learning, neural networks, and AI architectures.' },
];

const DEFAULT_COURSES: Course[] = [
  {
    id: 'course-1',
    subjectId: 'sub-se',
    title: 'Advanced System Design & Architecture',
    description: 'Learn to design highly scalable, fault-tolerant systems. Covers microservices, load balancing, caching, database sharding, and event-driven architectures.',
    estimatedDurationMinutes: 600,
    totalLessons: 20,
    tags: ['Architecture', 'Scalability', 'Backend'],
  },
  {
    id: 'course-2',
    subjectId: 'sub-fin',
    title: 'Financial Markets & Algorithmic Trading',
    description: 'Master quantitative finance and automated trading strategies. Covers market mechanics, technical indicators, order books, and building trading bots in Python.',
    estimatedDurationMinutes: 480,
    totalLessons: 15,
    tags: ['Trading', 'Python', 'Quantitative'],
  },
  {
    id: 'course-3',
    subjectId: 'sub-ds',
    title: 'Applied Machine Learning & Neural Networks',
    description: 'Design and train deep learning models. Practical guide to supervised learning, NLP, computer vision, and deploying neural networks to production.',
    estimatedDurationMinutes: 720,
    totalLessons: 25,
    tags: ['AI', 'Neural Networks', 'TensorFlow'],
  },
  {
    id: 'course-4',
    subjectId: 'sub-se',
    title: 'Systems Programming with Rust',
    description: 'Write high-performance, memory-safe software without a garbage collector. Master concurrency, lifetimes, and safety guarantees.',
    estimatedDurationMinutes: 540,
    totalLessons: 18,
    tags: ['Rust', 'Systems', 'Performance'],
  },
];

export default function CoursesPage() {
  const router = useRouter();
  const { user, profile, loading, logout } = useAuth();

  const [subjects, setSubjects] = useState<Subject[]>(DEFAULT_SUBJECTS);
  const [courses, setCourses] = useState<Course[]>(DEFAULT_COURSES);
  const [enrollments, setEnrollments] = useState<string[]>([]); // Course IDs enrolled
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoadingContent, setIsLoadingContent] = useState<boolean>(true);

  // Route protection guard
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  // Load subjects, courses and enrollments
  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      setIsLoadingContent(true);
      try {
        // 1. Fetch user enrollments from local API
        const enrollRes = await fetch('/api/v1/enrollments');
        if (enrollRes.ok) {
          const enrollData = await enrollRes.json();
          if (enrollData.enrollments) {
            setEnrollments(enrollData.enrollments.map((e: { courseId: string }) => e.courseId));
          }
        }

        // 2. Load subjects from Firestore
        const subjectsSnap = await getDocs(
          query(collection(db, 'subjects'), where('status', '==', 'published'))
        );
        if (!subjectsSnap.empty) {
          const fetchedSubjects = subjectsSnap.docs.map((doc) => ({
            id: doc.id,
            title: doc.data().title || '',
            description: doc.data().description || '',
          }));
          setSubjects(fetchedSubjects);
        }

        // 3. Load courses from Firestore
        const coursesSnap = await getDocs(
          query(collection(db, 'courses'), where('status', '==', 'published'))
        );
        if (!coursesSnap.empty) {
          const fetchedCourses = coursesSnap.docs.map((doc) => ({
            id: doc.id,
            subjectId: doc.data().subjectId || '',
            title: doc.data().title || '',
            description: doc.data().description || '',
            estimatedDurationMinutes: doc.data().estimatedDurationMinutes || 120,
            totalLessons: doc.data().totalLessons || 5,
            tags: doc.data().tags || [],
          }));
          setCourses(fetchedCourses);
        }
      } catch (err) {
        console.error('Failed to load courses from Firestore emulator:', err);
        // Silently fallback to mock data since emulator might be empty
      } finally {
        setIsLoadingContent(false);
      }
    };

    fetchData();
  }, [user]);

  if (loading || !user || !profile) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#F9F7F7] text-[#112D4E]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#3F72AF] border-t-transparent"></div>
          <p className="text-zinc-600 text-sm font-medium animate-pulse">Loading curriculum catalog...</p>
        </div>
      </div>
    );
  }

  const isSubscribed = profile.subscription === 'active' || profile.subscription === 'cancelled';

  // Filter courses based on subject & search query
  const filteredCourses = courses.filter((course) => {
    const matchesSubject = selectedSubjectId === 'all' || course.subjectId === selectedSubjectId;
    const matchesSearch =
      course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      course.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      course.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesSubject && matchesSearch;
  });

  return (
    <DashboardLayout>
      <div className="p-6 md:p-10 max-w-6xl mx-auto">
        {/* Header */}
        <header className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-extrabold text-[#112D4E] tracking-tight">
                Curriculum Exploration
              </h1>
              <p className="text-zinc-550 text-sm mt-1">
                Browse our premium pathways or build customized technology sets.
              </p>
            </div>
            {!isSubscribed && (
              <button
                onClick={() => router.push('/dashboard')}
                className="flex items-center gap-2 self-start px-4 py-2 bg-gradient-to-r from-[#112D4E] to-[#3F72AF] hover:opacity-95 text-white font-semibold text-xs rounded-xl shadow-sm transition-all"
              >
                <Sparkles className="h-4 w-4 animate-pulse text-amber-300" />
                Unlock Premium Access
              </button>
            )}
          </div>
        </header>

        {/* Search & Subject Tabs Panel */}
        <div className="bg-white border border-[#DBE2EF] rounded-2xl p-5 shadow-sm mb-8 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-zinc-450" />
              <input
                type="text"
                placeholder="Search systems, strategies, modules, tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#F9F7F7] border border-[#DBE2EF] focus:border-[#3F72AF] focus:ring-1 focus:ring-[#3F72AF]/30 rounded-xl pl-10 pr-4 py-3 text-sm text-[#112D4E] placeholder-zinc-450 outline-none transition-all"
              />
            </div>

            {/* Filter Indicator */}
            <div className="flex items-center gap-2 px-4 py-3 bg-[#F9F7F7] border border-[#DBE2EF] rounded-xl text-zinc-550 text-sm font-semibold select-none">
              <Filter className="h-4 w-4 text-[#3F72AF]" />
              <span>Catalog Filters</span>
            </div>
          </div>

          {/* Subjects Tabs Row */}
          <div className="flex flex-wrap gap-2 pt-2">
            <button
              onClick={() => setSelectedSubjectId('all')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                selectedSubjectId === 'all'
                  ? 'bg-[#3F72AF] text-white border-[#3F72AF]'
                  : 'bg-white border-[#DBE2EF] text-zinc-550 hover:bg-[#F9F7F7]'
              }`}
            >
              All Subjects
            </button>
            {subjects.map((sub) => (
              <button
                key={sub.id}
                onClick={() => setSelectedSubjectId(sub.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                  selectedSubjectId === sub.id
                    ? 'bg-[#3F72AF] text-white border-[#3F72AF]'
                    : 'bg-white border-[#DBE2EF] text-zinc-550 hover:bg-[#F9F7F7]'
                }`}
              >
                {sub.title}
              </button>
            ))}
          </div>
        </div>

        {/* Content Loading State */}
        {isLoadingContent ? (
          <div className="flex justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#3F72AF] border-t-transparent"></div>
          </div>
        ) : (
          /* Courses Grid */
          <div>
            {filteredCourses.length === 0 ? (
              <div className="bg-white border border-[#DBE2EF] rounded-2xl p-12 text-center shadow-sm">
                <AlertCircle className="h-10 w-10 text-zinc-400 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-[#112D4E]">No courses found</h3>
                <p className="text-zinc-550 text-sm mt-1">
                  Try refining your search keyword or selecting a different subject filter tab.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {filteredCourses.map((course) => {
                  const enrolled = enrollments.includes(course.id);
                  return (
                    <div
                      key={course.id}
                      className="bg-white border border-[#DBE2EF] hover:border-[#3F72AF]/40 rounded-2xl p-6 transition-all shadow-sm flex flex-col justify-between group"
                    >
                      <div>
                        {/* Tags & Access Status */}
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex flex-wrap gap-1.5">
                            {course.tags.map((tag) => (
                              <span
                                key={tag}
                                className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#F9F7F7] border border-[#DBE2EF] text-zinc-550"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>

                          {/* Access Indicators */}
                          {enrolled ? (
                            <span className="flex items-center gap-1 text-emerald-650 text-xs font-bold bg-emerald-50 border border-emerald-250 px-2.5 py-1 rounded-full">
                              <CheckCircle className="h-3.5 w-3.5" />
                              Enrolled
                            </span>
                          ) : !isSubscribed ? (
                            <span className="flex items-center gap-1 text-[#3F72AF] text-xs font-bold bg-[#3F72AF]/10 border border-[#3F72AF]/20 px-2.5 py-1 rounded-full">
                              <Lock className="h-3.5 w-3.5" />
                              Premium
                            </span>
                          ) : null}
                        </div>

                        {/* Title & Description */}
                        <h3 className="text-lg font-extrabold text-[#112D4E] group-hover:text-[#3F72AF] transition-colors mb-2">
                          {course.title}
                        </h3>
                        <p className="text-zinc-550 text-sm leading-relaxed mb-4 line-clamp-3">
                          {course.description}
                        </p>
                      </div>

                      {/* Course Footer Info & CTA */}
                      <div className="pt-4 border-t border-zinc-100 flex items-center justify-between text-xs mt-4">
                        <div className="flex items-center gap-4 text-zinc-500 font-semibold">
                          <span className="flex items-center gap-1.5">
                            <BookOpen className="h-4 w-4" />
                            {course.totalLessons} Lessons
                          </span>
                          <span className="flex items-center gap-1.5">
                            <Clock className="h-4 w-4" />
                            {Math.round(course.estimatedDurationMinutes / 60)} hrs
                          </span>
                        </div>

                        <button
                          onClick={() => router.push(`/courses/${course.id}`)}
                          className="flex items-center gap-1 font-bold text-[#3F72AF] hover:text-[#3F72AF]/85 transition-colors group/btn cursor-pointer"
                        >
                          {enrolled ? 'Resume Study' : 'View Syllabus'}
                          <ChevronRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-0.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
