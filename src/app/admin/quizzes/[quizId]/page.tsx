'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import AdminLayout from '@/components/admin-layout';
import {
  ArrowLeft, Plus, X, CheckCircle2, Circle,
  AlertCircle, Trash2, GripVertical, Info, Loader2
} from 'lucide-react';

interface QuizQuestion {
  id: string;
  quizId: string;
  question: string;
  options: string[];
  correctOptionIndex: number;
  explanation: string | null;
  order: number;
}

interface QuizMeta {
  id: string;
  title: string;
  courseId: string;
  passThresholdPercent: number;
  status: string;
}

const MAX_OPTIONS = 6;
const MIN_OPTIONS = 2;

export default function QuizQuestionsPage() {
  const params = useParams();
  const quizId = params.quizId as string;

  const [quiz, setQuiz] = useState<QuizMeta | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    question: '',
    options: ['', '', '', ''],
    correctOptionIndex: 0,
    explanation: '',
  });

  useEffect(() => {
    fetchData();
  }, [quizId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [quizRes, questionsRes] = await Promise.all([
        fetch(`/api/v1/admin/quizzes/${quizId}`),
        fetch(`/api/v1/admin/quizzes/${quizId}/questions`),
      ]);

      if (!quizRes.ok) {
        const d = await quizRes.json();
        throw new Error(d.error || 'Failed to load quiz');
      }
      if (!questionsRes.ok) {
        const d = await questionsRes.json();
        throw new Error(d.error || 'Failed to load questions');
      }

      const quizData = await quizRes.json();
      const questionsData = await questionsRes.json();

      setQuiz(quizData);
      setQuestions(questionsData.questions || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm({ question: '', options: ['', '', '', ''], correctOptionIndex: 0, explanation: '' });
  };

  const handleAddOption = () => {
    if (form.options.length < MAX_OPTIONS) {
      setForm({ ...form, options: [...form.options, ''] });
    }
  };

  const handleRemoveOption = (index: number) => {
    if (form.options.length <= MIN_OPTIONS) return;
    const newOptions = form.options.filter((_, i) => i !== index);
    setForm({
      ...form,
      options: newOptions,
      correctOptionIndex: form.correctOptionIndex >= newOptions.length
        ? newOptions.length - 1
        : form.correctOptionIndex,
    });
  };

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...form.options];
    newOptions[index] = value;
    setForm({ ...form, options: newOptions });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const filledOptions = form.options.filter((o) => o.trim() !== '');
    if (filledOptions.length < MIN_OPTIONS) {
      setError('Please provide at least 2 options.');
      setIsSubmitting(false);
      return;
    }
    if (!form.question.trim()) {
      setError('Question text is required.');
      setIsSubmitting(false);
      return;
    }

    try {
      const res = await fetch(`/api/v1/admin/quizzes/${quizId}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: form.question.trim(),
          options: filledOptions,
          correctOptionIndex: form.correctOptionIndex,
          explanation: form.explanation.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create question');

      setQuestions((prev) => [...prev, data]);
      setIsModalOpen(false);
      resetForm();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (questionId: string) => {
    if (!confirm('Delete this question? This cannot be undone.')) return;
    try {
      const res = await fetch(
        `/api/v1/admin/quizzes/${quizId}/questions/${questionId}`,
        { method: 'DELETE' }
      );
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to delete question');
      }
      setQuestions((prev) => prev.filter((q) => q.id !== questionId));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <AdminLayout>
        <div className="p-12 flex justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
        </div>
      </AdminLayout>
    );
  }

  const letterLabel = (i: number) => String.fromCharCode(65 + i); // A, B, C …

  return (
    <AdminLayout>
      <div className="p-6 md:p-10 max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center gap-4">
          <Link
            href={quiz?.courseId ? `/admin/courses/${quiz.courseId}` : '/admin/courses'}
            className="p-2 bg-white border border-zinc-200 text-zinc-500 hover:text-zinc-900 rounded-xl hover:bg-zinc-50 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-extrabold text-zinc-900 tracking-tight">
              Quiz Questions
            </h1>
            <p className="text-sm text-zinc-500 mt-0.5">
              {quiz?.title ?? '…'} ·{' '}
              <span className="font-medium">{quiz?.passThresholdPercent}% to pass</span>
            </p>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 text-red-600 border border-red-200 rounded-xl flex items-center gap-3 text-sm">
            <AlertCircle className="h-5 w-5 shrink-0" />
            {error}
          </div>
        )}

        {/* Question List */}
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
          <div className="p-4 md:p-6 border-b border-zinc-100 flex justify-between items-center bg-zinc-50/50">
            <h2 className="text-lg font-bold text-zinc-900">
              Questions{' '}
              <span className="text-zinc-400 font-normal text-sm">({questions.length})</span>
            </h2>
            <button
              onClick={() => { resetForm(); setIsModalOpen(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-sm transition-all"
            >
              <Plus className="h-4 w-4" />
              Add Question
            </button>
          </div>

          {questions.length === 0 ? (
            <div className="p-14 text-center">
              <div className="h-14 w-14 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="h-7 w-7 text-indigo-400" />
              </div>
              <h3 className="text-lg font-bold text-zinc-900">No questions yet</h3>
              <p className="text-zinc-500 text-sm mt-1 max-w-xs mx-auto">
                Add your first question. Students will never see the correct answer index — it stays server-side.
              </p>
              <button
                onClick={() => { resetForm(); setIsModalOpen(true); }}
                className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-sm transition-all"
              >
                <Plus className="h-4 w-4" />
                Add First Question
              </button>
            </div>
          ) : (
            <div className="divide-y divide-zinc-100">
              {questions.map((q, idx) => (
                <div key={q.id} className="p-5 hover:bg-zinc-50/70 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="flex items-center gap-2 shrink-0 pt-0.5">
                      <GripVertical className="h-4 w-4 text-zinc-300" />
                      <span className="h-6 w-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center">
                        {idx + 1}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-zinc-900 leading-snug">
                        {q.question}
                      </p>
                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {q.options.map((opt, optIdx) => (
                          <div
                            key={optIdx}
                            className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm border transition-colors ${
                              optIdx === q.correctOptionIndex
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                                : 'bg-zinc-50 border-zinc-200 text-zinc-600'
                            }`}
                          >
                            {optIdx === q.correctOptionIndex ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                            ) : (
                              <Circle className="h-4 w-4 text-zinc-300 shrink-0" />
                            )}
                            <span className="font-medium text-[11px] text-zinc-400 shrink-0">
                              {letterLabel(optIdx)}
                            </span>
                            <span className="truncate">{opt}</span>
                          </div>
                        ))}
                      </div>
                      {q.explanation && (
                        <p className="mt-2 text-xs text-zinc-400 flex items-start gap-1.5">
                          <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                          {q.explanation}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => handleDelete(q.id)}
                      className="p-2 text-zinc-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                      title="Delete question"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Add Question Modal ─────────────────────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-8">

            {/* Modal Header */}
            <div className="p-6 border-b border-zinc-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <h2 className="text-xl font-bold text-zinc-900">Add Question</h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-full transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {error && (
                <div className="p-3 bg-red-50 text-red-600 border border-red-200 rounded-xl flex items-center gap-2 text-sm">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              {/* Question text */}
              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1.5">
                  Question <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={form.question}
                  onChange={(e) => setForm({ ...form, question: e.target.value })}
                  placeholder="e.g. What does HTML stand for?"
                  className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none"
                />
              </div>

              {/* Options */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-zinc-700">
                    Answer Options <span className="text-red-500">*</span>
                  </label>
                  <span className="text-[11px] text-zinc-400">
                    Click a row to mark it correct
                  </span>
                </div>

                <div className="space-y-2">
                  {form.options.map((opt, i) => (
                    <div
                      key={i}
                      className={`flex items-center gap-2 p-2 rounded-xl border transition-all cursor-pointer ${
                        i === form.correctOptionIndex
                          ? 'border-emerald-300 bg-emerald-50'
                          : 'border-zinc-200 bg-zinc-50 hover:border-zinc-300'
                      }`}
                      onClick={() => setForm({ ...form, correctOptionIndex: i })}
                    >
                      <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                        i === form.correctOptionIndex
                          ? 'border-emerald-500 bg-emerald-500'
                          : 'border-zinc-300'
                      }`}>
                        {i === form.correctOptionIndex && (
                          <div className="h-2 w-2 bg-white rounded-full" />
                        )}
                      </div>
                      <span className="text-xs font-bold text-zinc-400 w-4 shrink-0">
                        {letterLabel(i)}
                      </span>
                      <input
                        type="text"
                        value={opt}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => handleOptionChange(i, e.target.value)}
                        placeholder={`Option ${letterLabel(i)}`}
                        className="flex-1 bg-transparent text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none"
                      />
                      {form.options.length > MIN_OPTIONS && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleRemoveOption(i); }}
                          className="p-1 text-zinc-300 hover:text-red-400 transition-colors shrink-0"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {form.options.length < MAX_OPTIONS && (
                  <button
                    type="button"
                    onClick={handleAddOption}
                    className="mt-2 flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-700 font-semibold transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add option ({form.options.length}/{MAX_OPTIONS})
                  </button>
                )}

                <p className="mt-1.5 text-[11px] text-zinc-400 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                  The highlighted option is marked as correct.
                </p>
              </div>

              {/* Explanation */}
              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1.5">
                  Explanation (Optional)
                </label>
                <textarea
                  rows={2}
                  value={form.explanation}
                  onChange={(e) => setForm({ ...form, explanation: e.target.value })}
                  placeholder="Shown to students after they answer. Helps them learn from mistakes."
                  className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none"
                />
              </div>

              {/* Footer */}
              <div className="pt-2 flex items-center justify-end gap-3 border-t border-zinc-100">
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
                  className="flex items-center justify-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl shadow-sm transition-all min-w-[140px]"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Save Question'
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
