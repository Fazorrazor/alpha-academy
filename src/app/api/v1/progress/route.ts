// src/app/api/v1/progress/route.ts
import { NextResponse } from 'next/server';
import { firestore } from 'firebase-admin';
import { requireSession } from '@/lib/firebase/auth-helper';
import { adminDb } from '@/lib/firebase/admin';
import { apiError, handleRouteError } from '@/lib/errors';
import type { UserProfile } from '@/lib/types';

// POST /api/v1/progress
// Records lesson progress and awards points upon first-time completion
export async function POST(req: Request) {
  try {
    const profile = await requireSession();

    const body = await req.json();
    const { lessonId, courseId, completed, lastPositionSeconds, watchedPercent } = body;

    if (!lessonId || !courseId) {
      return apiError('BAD_REQUEST', 'lessonId and courseId are required');
    }

    const progressId = `${profile.uid}_${lessonId}`;
    const progressRef = adminDb.collection('progress').doc(progressId);
    const profileRef = adminDb.collection('profiles').doc(profile.uid);
    const leaderboardRef = adminDb.collection('leaderboard').doc(profile.uid);

    let pointsAwarded = 0;

    await adminDb.runTransaction(async (transaction) => {
      // 1. Get existing progress
      const progressSnap = await transaction.get(progressRef);
      const wasCompleted = progressSnap.exists && progressSnap.data()?.completed === true;

      // 2. Determine if points should be awarded (if newly completed)
      const isNewlyCompleted = completed && !wasCompleted;
      if (isNewlyCompleted) {
        pointsAwarded = 10; // Default completion points
      }

      // 3. Get user profile
      const profileSnap = await transaction.get(profileRef);
      if (!profileSnap.exists) {
        throw new Error('PROFILE_NOT_FOUND');
      }
      const profileData = profileSnap.data() as UserProfile;
      const newTotalPoints = (profileData.totalPoints || 0) + pointsAwarded;

      // 4. Update progress document
      transaction.set(
        progressRef,
        {
          id: progressId,
          uid: profile.uid,
          studentId: profile.uid,
          lessonId,
          courseId,
          completed: !!completed,
          lastPositionSeconds: lastPositionSeconds || 0,
          watchedPercent: watchedPercent || 0,
          pointsAwarded: (progressSnap.data()?.pointsAwarded || 0) + pointsAwarded,
          completedAt: isNewlyCompleted ? firestore.Timestamp.now() : (progressSnap.data()?.completedAt || null),
          updatedAt: firestore.Timestamp.now(),
        },
        { merge: true }
      );

      // 5. Update user profile points if awarded
      if (pointsAwarded > 0) {
        transaction.update(profileRef, {
          totalPoints: newTotalPoints,
          updatedAt: firestore.Timestamp.now(),
        });

        // 6. Update leaderboard entry
        transaction.set(
          leaderboardRef,
          {
            uid: profile.uid,
            displayName: profileData.displayName || 'Anonymous Student',
            photoURL: profileData.photoURL || null,
            totalPoints: newTotalPoints,
            coursesCompleted: firestore.FieldValue.increment(0), // Can be updated on course finalization
            rank: 1, // Simplified placeholder rank
            updatedAt: firestore.Timestamp.now(),
          },
          { merge: true }
        );
      }
    });

    // If progress was marked as completed, check if course is finished and generate certificate
    let certificateIssued = false;
    let certificateData = null;
    if (completed) {
      const { checkAndTriggerCourseCompletion } = await import('@/lib/certificates');
      const certResult = await checkAndTriggerCourseCompletion(profile.uid, courseId);
      if (certResult) {
        certificateIssued = true;
        certificateData = certResult;
      }
    }

    return NextResponse.json({
      status: 'success',
      message: 'Progress recorded successfully',
      pointsAwarded,
      certificateIssued,
      certificateData,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
