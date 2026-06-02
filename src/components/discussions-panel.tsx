// src/components/discussions-panel.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { MessageSquare, Pin, Lock, User, Send, ChevronLeft, Plus, Loader2, Award, Shield } from 'lucide-react';
import Link from 'next/link';

interface Thread {
  id: string;
  title: string;
  body: string;
  authorUid: string;
  authorName: string;
  authorRole: string;
  replyCount: number;
  isPinned: boolean;
  isLocked: boolean;
  createdAt: { seconds: number };
}

interface Reply {
  id: string;
  body: string;
  authorUid: string;
  authorName: string;
  authorRole: string;
  createdAt: { seconds: number };
}

interface DiscussionsPanelProps {
  courseId: string;
  lessonId: string;
  isPremium: boolean;
}

export default function DiscussionsPanel({ courseId, lessonId, isPremium }: DiscussionsPanelProps) {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [loading, setLoading] = useState(true);
  const [repliesLoading, setRepliesLoading] = useState(false);

  // Forms
  const [showNewThreadForm, setShowNewThreadForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newBody, setNewBody] = useState('');
  const [newReply, setNewReply] = useState('');
  const [submittingThread, setSubmittingThread] = useState(false);
  const [submittingReply, setSubmittingReply] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch threads for the current lesson
  const fetchThreads = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/courses/${courseId}/discussions?lessonId=${lessonId}`);
      if (res.ok) {
        const data = await res.json();
        setThreads(data.threads || []);
      } else {
        setError('Failed to load discussion threads.');
      }
    } catch (err) {
      console.error(err);
      setError('Network error occurred while fetching discussions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchThreads();
  }, [courseId, lessonId]);

  // Fetch replies when a thread is selected
  const handleSelectThread = async (thread: Thread) => {
    setSelectedThread(thread);
    setRepliesLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/discussions/${thread.id}/replies`);
      if (res.ok) {
        const data = await res.json();
        setReplies(data.replies || []);
      } else {
        setError('Failed to load replies.');
      }
    } catch (err) {
      console.error(err);
      setError('Network error loading replies.');
    } finally {
      setRepliesLoading(false);
    }
  };

  const handleCreateThread = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newBody.trim()) return;

    setSubmittingThread(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/courses/${courseId}/discussions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle,
          body: newBody,
          lessonId,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setThreads((prev) => [data.thread, ...prev]);
        setNewTitle('');
        setNewBody('');
        setShowNewThreadForm(false);
      } else {
        setError(data.error || 'Failed to publish thread.');
      }
    } catch (err) {
      console.error(err);
      setError('Connection failed.');
    } finally {
      setSubmittingThread(false);
    }
  };

  const handleCreateReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedThread || !newReply.trim()) return;

    setSubmittingReply(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/discussions/${selectedThread.id}/replies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: newReply }),
      });

      const data = await res.json();
      if (res.ok) {
        setReplies((prev) => [...prev, data.reply]);
        setNewReply('');
        // Update replyCount on the parent thread in list
        setThreads((prev) =>
          prev.map((t) =>
            t.id === selectedThread.id ? { ...t, replyCount: t.replyCount + 1 } : t
          )
        );
        setSelectedThread((prev) => prev ? { ...prev, replyCount: prev.replyCount + 1 } : null);
      } else {
        setError(data.error || 'Failed to submit reply.');
      }
    } catch (err) {
      console.error(err);
      setError('Connection failed.');
    } finally {
      setSubmittingReply(false);
    }
  };

  const formatDate = (seconds: number) => {
    if (!seconds) return 'Just now';
    return new Date(seconds * 1000).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="bg-white border border-[#DBE2EF] rounded-2xl p-6 shadow-sm space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#DBE2EF] pb-4">
        <h3 className="font-extrabold text-[#112D4E] text-base flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-[#3F72AF]" />
          Lesson Discussions
        </h3>
        {!selectedThread && isPremium && !showNewThreadForm && (
          <button
            onClick={() => setShowNewThreadForm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#3F72AF]/10 hover:bg-[#3F72AF]/20 text-[#3F72AF] font-bold text-xs rounded-xl transition-all"
          >
            <Plus className="h-3.5 w-3.5" />
            New Topic
          </button>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl font-medium">
          {error}
        </div>
      )}

      {/* 1. Subscription Gate for Free Users */}
      {!isPremium ? (
        <div className="py-8 px-4 text-center border-2 border-dashed border-[#DBE2EF] rounded-2xl bg-[#F9F7F7]/50 space-y-4">
          <Award className="h-12 w-12 text-[#3F72AF] mx-auto fill-[#3F72AF]/10" />
          <div className="space-y-1 max-w-sm mx-auto">
            <h4 className="font-extrabold text-[#112D4E] text-sm">Join the Discussion</h4>
            <p className="text-xs text-zinc-550 leading-relaxed">
              Discussion forums are locked for Free accounts. Subscribe to Alpha Academy Premium to ask questions and learn together with fellow students.
            </p>
          </div>
          <Link
            href="/settings"
            className="inline-block px-5 py-2.5 bg-gradient-to-r from-[#112D4E] to-[#3F72AF] text-white text-xs font-black rounded-xl hover:opacity-95 shadow-sm transition-all"
          >
            Subscribe to Premium
          </Link>
        </div>
      ) : (
        /* Premium View */
        <div>
          {/* Thread Detail View */}
          {selectedThread ? (
            <div className="space-y-5">
              {/* Back to list */}
              <button
                onClick={() => {
                  setSelectedThread(null);
                  setReplies([]);
                }}
                className="flex items-center gap-1.5 text-xs font-bold text-zinc-500 hover:text-[#112D4E] transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
                Back to Topics
              </button>

              {/* OP / Thread body */}
              <div className="bg-[#F9F7F7] border border-[#DBE2EF] p-5 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-full bg-zinc-200 flex items-center justify-center text-zinc-650 text-[10px] font-bold">
                      <User className="h-3 w-3" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-[#112D4E]">{selectedThread.authorName}</span>
                      {selectedThread.authorRole === 'admin' && (
                        <span className="ml-1.5 px-1.5 py-0.5 bg-[#112D4E] text-white text-[8px] font-black uppercase rounded tracking-wider flex inline-items items-center gap-0.5">
                          <Shield className="h-2 w-2" /> Admin
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-[10px] text-zinc-400">{formatDate(selectedThread.createdAt?.seconds)}</span>
                </div>
                <h4 className="font-extrabold text-sm text-[#112D4E]">{selectedThread.title}</h4>
                <p className="text-xs text-zinc-700 leading-relaxed whitespace-pre-wrap">{selectedThread.body}</p>
              </div>

              {/* Replies list */}
              <div className="space-y-4">
                <h5 className="font-black text-xs text-zinc-450 uppercase tracking-wider">
                  Replies ({selectedThread.replyCount})
                </h5>

                {repliesLoading ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="h-5 w-5 animate-spin text-[#3F72AF]" />
                  </div>
                ) : replies.length === 0 ? (
                  <div className="text-center py-6 text-xs text-zinc-400">
                    No replies yet. Be the first to answer!
                  </div>
                ) : (
                  <div className="space-y-3">
                    {replies.map((reply) => (
                      <div key={reply.id} className="border border-zinc-150 p-4 rounded-xl space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="h-5 w-5 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-600 text-[8px] font-bold">
                              <User className="h-2.5 w-2.5" />
                            </div>
                            <span className="font-bold text-[#112D4E]">{reply.authorName}</span>
                            {reply.authorRole === 'admin' && (
                              <span className="px-1.5 py-0.5 bg-[#112D4E] text-white text-[7px] font-black uppercase rounded tracking-wider">
                                Staff
                              </span>
                            )}
                          </div>
                          <span className="text-[9px] text-zinc-400">{formatDate(reply.createdAt?.seconds)}</span>
                        </div>
                        <p className="text-zinc-650 leading-relaxed whitespace-pre-wrap">{reply.body}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Reply Input Form */}
              {selectedThread.isLocked ? (
                <div className="p-3 bg-zinc-50 text-zinc-400 text-xs rounded-xl flex items-center gap-2 justify-center font-medium">
                  <Lock className="h-3.5 w-3.5" />
                  This topic has been locked by an administrator.
                </div>
              ) : (
                <form onSubmit={handleCreateReply} className="flex gap-2 items-end pt-3">
                  <div className="flex-1">
                    <textarea
                      value={newReply}
                      onChange={(e) => setNewReply(e.target.value)}
                      placeholder="Add a reply..."
                      className="w-full text-xs p-3 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#3F72AF]/35 resize-none h-16"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={submittingReply || !newReply.trim()}
                    className="p-3 bg-[#3F72AF] text-white rounded-xl hover:opacity-90 transition-all disabled:opacity-40 shrink-0"
                  >
                    {submittingReply ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </button>
                </form>
              )}
            </div>
          ) : showNewThreadForm ? (
            /* Create Thread Form */
            <form onSubmit={handleCreateThread} className="space-y-4 text-xs">
              <div className="flex justify-between items-center">
                <h4 className="font-extrabold text-sm text-[#112D4E]">Create New Discussion Thread</h4>
                <button
                  type="button"
                  onClick={() => setShowNewThreadForm(false)}
                  className="text-zinc-450 font-bold hover:text-zinc-700"
                >
                  Cancel
                </button>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-zinc-500">Topic Title</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Help understanding consistent hashing..."
                  className="w-full p-2.5 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-[#3F72AF]/35 focus:outline-none"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-zinc-500">Message Body</label>
                <textarea
                  value={newBody}
                  onChange={(e) => setNewBody(e.target.value)}
                  placeholder="Ask your question or share your learning insights here..."
                  className="w-full p-3 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-[#3F72AF]/35 focus:outline-none h-28 resize-none"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={submittingThread}
                className="w-full py-2.5 bg-[#3F72AF] text-white font-bold rounded-xl hover:opacity-95 transition-all shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {submittingThread && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Publish Thread
              </button>
            </form>
          ) : (
            /* Threads List */
            <div className="space-y-4">
              {loading ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="h-6 w-6 animate-spin text-[#3F72AF]" />
                </div>
              ) : threads.length === 0 ? (
                <div className="text-center py-10 text-xs text-zinc-400 space-y-2">
                  <p>No discussions for this lesson yet.</p>
                  <p>Have a question or insight? Start a conversation topic above!</p>
                </div>
              ) : (
                <div className="divide-y divide-zinc-100">
                  {threads.map((thread) => (
                    <div
                      key={thread.id}
                      onClick={() => handleSelectThread(thread)}
                      className="py-3.5 flex items-start justify-between gap-3 cursor-pointer group"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {thread.isPinned && (
                            <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-amber-50 text-amber-600 rounded text-[9px] font-bold">
                              <Pin className="h-2.5 w-2.5" /> Pinned
                            </span>
                          )}
                          {thread.isLocked && (
                            <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-zinc-100 text-zinc-500 rounded text-[9px] font-bold">
                              <Lock className="h-2.5 w-2.5" /> Locked
                            </span>
                          )}
                          <h4 className="font-bold text-xs text-[#112D4E] group-hover:text-[#3F72AF] transition-colors leading-tight">
                            {thread.title}
                          </h4>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-zinc-450">
                          <span className="font-semibold">{thread.authorName}</span>
                          <span>•</span>
                          <span>{formatDate(thread.createdAt?.seconds)}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 text-zinc-400 text-xs shrink-0 font-medium">
                        <MessageSquare className="h-3.5 w-3.5" />
                        <span>{thread.replyCount}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
