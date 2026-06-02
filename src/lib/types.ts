// src/lib/types.ts

export type UserRole = 'student' | 'admin';
export type SubscriptionStatus = 'active' | 'expired' | 'cancelled' | 'trial' | 'none';
export type SubscriptionPlan = 'monthly' | 'annual';
export type PublishStatus = 'draft' | 'published' | 'archived';
export type ContentType = 'video' | 'pdf';
export type NotificationChannel = 'email' | 'sms' | 'in_app';

export interface Timestamp {
  seconds: number;
  nanoseconds: number;
  toDate(): Date;
}

export interface UserProfile {
  uid: string;
  email: string | null;
  phoneNumber: string | null;
  displayName: string;
  photoURL: string | null;
  role: UserRole;
  subscription: SubscriptionStatus;
  subscriptionPlan: SubscriptionPlan | null;
  subscriptionExpiresAt: Timestamp | null;
  paystackCustomerCode: string | null;
  paystackSubscriptionCode: string | null;
  totalPoints: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  suspended: boolean;
}

export interface Subject {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string | null;
  status: PublishStatus;
  order: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string; // admin uid
}

export interface Course {
  id: string;
  subjectId: string;
  title: string;
  description: string;
  thumbnailUrl: string | null;
  status: PublishStatus;
  order: number;
  totalLessons: number;
  estimatedDurationMinutes: number;
  tags: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
}

export interface Lesson {
  id: string;
  courseId: string;
  title: string;
  description: string;
  type: ContentType;
  order: number;
  status: PublishStatus;
  // Video
  muxAssetId: string | null;
  muxPlaybackId: string | null;
  durationSeconds: number | null;
  // PDF
  storagePath: string | null;
  // Points
  completionPoints: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Quiz {
  id: string;
  courseId: string;
  lessonId: string | null; // null = course-level quiz
  title: string;
  description: string;
  status: PublishStatus;
  passThresholdPercent: number; // e.g. 70
  maxAttempts: number; // 0 = unlimited
  timeLimitMinutes: number | null;
  completionPoints: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface QuizQuestion {
  id: string;
  quizId: string;
  question: string;
  options: string[];
  correctOptionIndex: number; // never sent to client
  explanation: string | null;
  order: number;
}

export interface QuizAttempt {
  id: string; // {uid}_{quizId}_{timestamp}
  uid: string;
  quizId: string;
  courseId: string;
  answers: number[]; // selected option indices
  score: number; // percentage
  passed: boolean;
  pointsAwarded: number;
  startedAt: Timestamp;
  completedAt: Timestamp;
}

export interface Enrollment {
  id: string; // {uid}_{courseId}
  uid: string;
  courseId: string;
  enrolledAt: Timestamp;
  completedAt: Timestamp | null;
  certificateUrl: string | null;
}

export interface Progress {
  id: string; // {uid}_{lessonId}
  uid: string;
  lessonId: string;
  courseId: string;
  completed: boolean;
  lastPositionSeconds: number;
  watchedPercent: number;
  pointsAwarded: number;
  completedAt: Timestamp | null;
  updatedAt: Timestamp;
}

export interface Certificate {
  id: string; // {uid}_{courseId}
  uid: string;
  courseId: string;
  courseTitle: string;
  studentName: string;
  issuedAt: Timestamp;
  storagePath: string;
  downloadUrl: string;
}

export interface LeaderboardEntry {
  uid: string;
  displayName: string;
  photoURL: string | null;
  totalPoints: number;
  coursesCompleted: number;
  rank: number;
  updatedAt: Timestamp;
}

export interface DiscussionThread {
  id: string;
  courseId: string;
  lessonId: string | null; // null = course-level thread
  title: string;
  body: string;
  authorUid: string;
  authorName: string;
  authorRole: UserRole;
  replyCount: number;
  isPinned: boolean;
  isLocked: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface DiscussionReply {
  id: string;
  threadId: string;
  body: string;
  authorUid: string;
  authorName: string;
  authorRole: UserRole;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Notification {
  id: string;
  uid: string;
  type: 'enrollment' | 'quiz_result' | 'certificate_ready' | 'new_content' | 'subscription_expiring' | 'subscription_expired' | 'payment_success' | 'payment_failed';
  title: string;
  body: string;
  read: boolean;
  channels: NotificationChannel[];
  createdAt: Timestamp;
}

export interface SubscriptionEvent {
  id: string;
  uid: string;
  paystackReference: string;
  event: string; // Paystack event type
  plan: SubscriptionPlan;
  amount: number; // in pesewas (GHS kobo equivalent)
  currency: string;
  status: 'success' | 'failed' | 'cancelled';
  createdAt: Timestamp;
}

export interface AuditLog {
  id: string;
  actorUid: string;
  actorEmail: string | null;
  action: string;
  targetType: string;
  targetId: string;
  metadata: Record<string, unknown>;
  ipAddress: string | null;
  createdAt: Timestamp;
}

export interface SystemEvent {
  id: string;
  type: string;
  message: string;
  metadata: Record<string, unknown>;
  createdAt: Timestamp;
}
