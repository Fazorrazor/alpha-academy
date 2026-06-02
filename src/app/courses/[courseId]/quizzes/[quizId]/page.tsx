// src/app/courses/[courseId]/quizzes/[quizId]/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import DashboardLayout from '@/components/dashboard-layout';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Trophy,
  ChevronRight,
  Clock
} from 'lucide-react';

interface Question {
  id: string;
  text: string;
  options: string[];
}

interface Quiz {
  id: string;
  title: string;
  description: string;
  passingScore: number;
  questions: Question[];
}

const DEFAULT_QUIZ: Quiz = {
  id: 'final-assessment',
  title: 'Final Certification Assessment',
  description: 'Test your knowledge to earn your official completion certificate. You need 80% to pass.',
  passingScore: 80,
  questions: [
    {
      id: 'q-1',
      text: 'Which load balancing strategy is best when session persistence is required?',
      options: ['Round Robin', 'IP Hash', 'Least Connections', 'Random'],
    },
    {
      id: 'q-2',
      text: 'What is the primary purpose of a database index?',
      options: ['To encrypt data', 'To speed up data retrieval', 'To compress the database size', 'To automatically backup data'],
    },
    {
      id: 'q-3',
      text: 'In a CAP theorem context, if a network partition occurs, what trade-off must be made?',
      options: ['Consistency vs Availability', 'Latency vs Throughput', 'Security vs Speed', 'SQL vs NoSQL'],
    },
    {
      id: 'q-4',
      text: 'Which caching strategy writes data to the cache and the backing store simultaneously?',
      options: ['Write-back', 'Write-around', 'Write-through', 'Cache-aside'],
    },
    {
      id: 'q-5',
      text: 'What is the main advantage of horizontal scaling (scaling out) over vertical scaling (scaling up)?',
      options: ['Requires no code changes', 'No theoretical limit to capacity', 'Cheaper single hardware units', 'Easier to manage state'],
    }
  ],
};

interface PageProps {
  params: Promise<{ courseId: string; quizId: string }>;
}

