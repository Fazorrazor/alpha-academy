'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import AdminLayout from '@/components/admin-layout';
import { Course, Subject } from '@/lib/types';
import { Video, Plus, Edit2, X, AlertCircle, Info, Globe, EyeOff, Loader2 } from 'lucide-react';

function AdminCoursesContent() {
  const searchParams = useSearchParams();
  const [courses, setCourses] = useState<Course[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<{
    subjectTitle: string;
    title: string;
    description: string;
    status: string;
    order: number | '';
    estimatedDurationMinutes: number | '';
  }>({ 
    subjectTitle: '', 
    title: '', 
    description: '', 
    status: 'draft', 
    order: '',
    estimatedDurationMinutes: ''
  });

  useEffect(() => {
    fetchData();
    if (searchParams.get('action') === 'new') {
      setIsModalOpen(true);
    }
  }, [searchParams]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [coursesRes, subjectsRes] = await Promise.all([
        fetch('/api/v1/admin/courses'),
        fetch('/api/v1/admin/subjects')
      ]);
      
      const coursesData = await coursesRes.json();
      const subjectsData = await subjectsRes.json();

      if (!coursesRes.ok) throw new Error(coursesData.error || 'Failed to fetch courses');
      if (!subjectsRes.ok) throw new Error(subjectsData.error || 'Failed to fetch subjects');

      setCourses(coursesData.courses);
      setSubjects(subjectsData.subjects);
      
      // Default selection for the form (optional now since they can type anything)
      if (subjectsData.subjects.length > 0) {
        setFormData(prev => ({ ...prev, subjectTitle: subjectsData.subjects[0].title }));
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.subjectTitle) {
      setError("Please enter a Parent Subject name.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/admin/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          order: formData.order === '' ? 0 : formData.order,
          estimatedDurationMinutes: formData.estimatedDurationMinutes === '' ? 0 : formData.estimatedDurationMinutes
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create course');
      
      setCourses(prev => [...prev, data].sort((a, b) => a.order - b.order));
      setIsModalOpen(false);
      setFormData(prev => ({ ...prev, title: '', description: '', order: (typeof prev.order === 'number' ? prev.order : 0) + 1, estimatedDurationMinutes: '' }));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getSubjectName = (subjectId: string) => {
    return subjects.find(s => s.id === subjectId)?.title || 'Unknown Subject';
  };

  const handlePublishToggle = async (course: Course) => {
    const action = course.status === 'published' ? 'unpublish' : 'publish';
    setPublishingId(course.id);
    setError(null);
    try {
      const res = await fetch('/api/v1/admin/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetType: 'course',
          targetId: course.id,
          action,
          subjectId: course.subjectId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update status');
      setCourses((prev) =>
        prev.map((c) => (c.id === course.id ? { ...c, status: data.newStatus } : c))
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setPublishingId(null);
    }
  };

  return (
    <AdminLayout>
      <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-zinc-900 tracking-tight">Manage Courses</h1>
            <p className="text-sm text-zinc-500 mt-1">Create courses and assign them to subjects.</p>
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-sm transition-all shrink-0"
          >
            <Plus className="h-4 w-4" />
            Create Course
          </button>
        </div>

        {error && (
          <div className="p-4 bg-red-50 text-red-600 border border-red-200 rounded-xl flex items-center gap-3 text-sm">
            <AlertCircle className="h-5 w-5 shrink-0" />
            {error}
          </div>
        )}

        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-12 flex justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
            </div>
          ) : courses.length === 0 ? (
            <div className="p-12 text-center">
              <div className="h-12 w-12 bg-zinc-50 rounded-full flex items-center justify-center mx-auto mb-3">
                <Video className="h-6 w-6 text-zinc-400" />
              </div>
              <h3 className="text-lg font-bold text-zinc-900">No courses found</h3>
              <p className="text-zinc-500 text-sm mt-1">Get started by creating your first course.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-zinc-50 border-b border-zinc-200">
                    <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Course</th>
                    <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Subject</th>
                    <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {courses.map((course) => (
                    <tr key={course.id} className="hover:bg-zinc-50/50 transition-colors group">
                      <td className="px-6 py-4">
                        <Link href={`/admin/courses/${course.id}`} className="block">
                          <p className="text-sm font-bold text-zinc-900 group-hover:text-indigo-600 transition-colors">{course.title}</p>
                          <p className="text-xs text-zinc-500 truncate max-w-xs">{course.description}</p>
                        </Link>
                      </td>
                      <td className="px-6 py-4">
                         <span className="inline-flex px-2 py-1 text-xs font-medium bg-zinc-100 text-zinc-600 rounded-md">
                           {getSubjectName(course.subjectId)}
                         </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2.5 py-1 text-[10px] font-bold uppercase rounded-full border ${
                          course.status === 'published' 
                            ? 'bg-emerald-50 text-emerald-600 border-emerald-200' 
                            : 'bg-amber-50 text-amber-600 border-amber-200'
                        }`}>
                          {course.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handlePublishToggle(course)}
                            disabled={publishingId === course.id}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all disabled:opacity-50 ${
                              course.status === 'published'
                                ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                            }`}
                          >
                            {publishingId === course.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : course.status === 'published' ? (
                              <><EyeOff className="h-3.5 w-3.5" /> Unpublish</>
                            ) : (
                              <><Globe className="h-3.5 w-3.5" /> Publish</>
                            )}
                          </button>
                          <Link 
                            href={`/admin/courses/${course.id}`}
                            className="px-3 py-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
                          >
                            Builder
                          </Link>
                          <button className="p-2 text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                            <Edit2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Create Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-8">
            <div className="p-6 border-b border-zinc-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <h2 className="text-xl font-bold text-zinc-900">Create New Course</h2>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-full transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 flex gap-3 text-sm text-indigo-800 mb-2">
                <AlertCircle className="h-5 w-5 shrink-0 text-indigo-600" />
                <p>
                  <strong>About Courses:</strong> Courses hold individual lessons and quizzes. Every course must be attached to a parent Subject to appear properly in the catalog.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="relative">
                  <label className="flex items-center gap-2 text-xs font-bold text-zinc-700 mb-1 group relative w-fit">
                    Parent Subject
                    <Info className="h-3.5 w-3.5 text-zinc-400 hover:text-indigo-500 cursor-help" />
                    <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-48 p-2 bg-zinc-900 text-white text-[10px] rounded-lg shadow-lg z-20">
                      Type a new subject name to create it, or select an existing one.
                    </div>
                  </label>
                  <input
                    type="text"
                    required
                    list="subjects-list"
                    placeholder="e.g. Mathematics"
                    value={formData.subjectTitle}
                    onChange={(e) => setFormData({ ...formData, subjectTitle: e.target.value })}
                    className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  />
                  <datalist id="subjects-list">
                    {subjects.map(sub => (
                      <option key={sub.id} value={sub.title} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="flex items-center gap-2 text-xs font-bold text-zinc-700 mb-1 group relative w-fit">
                    Course Title
                    <Info className="h-3.5 w-3.5 text-zinc-400 hover:text-indigo-500 cursor-help" />
                    <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-48 p-2 bg-zinc-900 text-white text-[10px] rounded-lg shadow-lg z-20">
                      The main title displayed on the course card in the catalog.
                    </div>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g. Intro to JavaScript"
                    className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2 text-xs font-bold text-zinc-700 mb-1 group relative w-fit">
                  Description
                  <Info className="h-3.5 w-3.5 text-zinc-400 hover:text-indigo-500 cursor-help" />
                  <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-64 p-2 bg-zinc-900 text-white text-[10px] rounded-lg shadow-lg z-20">
                    A short summary of what students will learn. Appears on the course details page.
                  </div>
                </label>
                <textarea
                  required
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="What will students learn in this course?"
                  className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-zinc-100">
                <div>
                  <label className="flex items-center gap-2 text-xs font-bold text-zinc-700 mb-1 group relative w-fit">
                    Duration (Minutes)
                    <Info className="h-3.5 w-3.5 text-zinc-400 hover:text-indigo-500 cursor-help" />
                    <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-48 p-2 bg-zinc-900 text-white text-[10px] rounded-lg shadow-lg z-20">
                      Total estimated time to complete the course in minutes.
                    </div>
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.estimatedDurationMinutes}
                    onChange={(e) => setFormData({ ...formData, estimatedDurationMinutes: e.target.value === '' ? '' : parseInt(e.target.value) })}
                    placeholder="e.g. 120"
                    className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  />
                </div>
                
                <div>
                  <label className="flex items-center gap-2 text-xs font-bold text-zinc-700 mb-1 group relative w-fit">
                    Display Sort Order
                    <Info className="h-3.5 w-3.5 text-zinc-400 hover:text-indigo-500 cursor-help" />
                    <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-48 p-2 bg-zinc-900 text-white text-[10px] rounded-lg shadow-lg z-20">
                      Lower numbers appear first within the parent subject list.
                    </div>
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.order}
                    onChange={(e) => setFormData({ ...formData, order: e.target.value === '' ? '' : parseInt(e.target.value) })}
                    className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2 text-xs font-bold text-zinc-700 mb-1 group relative w-fit">
                  Publication Status
                  <Info className="h-3.5 w-3.5 text-zinc-400 hover:text-indigo-500 cursor-help" />
                  <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-48 p-2 bg-zinc-900 text-white text-[10px] rounded-lg shadow-lg z-20">
                    Draft keeps the course hidden. Published makes it live to students.
                  </div>
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                >
                  <option value="draft">Draft (Hidden)</option>
                  <option value="published">Published (Live)</option>
                </select>
              </div>
              
              <div className="pt-4 flex items-center justify-end gap-3 sticky bottom-0 bg-white py-4 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 text-zinc-600 hover:bg-zinc-100 text-sm font-semibold rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl shadow-sm transition-all min-w-[120px]"
                >
                  {isSubmitting ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                  ) : (
                    'Save Course'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

export default function AdminCoursesPage() {
  return (
    <Suspense fallback={
      <AdminLayout>
        <div className="p-12 flex justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
        </div>
      </AdminLayout>
    }>
      <AdminCoursesContent />
    </Suspense>
  );
}
