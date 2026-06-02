'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import AdminLayout from '@/components/admin-layout';
import AssetUploader, { UploadResult } from '@/components/admin/asset-uploader';
import { Course, Lesson, Quiz } from '@/lib/types';
import { Video, FileText, Plus, Edit2, Trash2, X, AlertCircle, Info, ArrowLeft, ListChecks, Globe, EyeOff, Loader2 } from 'lucide-react';

export default function AdminCourseBuilderPage() {
  const params = useParams();
  const courseId = params.courseId as string;

  const [course, setCourse] = useState<Course | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'lessons' | 'quizzes'>('lessons');
  const [publishingId, setPublishingId] = useState<string | null>(null);

  // Modal states
  const [isLessonModalOpen, setIsLessonModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lessonUploadResult, setLessonUploadResult] = useState<UploadResult | null>(null);
  const [lessonForm, setLessonForm] = useState({
    title: '',
    description: '',
    type: 'video' as 'video' | 'pdf',
    order: '',
    completionPoints: 10,
    status: 'draft'
  });

  // Edit lesson modal
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [editLessonForm, setEditLessonForm] = useState({
    title: '',
    description: '',
    order: '',
    completionPoints: 10,
    status: 'draft',
    muxPlaybackId: '',
    storagePath: '',
  });

  const [isQuizModalOpen, setIsQuizModalOpen] = useState(false);
  const [quizForm, setQuizForm] = useState({
    title: '',
    description: '',
    passThresholdPercent: 70,
    maxAttempts: 0,
    timeLimitMinutes: '',
    completionPoints: 50,
    status: 'draft'
  });

  useEffect(() => {
    fetchCurriculum();
  }, [courseId]);

  const fetchCurriculum = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/v1/admin/courses/${courseId}`);
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Failed to fetch course');
      
      setCourse(data.course);
      setLessons(data.lessons || []);
      setQuizzes(data.quizzes || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      // Build the payload, merging upload result fields in
      const payload: Record<string, unknown> = {
        ...lessonForm,
        order: lessonForm.order === '' ? 0 : Number(lessonForm.order),
      };

      if (lessonUploadResult?.type === 'video') {
        payload.muxUploadId = lessonUploadResult.muxUploadId;
        // muxPlaybackId will be set later via Mux webhook once processing completes
        payload.muxPlaybackId = null;
        payload.muxAssetId = null;
      } else if (lessonUploadResult?.type === 'pdf') {
        payload.storagePath = lessonUploadResult.storagePath;
      }

      const res = await fetch(`/api/v1/admin/courses/${courseId}/lessons`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create lesson');
      
      setLessons(prev => [...prev, data].sort((a, b) => a.order - b.order));
      setIsLessonModalOpen(false);
      setLessonUploadResult(null);
      setLessonForm({
        title: '',
        description: '',
        type: 'video',
        order: '',
        completionPoints: 10,
        status: 'draft'
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditLesson = (lesson: Lesson) => {
    setEditingLesson(lesson);
    setEditLessonForm({
      title: lesson.title,
      description: lesson.description || '',
      order: String(lesson.order),
      completionPoints: lesson.completionPoints,
      status: lesson.status,
      muxPlaybackId: lesson.muxPlaybackId || '',
      storagePath: lesson.storagePath || '',
    });
  };

  const handleUpdateLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLesson) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/v1/admin/courses/${courseId}/lessons/${editingLesson.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...editLessonForm,
            order: editLessonForm.order === '' ? 0 : Number(editLessonForm.order),
            completionPoints: Number(editLessonForm.completionPoints),
            muxPlaybackId: editLessonForm.muxPlaybackId || null,
            storagePath: editLessonForm.storagePath || null,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update lesson');
      setLessons((prev) =>
        prev.map((l) => (l.id === editingLesson.id ? { ...l, ...data } : l))
           .sort((a, b) => a.order - b.order)
      );
      setEditingLesson(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteLesson = async (lessonId: string) => {
    if (!confirm('Delete this lesson? This cannot be undone.')) return;
    try {
      const res = await fetch(
        `/api/v1/admin/courses/${courseId}/lessons/${lessonId}`,
        { method: 'DELETE' }
      );
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Delete failed');
      }
      setLessons((prev) => prev.filter((l) => l.id !== lessonId));
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handlePublishToggle = async (lesson: Lesson) => {
    const action = lesson.status === 'published' ? 'unpublish' : 'publish';
    setPublishingId(lesson.id);
    setError(null);
    try {
      const res = await fetch('/api/v1/admin/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetType: 'lesson',
          targetId: lesson.id,
          action,
          courseId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update status');
      setLessons((prev) =>
        prev.map((l) => (l.id === lesson.id ? { ...l, status: data.newStatus } : l))
      );
    } catch (err: any) {
      setError(err.message);
    } finally {
      setPublishingId(null);
    }
  };

  const handleCreateQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/admin/courses/${courseId}/quizzes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...quizForm,
          timeLimitMinutes: quizForm.timeLimitMinutes === '' ? null : Number(quizForm.timeLimitMinutes)
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create quiz');
      
      setQuizzes(prev => [...prev, data]);
      setIsQuizModalOpen(false);
      setQuizForm({
        title: '',
        description: '',
        passThresholdPercent: 70,
        maxAttempts: 0,
        timeLimitMinutes: '',
        completionPoints: 50,
        status: 'draft'
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="p-12 flex justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
        </div>
      </AdminLayout>
    );
  }

  if (error && !course) {
    return (
      <AdminLayout>
        <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-6">
          <div className="p-4 bg-red-50 text-red-600 border border-red-200 rounded-xl flex items-center gap-3 text-sm">
            <AlertCircle className="h-5 w-5 shrink-0" />
            {error}
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-6">
        <div className="flex items-center gap-4 mb-4">
          <Link href="/admin/courses" className="p-2 bg-white border border-zinc-200 text-zinc-500 hover:text-zinc-900 rounded-xl hover:bg-zinc-50 transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-extrabold text-zinc-900 tracking-tight">Course Builder</h1>
            <p className="text-sm text-zinc-500 mt-1">{course?.title}</p>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 text-red-600 border border-red-200 rounded-xl flex items-center gap-3 text-sm">
            <AlertCircle className="h-5 w-5 shrink-0" />
            {error}
          </div>
        )}

        <div className="flex gap-4 border-b border-zinc-200">
          <button
            onClick={() => setActiveTab('lessons')}
            className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'lessons' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300'}`}
          >
            Lessons ({lessons.length})
          </button>
          <button
            onClick={() => setActiveTab('quizzes')}
            className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'quizzes' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300'}`}
          >
            Quizzes ({quizzes.length})
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
          <div className="p-4 md:p-6 border-b border-zinc-100 flex justify-between items-center bg-zinc-50/50">
            <h2 className="text-lg font-bold text-zinc-900">
              {activeTab === 'lessons' ? 'Course Lessons' : 'Course Quizzes'}
            </h2>
            <button 
              onClick={() => activeTab === 'lessons' ? setIsLessonModalOpen(true) : setIsQuizModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-sm transition-all"
            >
              <Plus className="h-4 w-4" />
              {activeTab === 'lessons' ? 'Add Lesson' : 'Add Quiz'}
            </button>
          </div>

          <div className="p-0">
            {activeTab === 'lessons' && (
              lessons.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="h-12 w-12 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Video className="h-6 w-6 text-indigo-400" />
                  </div>
                  <h3 className="text-lg font-bold text-zinc-900">No lessons yet</h3>
                  <p className="text-zinc-500 text-sm mt-1">Add your first video or PDF lesson to get started.</p>
                </div>
              ) : (
                <div className="divide-y divide-zinc-100">
                  {lessons.map(lesson => (
                    <div key={lesson.id} className="flex items-center justify-between p-4 hover:bg-zinc-50 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${lesson.type === 'video' ? 'bg-indigo-50 text-indigo-600' : 'bg-orange-50 text-orange-600'}`}>
                          {lesson.type === 'video' ? <Video className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-zinc-900">{lesson.title}</p>
                          <div className="flex items-center gap-2 text-xs text-zinc-500 mt-0.5">
                            <span className="font-medium text-zinc-400">Order: {lesson.order}</span>
                            <span>•</span>
                            <span className="capitalize">{lesson.type}</span>
                            {lesson.durationSeconds && (
                              <>
                                <span>•</span>
                                <span>{Math.round(lesson.durationSeconds / 60)} mins</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handlePublishToggle(lesson)}
                          disabled={publishingId === lesson.id}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all disabled:opacity-50 ${
                            lesson.status === 'published'
                              ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                          }`}
                        >
                          {publishingId === lesson.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : lesson.status === 'published' ? (
                            <><EyeOff className="h-3.5 w-3.5" /> Unpublish</>
                          ) : (
                            <><Globe className="h-3.5 w-3.5" /> Publish</>
                          )}
                        </button>
                        <button
                          onClick={() => openEditLesson(lesson)}
                          className="p-2 text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="Edit lesson"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteLesson(lesson.id)}
                          className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete lesson"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}

            {activeTab === 'quizzes' && (
              quizzes.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="h-12 w-12 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-3">
                    <ListChecks className="h-6 w-6 text-emerald-400" />
                  </div>
                  <h3 className="text-lg font-bold text-zinc-900">No quizzes yet</h3>
                  <p className="text-zinc-500 text-sm mt-1">Test your students' knowledge by adding a quiz.</p>
                </div>
              ) : (
                <div className="divide-y divide-zinc-100">
                  {quizzes.map(quiz => (
                    <div key={quiz.id} className="flex items-center justify-between p-4 hover:bg-zinc-50 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                          <ListChecks className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-zinc-900">{quiz.title}</p>
                          <div className="flex items-center gap-2 text-xs text-zinc-500 mt-0.5">
                            <span className="font-medium text-zinc-400">Pass: {quiz.passThresholdPercent}%</span>
                            <span>•</span>
                            <span>{quiz.completionPoints} pts</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`inline-flex px-2 py-1 text-[10px] font-bold uppercase rounded-full border ${
                          quiz.status === 'published' 
                            ? 'bg-emerald-50 text-emerald-600 border-emerald-200' 
                            : 'bg-amber-50 text-amber-600 border-amber-200'
                        }`}>
                          {quiz.status}
                        </span>
                        <Link
                          href={`/admin/quizzes/${quiz.id}`}
                          className="p-2 text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="Edit questions"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        </div>
      </div>

      {/* Edit Lesson Modal */}
      {editingLesson && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-8">
            <div className="p-6 border-b border-zinc-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <h2 className="text-xl font-bold text-zinc-900">Edit Lesson</h2>
              <button
                onClick={() => setEditingLesson(null)}
                className="p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-full transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateLesson} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">Lesson Title</label>
                <input
                  type="text"
                  required
                  value={editLessonForm.title}
                  onChange={(e) => setEditLessonForm({ ...editLessonForm, title: e.target.value })}
                  className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">Description (Optional)</label>
                <textarea
                  rows={2}
                  value={editLessonForm.description}
                  onChange={(e) => setEditLessonForm({ ...editLessonForm, description: e.target.value })}
                  className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">Sort Order</label>
                  <input
                    type="number"
                    min="0"
                    value={editLessonForm.order}
                    onChange={(e) => setEditLessonForm({ ...editLessonForm, order: e.target.value })}
                    className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">Completion Points</label>
                  <input
                    type="number"
                    min="0"
                    value={editLessonForm.completionPoints}
                    onChange={(e) => setEditLessonForm({ ...editLessonForm, completionPoints: Number(e.target.value) })}
                    className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  />
                </div>
              </div>

              {editingLesson.type === 'video' && (
                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">Mux Playback ID</label>
                  <input
                    type="text"
                    value={editLessonForm.muxPlaybackId}
                    onChange={(e) => setEditLessonForm({ ...editLessonForm, muxPlaybackId: e.target.value })}
                    placeholder="Set automatically via Mux webhook"
                    className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  />
                </div>
              )}

              {editingLesson.type === 'pdf' && (
                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">Storage Path</label>
                  <input
                    type="text"
                    value={editLessonForm.storagePath}
                    onChange={(e) => setEditLessonForm({ ...editLessonForm, storagePath: e.target.value })}
                    className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">Status</label>
                <select
                  value={editLessonForm.status}
                  onChange={(e) => setEditLessonForm({ ...editLessonForm, status: e.target.value })}
                  className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                >
                  <option value="draft">Draft (Hidden)</option>
                  <option value="published">Published (Live)</option>
                  <option value="archived">Archived</option>
                </select>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setEditingLesson(null)}
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
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lesson Creation Modal */}
      {isLessonModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-8">
            <div className="p-6 border-b border-zinc-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <h2 className="text-xl font-bold text-zinc-900">Add New Lesson</h2>
              <button 
                onClick={() => setIsLessonModalOpen(false)}
                className="p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-full transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleCreateLesson} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">Lesson Title</label>
                <input
                  type="text"
                  required
                  value={lessonForm.title}
                  onChange={(e) => setLessonForm({ ...lessonForm, title: e.target.value })}
                  placeholder="e.g. Introduction to Variables"
                  className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">Description (Optional)</label>
                <textarea
                  rows={2}
                  value={lessonForm.description}
                  onChange={(e) => setLessonForm({ ...lessonForm, description: e.target.value })}
                  className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">Content Type</label>
                  <select
                    value={lessonForm.type}
                    onChange={(e) => {
                      setLessonForm({ ...lessonForm, type: e.target.value as 'video' | 'pdf' });
                      setLessonUploadResult(null);
                    }}
                    className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  >
                    <option value="video">Video</option>
                    <option value="pdf">PDF</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">Sort Order</label>
                  <input
                    type="number"
                    min="0"
                    value={lessonForm.order}
                    onChange={(e) => setLessonForm({ ...lessonForm, order: e.target.value })}
                    className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  />
                </div>
              </div>

              {/* Asset Uploader */}
              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-2">
                  {lessonForm.type === 'video' ? 'Upload Video' : 'Upload PDF'}
                </label>
                <AssetUploader
                  courseId={courseId}
                  type={lessonForm.type}
                  onUploadComplete={(result) => setLessonUploadResult(result)}
                  onUploadError={(msg) => setError(msg)}
                />
                {lessonForm.type === 'video' && lessonUploadResult?.type === 'video' && (
                  <p className="text-[11px] text-zinc-400 mt-1.5 flex items-center gap-1">
                    <Info className="h-3 w-3" />
                    Mux will process the video after upload. The playback ID will be saved automatically via webhook.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 border-t border-zinc-100 pt-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">Completion Points</label>
                  <input
                    type="number"
                    min="0"
                    value={lessonForm.completionPoints}
                    onChange={(e) => setLessonForm({ ...lessonForm, completionPoints: Number(e.target.value) })}
                    className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">Status</label>
                  <select
                    value={lessonForm.status}
                    onChange={(e) => setLessonForm({ ...lessonForm, status: e.target.value })}
                    className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  >
                    <option value="draft">Draft (Hidden)</option>
                    <option value="published">Published (Live)</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 sticky bottom-0 bg-white py-4 border-t border-zinc-100 mt-2">
                <button
                  type="button"
                  onClick={() => setIsLessonModalOpen(false)}
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
                    'Save Lesson'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quiz Creation Modal */}
      {isQuizModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-8">
            <div className="p-6 border-b border-zinc-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <h2 className="text-xl font-bold text-zinc-900">Add New Quiz</h2>
              <button 
                onClick={() => setIsQuizModalOpen(false)}
                className="p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-full transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleCreateQuiz} className="p-6 space-y-4">
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex gap-3 text-sm text-emerald-800 mb-2">
                <Info className="h-5 w-5 shrink-0 text-emerald-600" />
                <p>
                  <strong>Course Quiz:</strong> This quiz will be attached to the overall course. You can add questions to it after it is created.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">Quiz Title</label>
                  <input
                    type="text"
                    required
                    value={quizForm.title}
                    onChange={(e) => setQuizForm({ ...quizForm, title: e.target.value })}
                    placeholder="e.g. Final Exam"
                    className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">Pass Threshold (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    required
                    value={quizForm.passThresholdPercent}
                    onChange={(e) => setQuizForm({ ...quizForm, passThresholdPercent: Number(e.target.value) })}
                    className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">Description</label>
                <textarea
                  required
                  rows={2}
                  value={quizForm.description}
                  onChange={(e) => setQuizForm({ ...quizForm, description: e.target.value })}
                  className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-zinc-100 pt-2">
                <div>
                  <label className="flex items-center gap-2 text-xs font-bold text-zinc-700 mb-1 group relative w-fit">
                    Max Attempts
                    <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-48 p-2 bg-zinc-900 text-white text-[10px] rounded-lg shadow-lg z-20">
                      Set to 0 for unlimited attempts.
                    </div>
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={quizForm.maxAttempts}
                    onChange={(e) => setQuizForm({ ...quizForm, maxAttempts: Number(e.target.value) })}
                    className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-2 text-xs font-bold text-zinc-700 mb-1 group relative w-fit">
                    Time Limit (Mins)
                    <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-48 p-2 bg-zinc-900 text-white text-[10px] rounded-lg shadow-lg z-20">
                      Leave empty for no time limit.
                    </div>
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={quizForm.timeLimitMinutes}
                    onChange={(e) => setQuizForm({ ...quizForm, timeLimitMinutes: e.target.value })}
                    className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-zinc-100 pt-2">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">Completion Points</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={quizForm.completionPoints}
                    onChange={(e) => setQuizForm({ ...quizForm, completionPoints: Number(e.target.value) })}
                    className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">Status</label>
                  <select
                    value={quizForm.status}
                    onChange={(e) => setQuizForm({ ...quizForm, status: e.target.value })}
                    className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  >
                    <option value="draft">Draft (Hidden)</option>
                    <option value="published">Published (Live)</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 sticky bottom-0 bg-white py-4 border-t border-zinc-100 mt-2">
                <button
                  type="button"
                  onClick={() => setIsQuizModalOpen(false)}
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
                    'Save Quiz'
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
