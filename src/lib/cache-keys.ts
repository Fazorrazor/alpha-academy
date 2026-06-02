/**
 * Centralised Redis cache key definitions.
 * All cache consumers and invalidators must use these constants —
 * no inline strings. TTL constants are in seconds.
 */

export const CACHE_TTL = {
  CATALOG: 60 * 60,          // 1 hour — subjects + courses list
  COURSE_DETAIL: 60 * 60,    // 1 hour — single course + lessons
  LEADERBOARD: 5 * 60,       // 5 minutes
  USER_PROFILE: 5 * 60,      // 5 minutes
} as const;

export const CACHE_KEYS = {
  subjects: () => 'catalog:subjects',
  courses: (subjectId?: string) =>
    subjectId ? `catalog:courses:subject:${subjectId}` : 'catalog:courses:all',
  courseDetail: (courseId: string) => `catalog:course:${courseId}`,
  courseLessons: (courseId: string) => `catalog:lessons:${courseId}`,
  leaderboard: () => 'leaderboard:top50',
} as const;

/**
 * Returns all cache keys that should be invalidated when a subject changes.
 */
export function subjectCacheKeys(subjectId: string): string[] {
  return [
    CACHE_KEYS.subjects(),
    CACHE_KEYS.courses(),               // all-courses list may change
    CACHE_KEYS.courses(subjectId),      // subject-filtered list
  ];
}

/**
 * Returns all cache keys that should be invalidated when a course changes.
 */
export function courseCacheKeys(courseId: string, subjectId?: string): string[] {
  const keys = [
    CACHE_KEYS.courses(),
    CACHE_KEYS.courseDetail(courseId),
    CACHE_KEYS.courseLessons(courseId),
  ];
  if (subjectId) {
    keys.push(CACHE_KEYS.courses(subjectId));
  }
  return keys;
}

/**
 * Returns all cache keys that should be invalidated when a lesson changes.
 */
export function lessonCacheKeys(courseId: string): string[] {
  return [
    CACHE_KEYS.courseDetail(courseId),
    CACHE_KEYS.courseLessons(courseId),
  ];
}