export default function QuizPage({ params }: PageProps) {
  const router = useRouter();
  const { user, profile, loading } = useAuth();
  
  const unwrappedParams = React.use(params);
  const courseId = unwrappedParams.courseId;
  
  const [quizState, setQuizState] = useState<'intro' | 'active' | 'submitting' | 'results'>('intro');
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [score, setScore] = useState<number | null>(null);
  
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  const handleOptionSelect = (optionIdx: number) => {
    const questionId = DEFAULT_QUIZ.questions[currentQuestionIdx].id;
    setAnswers((prev) => ({
      ...prev,
      [questionId]: optionIdx,
    }));
  };

  const handleNext = () => {
    if (currentQuestionIdx < DEFAULT_QUIZ.questions.length - 1) {
      setCurrentQuestionIdx((prev) => prev + 1);
    } else {
      handleSubmit();
    }
  };

  const handleSubmit = () => {
    setQuizState('submitting');
    
    // Simulate API call for grading
    setTimeout(() => {
      // Mock grading (For the mock, let's say the correct answer is always option index 1)
      // In a real app, the server would grade this.
      let correctCount = 0;
      DEFAULT_QUIZ.questions.forEach((q) => {
        // Just randomly generate a score for simulation based on selection length
        if (answers[q.id] !== undefined) {
          correctCount += Math.random() > 0.2 ? 1 : 0; // 80% chance to get it right if answered
        }
      });
      
      // Let's force a pass if they answered everything, just for UX demonstration
      const finalScore = Object.keys(answers).length === DEFAULT_QUIZ.questions.length 
        ? Math.max(80, Math.floor((correctCount / DEFAULT_QUIZ.questions.length) * 100))
        : Math.floor((correctCount / DEFAULT_QUIZ.questions.length) * 100);

      setScore(finalScore);
      setQuizState('results');
    }, 1500);
  };

  if (loading || !user || !profile) {
    return (
      <DashboardLayout>
        <div className="flex h-full items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#3F72AF] border-t-transparent"></div>
        </div>
      </DashboardLayout>
    );
  }

  const passed = score !== null && score >= DEFAULT_QUIZ.passingScore;

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto p-6 md:p-10 min-h-screen flex flex-col">
        {/* Header navigation */}
        <div className="mb-8">
          <button
            onClick={() => router.push(`/courses/${courseId}`)}
            className="flex items-center gap-2 text-zinc-500 hover:text-[#112D4E] text-xs font-bold transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Course Syllabus
          </button>
        </div>

        {/* Quiz Container */}
        <div className="bg-white border border-[#DBE2EF] rounded-3xl shadow-sm overflow-hidden flex-1 flex flex-col relative">
          
          {/* INTRO STATE */}
          {quizState === 'intro' && (
            <div className="flex-1 flex flex-col items-center justify-center p-10 text-center">
              <div className="h-20 w-20 bg-[#F9F7F7] rounded-full flex items-center justify-center mb-6 border border-[#DBE2EF]">
                <CheckCircle2 className="h-10 w-10 text-[#3F72AF]" />
              </div>
              <h1 className="text-3xl font-extrabold text-[#112D4E] mb-4">
                {DEFAULT_QUIZ.title}
              </h1>
              <p className="text-zinc-550 max-w-md mx-auto mb-8 leading-relaxed">
                {DEFAULT_QUIZ.description}
              </p>
              
              <div className="flex items-center gap-6 mb-10 text-sm font-semibold text-zinc-600 bg-[#F9F7F7] px-6 py-4 rounded-2xl border border-[#DBE2EF]">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-zinc-400" />
                  <span>{DEFAULT_QUIZ.questions.length} Questions</span>
                </div>
                <div className="w-px h-6 bg-[#DBE2EF]"></div>
                <div className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-amber-500" />
                  <span>{DEFAULT_QUIZ.passingScore}% to Pass</span>
                </div>
              </div>

              <button
                onClick={() => setQuizState('active')}
                className="px-8 py-4 bg-[#3F72AF] hover:bg-[#3F72AF]/90 text-white font-bold rounded-2xl shadow-md transition-all active:scale-95 flex items-center gap-2"
              >
                Start Assessment
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          )}

          {/* ACTIVE STATE */}
          {quizState === 'active' && (
            <div className="flex flex-col h-full">
              {/* Progress Bar Header */}
              <div className="bg-[#F9F7F7] border-b border-[#DBE2EF] p-6 flex flex-col gap-4">
                <div className="flex justify-between items-center text-sm font-bold text-zinc-500">
                  <span>Question {currentQuestionIdx + 1} of {DEFAULT_QUIZ.questions.length}</span>
                  <span className="flex items-center gap-1.5 text-[#3F72AF] bg-[#3F72AF]/10 px-3 py-1 rounded-full">
                    <Clock className="h-4 w-4" /> Time untracked
                  </span>
                </div>
                <div className="h-2 w-full bg-[#DBE2EF] rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-[#3F72AF] transition-all duration-300"
                    style={{ width: `${((currentQuestionIdx + 1) / DEFAULT_QUIZ.questions.length) * 100}%` }}
                  ></div>
                </div>
              </div>

              {/* Question Body */}
              <div className="flex-1 p-8 md:p-12">
                <h2 className="text-2xl font-bold text-[#112D4E] mb-8 leading-tight">
                  {DEFAULT_QUIZ.questions[currentQuestionIdx].text}
                </h2>

                <div className="space-y-4">
                  {DEFAULT_QUIZ.questions[currentQuestionIdx].options.map((option, idx) => {
                    const isSelected = answers[DEFAULT_QUIZ.questions[currentQuestionIdx].id] === idx;
                    return (
                      <button
                        key={idx}
                        onClick={() => handleOptionSelect(idx)}
                        className={`w-full text-left p-5 rounded-2xl border-2 transition-all flex items-center justify-between group ${
                          isSelected 
                            ? 'border-[#3F72AF] bg-[#3F72AF]/5' 
                            : 'border-[#DBE2EF] hover:border-[#3F72AF]/40 hover:bg-[#F9F7F7]'
                        }`}
                      >
                        <span className={`font-semibold ${isSelected ? 'text-[#3F72AF]' : 'text-zinc-700'}`}>
                          {option}
                        </span>
                        <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                          isSelected ? 'border-[#3F72AF]' : 'border-zinc-300 group-hover:border-[#3F72AF]/40'
                        }`}>
                          {isSelected && <div className="h-2.5 w-2.5 bg-[#3F72AF] rounded-full"></div>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Footer Actions */}
              <div className="p-6 border-t border-[#DBE2EF] flex justify-between items-center bg-white">
                <button
                  onClick={() => setCurrentQuestionIdx(prev => Math.max(0, prev - 1))}
                  disabled={currentQuestionIdx === 0}
                  className="px-6 py-3 font-bold text-zinc-500 hover:text-[#112D4E] disabled:opacity-30 transition-colors"
                >
                  Previous
                </button>
                
                <button
                  onClick={handleNext}
                  disabled={answers[DEFAULT_QUIZ.questions[currentQuestionIdx].id] === undefined}
                  className="px-8 py-3 bg-[#112D4E] hover:bg-[#112D4E]/90 text-white font-bold rounded-xl shadow-sm transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {currentQuestionIdx === DEFAULT_QUIZ.questions.length - 1 ? 'Submit Assessment' : 'Next Question'}
                  {currentQuestionIdx !== DEFAULT_QUIZ.questions.length - 1 && <ChevronRight className="h-4 w-4" />}
                </button>
              </div>
            </div>
          )}

          {/* SUBMITTING STATE */}
          {quizState === 'submitting' && (
            <div className="flex-1 flex flex-col items-center justify-center p-10 text-center">
              <div className="h-16 w-16 animate-spin rounded-full border-4 border-[#3F72AF] border-t-transparent mb-6"></div>
              <h2 className="text-xl font-bold text-[#112D4E]">Grading Assessment...</h2>
              <p className="text-sm text-zinc-500 mt-2">Checking your answers against our secure rubric.</p>
            </div>
          )}

          {/* RESULTS STATE */}
          {quizState === 'results' && score !== null && (
            <div className="flex-1 flex flex-col items-center justify-center p-10 text-center relative overflow-hidden">
              {/* Decorative background glow for passing */}
              {passed && <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-emerald-400/10 rounded-full blur-3xl pointer-events-none"></div>}

              <div className={`h-24 w-24 rounded-full flex items-center justify-center mb-6 z-10 border-4 shadow-xl ${
                passed ? 'bg-emerald-500 border-emerald-200' : 'bg-red-500 border-red-200'
              }`}>
                {passed ? <CheckCircle2 className="h-12 w-12 text-white" /> : <XCircle className="h-12 w-12 text-white" />}
              </div>
              
              <h2 className="text-4xl font-extrabold text-[#112D4E] mb-2 z-10">
                {score}%
              </h2>
              
              <h3 className={`text-xl font-bold mb-4 z-10 ${passed ? 'text-emerald-650' : 'text-red-650'}`}>
                {passed ? 'Assessment Passed!' : 'Assessment Failed'}
              </h3>
              
              <p className="text-zinc-550 max-w-sm mb-10 z-10 font-medium">
                {passed 
                  ? "Outstanding! You have successfully demonstrated your knowledge. Your certificate is now ready."
                  : `You need at least ${DEFAULT_QUIZ.passingScore}% to pass. Review the course materials and try again.`
                }
              </p>

              <div className="flex gap-4 z-10">
                {!passed && (
                  <button
                    onClick={() => {
                      setAnswers({});
                      setCurrentQuestionIdx(0);
                      setQuizState('active');
                    }}
                    className="px-6 py-3 bg-white border-2 border-[#DBE2EF] hover:border-[#3F72AF] text-[#112D4E] font-bold rounded-xl transition-all"
                  >
                    Retake Assessment
                  </button>
                )}
                
                {passed && (
                  <button
                    onClick={() => router.push('/certificates')}
                    className="px-8 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl shadow-md transition-all"
                  >
                    Claim Certificate
                  </button>
                )}
                
                <button
                  onClick={() => router.push(`/courses/${courseId}`)}
                  className={`px-6 py-3 font-bold rounded-xl transition-all ${
                    passed ? 'bg-[#F9F7F7] text-zinc-600 hover:bg-[#DBE2EF]/50' : 'bg-[#112D4E] text-white hover:bg-[#112D4E]/90'
                  }`}
                >
                  Return to Syllabus
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
