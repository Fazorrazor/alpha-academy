// src/app/leaderboard/page.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard-layout';
import { useAuth } from '@/context/auth-context';
import { Trophy, Medal, Star, Flame, Loader2, Sparkles, User, GraduationCap } from 'lucide-react';

interface LeaderboardUser {
  uid: string;
  displayName: string;
  photoURL: string | null;
  totalPoints: number;
  coursesCompleted: number;
  rank: number;
}

export default function LeaderboardPage() {
  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();
  
  const [leaderboard, setLeaderboard] = useState<LeaderboardUser[]>([]);
  const [myRank, setMyRank] = useState<LeaderboardUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/login');
      return;
    }

    async function fetchLeaderboardData() {
      try {
        const [lbRes, meRes] = await Promise.all([
          fetch('/api/v1/leaderboard'),
          fetch('/api/v1/leaderboard/me'),
        ]);

        if (lbRes.ok) {
          const lbData = await lbRes.json();
          setLeaderboard(lbData.leaderboard || []);
        }

        if (meRes.ok) {
          const meData = await meRes.json();
          setMyRank(meData.me || null);
        }
      } catch (err) {
        console.error('Error fetching leaderboard data:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchLeaderboardData();
  }, [user, authLoading, router]);

  // Helper to determine rank styling
  const getRankBadge = (rank: number) => {
    if (rank === 1) {
      return (
        <span className="flex items-center justify-center h-7 w-7 rounded-full bg-amber-100 text-amber-600 font-black shadow-sm" title="Gold Medal">
          🥇
        </span>
      );
    }
    if (rank === 2) {
      return (
        <span className="flex items-center justify-center h-7 w-7 rounded-full bg-zinc-150 text-zinc-550 font-black shadow-sm" title="Silver Medal">
          🥈
        </span>
      );
    }
    if (rank === 3) {
      return (
        <span className="flex items-center justify-center h-7 w-7 rounded-full bg-amber-50 text-amber-700 font-black shadow-sm" title="Bronze Medal">
          🥉
        </span>
      );
    }
    return (
      <span className="text-xs font-bold text-zinc-400">
        #{rank}
      </span>
    );
  };

  return (
    <DashboardLayout>
      <div className="p-6 md:p-10 space-y-8 font-sans max-w-5xl mx-auto pb-12">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-[#DBE2EF] pb-5">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-[#112D4E] flex items-center gap-2">
              <Trophy className="h-6 w-6 text-amber-500 fill-amber-400" />
              Global Leaderboard
            </h1>
            <p className="text-zinc-500 text-sm mt-1">
              Compete with students globally. Earn study points by finishing lessons and completing paths.
            </p>
          </div>
        </div>

        {loading || authLoading ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white border border-[#DBE2EF] rounded-3xl shadow-sm">
            <Loader2 className="h-10 w-10 text-[#3F72AF] animate-spin" />
            <p className="text-zinc-500 text-sm mt-4 animate-pulse">Calculating rankings...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            
            {/* Left/Main Column: Top 50 List */}
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-white border border-[#DBE2EF] rounded-3xl shadow-sm overflow-hidden">
                <div className="p-6 border-b border-[#DBE2EF] bg-[#F9F7F7]">
                  <h3 className="font-extrabold text-[#112D4E] text-base">Top Achievers</h3>
                </div>

                {leaderboard.length === 0 ? (
                  <div className="p-12 text-center text-zinc-400 text-sm">
                    No ranks calculated yet. Start learning to show up here!
                  </div>
                ) : (
                  <div className="divide-y divide-zinc-100 overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-zinc-50/50 text-[10px] font-black text-zinc-400 uppercase tracking-wider">
                          <th className="py-4 px-6 text-center w-16">Rank</th>
                          <th className="py-4 px-4">Student</th>
                          <th className="py-4 px-4 text-center">Completed</th>
                          <th className="py-4 px-6 text-right">Points</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 text-sm">
                        {leaderboard.map((student) => {
                          const isMe = student.uid === user?.uid;
                          return (
                            <tr
                              key={student.uid}
                              className={`transition-colors ${
                                isMe 
                                  ? 'bg-[#3F72AF]/5 hover:bg-[#3F72AF]/10 font-semibold' 
                                  : 'hover:bg-zinc-50/70'
                              }`}
                            >
                              <td className="py-4 px-6 text-center">
                                <div className="flex justify-center">
                                  {getRankBadge(student.rank)}
                                </div>
                              </td>
                              <td className="py-4 px-4">
                                <div className="flex items-center gap-3">
                                  <div className="h-8 w-8 rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-500 overflow-hidden text-xs font-bold font-sans">
                                    {student.photoURL ? (
                                      <img src={student.photoURL} alt={student.displayName} className="h-full w-full object-cover" />
                                    ) : (
                                      <User className="h-4.5 w-4.5" />
                                    )}
                                  </div>
                                  <div>
                                    <span className={`text-[#112D4E] block ${isMe ? 'font-bold' : ''}`}>
                                      {student.displayName}
                                    </span>
                                    {isMe && (
                                      <span className="inline-block text-[9px] font-black text-[#3F72AF] uppercase tracking-wider">
                                        You
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="py-4 px-4 text-center text-[#112D4E]">
                                <div className="flex items-center justify-center gap-1">
                                  <GraduationCap className="h-4 w-4 text-zinc-400" />
                                  <span>{student.coursesCompleted}</span>
                                </div>
                              </td>
                              <td className="py-4 px-6 text-right font-black text-[#112D4E]">
                                {student.totalPoints.toLocaleString()}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: User Stats Card */}
            <div className="space-y-6">
              {/* My stats summary card */}
              <div className="bg-[#112D4E] text-white rounded-3xl p-6 shadow-md relative overflow-hidden">
                <div className="absolute top-0 right-0 transform translate-x-6 -translate-y-6 h-32 w-32 rounded-full bg-white/5 pointer-events-none"></div>
                
                <h3 className="font-extrabold text-sm uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                  <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
                  Your Standing
                </h3>

                <div className="mt-6 flex items-center gap-4">
                  <div className="h-14 w-14 rounded-2xl bg-white/10 flex items-center justify-center text-2xl font-black text-amber-400 border border-white/10">
                    {myRank && myRank.rank > 0 ? `#${myRank.rank}` : '-'}
                  </div>
                  <div>
                    <h4 className="font-black text-lg text-white leading-tight">
                      {profile?.displayName || 'Anonymous Student'}
                    </h4>
                    <p className="text-zinc-300 text-xs mt-0.5">
                      Earn {10 - ((profile?.totalPoints || 0) % 10)} points for your next rank!
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-8 pt-6 border-t border-white/15 text-center">
                  <div>
                    <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">Total Points</span>
                    <span className="text-xl font-black text-white mt-1 block">
                      {(profile?.totalPoints || 0).toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">Courses Done</span>
                    <span className="text-xl font-black text-white mt-1 block">
                      {myRank?.coursesCompleted || 0}
                    </span>
                  </div>
                </div>
              </div>

              {/* Point Earning Guide Card */}
              <div className="bg-white border border-[#DBE2EF] rounded-3xl p-6 shadow-sm space-y-4">
                <h4 className="font-black text-[#112D4E] text-sm uppercase tracking-wide flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-[#3F72AF]" />
                  Earning Points
                </h4>
                <ul className="space-y-3 text-xs text-zinc-550">
                  <li className="flex items-start gap-2">
                    <span className="h-2 w-2 rounded-full bg-[#3F72AF] mt-1.5 flex-shrink-0"></span>
                    <span><strong>10 points</strong> for every core lesson completed.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="h-2 w-2 rounded-full bg-[#3F72AF] mt-1.5 flex-shrink-0"></span>
                    <span><strong>50 points</strong> for passing a module assessment quiz.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="h-2 w-2 rounded-full bg-[#3F72AF] mt-1.5 flex-shrink-0"></span>
                    <span>Completing full learning paths boosts your leaderboard authority.</span>
                  </li>
                </ul>
              </div>
            </div>

          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
