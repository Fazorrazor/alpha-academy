// src/scripts/seed.ts
import { loadEnvConfig } from '@next/env';

interface Subject {
  title: string;
  description: string;
  published: boolean;
  status: 'draft' | 'published' | 'archived';
}

interface Course {
  subjectId: string;
  title: string;
  description: string;
  estimatedDurationMinutes: number;
  totalLessons: number;
  tags: string[];
  published: boolean;
  status: 'draft' | 'published' | 'archived';
}

interface Lesson {
  title: string;
  description: string;
  type: 'video' | 'pdf';
  order: number;
  published: boolean;
  status: 'draft' | 'published' | 'archived';
}

const SEED_SUBJECTS: Record<string, Subject> = {
  'sub-se': {
    title: 'Software Engineering',
    description: 'Design, build, and deploy systems at scale.',
    published: true,
    status: 'published'
  },
  'sub-fin': {
    title: 'Finance & Quantitative Trading',
    description: 'Algorithmic trading and financial market analytics.',
    published: true,
    status: 'published'
  },
  'sub-ds': {
    title: 'Data Science & Machine Learning',
    description: 'Deep learning, neural networks, and AI architectures.',
    published: true,
    status: 'published'
  }
};

const SEED_COURSES: Record<string, Course> = {
  'course-1': {
    subjectId: 'sub-se',
    title: 'Advanced System Design & Architecture',
    description: 'Learn to design highly scalable, fault-tolerant systems. Covers microservices, load balancing, caching, database sharding, and event-driven architectures.',
    estimatedDurationMinutes: 600,
    totalLessons: 5,
    tags: ['Architecture', 'Scalability', 'Backend'],
    published: true,
    status: 'published'
  },
  'course-2': {
    subjectId: 'sub-fin',
    title: 'Financial Markets & Algorithmic Trading',
    description: 'Master quantitative finance and automated trading strategies. Covers market mechanics, technical indicators, order books, and building trading bots in Python.',
    estimatedDurationMinutes: 480,
    totalLessons: 3,
    tags: ['Trading', 'Python', 'Quantitative'],
    published: true,
    status: 'published'
  },
  'course-3': {
    subjectId: 'sub-ds',
    title: 'Applied Machine Learning & Neural Networks',
    description: 'Design and train deep learning models. Practical guide to supervised learning, NLP, computer vision, and deploying neural networks to production.',
    estimatedDurationMinutes: 720,
    totalLessons: 3,
    tags: ['AI', 'Neural Networks', 'TensorFlow'],
    published: true,
    status: 'published'
  },
  'course-4': {
    subjectId: 'sub-se',
    title: 'Systems Programming with Rust',
    description: 'Write high-performance, memory-safe software without a garbage collector. Master concurrency, lifetimes, and safety guarantees.',
    estimatedDurationMinutes: 540,
    totalLessons: 3,
    tags: ['Rust', 'Systems', 'Performance'],
    published: true,
    status: 'published'
  }
};

const SEED_LESSONS: Record<string, Lesson[]> = {
  'course-1': [
    { title: 'Introduction to System Design & Architectural Goals', description: 'Understand SLA, throughput, availability metrics, and core constraints.', type: 'video', order: 1, published: true, status: 'published' },
    { title: 'Understanding Scalability: Vertical vs Horizontal', description: 'Deep dive into load distribution patterns, stateless systems, and network bounds.', type: 'video', order: 2, published: true, status: 'published' },
    { title: 'Load Balancing Strategies & Reverse Proxies', description: 'Explore round-robin, least connections, hashing mechanisms, Nginx, and HAProxy.', type: 'video', order: 3, published: true, status: 'published' },
    { title: 'Caching Strategies: Memcached and Redis', description: 'Cache-aside, write-through, eviction policies, and session storage patterns.', type: 'pdf', order: 4, published: true, status: 'published' },
    { title: 'Database Sharding & Replication Topologies', description: 'Partitioning keys, consistent hashing, master-slave topologies, and consensus protocols.', type: 'video', order: 5, published: true, status: 'published' }
  ],
  'course-2': [
    { title: 'Foundations of Financial Markets & Order Books', description: 'Limit order books, bid-ask spreads, market participants, and execution structures.', type: 'video', order: 1, published: true, status: 'published' },
    { title: 'Technical Indicators & Quantitative Signals', description: 'Moving averages, RSI, Bollinger Bands, and building clean signals in Python.', type: 'pdf', order: 2, published: true, status: 'published' },
    { title: 'Building an Execution System in Python', description: 'Connect to websocket feeds, manage positions, and submit algorithmic orders.', type: 'video', order: 3, published: true, status: 'published' }
  ],
  'course-3': [
    { title: 'Linear Algebra & Gradient Descent Fundamentals', description: 'Review vectors, matrix transformations, cost functions, and batch updates.', type: 'video', order: 1, published: true, status: 'published' },
    { title: 'Building a Multi-Layer Perceptron from Scratch', description: 'Forward propagation, backpropagation, and weights optimization in numpy.', type: 'video', order: 2, published: true, status: 'published' },
    { title: 'Convolutional Neural Networks for Image Recognition', description: 'Pooling, filters, activation mapping, and fine-tuning pretrained CNN models.', type: 'pdf', order: 3, published: true, status: 'published' }
  ],
  'course-4': [
    { title: 'Rust Safety Guarantees & Memory Management', description: 'Ownership model, stacking, heap allocation, and safe heap pointers.', type: 'video', order: 1, published: true, status: 'published' },
    { title: 'Understanding Lifetimes & Borrow Checker', description: 'References, mutable vs immutable rules, and explicit lifetime annotations.', type: 'pdf', order: 2, published: true, status: 'published' },
    { title: 'Safe Concurrency & Message Passing in Rust', description: 'Channels, Arc, Mutex, and thread execution bounds without data races.', type: 'video', order: 3, published: true, status: 'published' }
  ]
};

async function seedDatabase() {
  console.log('Loading environment variables...');
  loadEnvConfig(process.cwd());

  // Set emulator env variables explicitly for the script context
  process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR = 'true';
  process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
  process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
  process.env.FIREBASE_STORAGE_EMULATOR_HOST = '127.0.0.1:9199';

  console.log('Initializing Firebase Admin...');
  const { adminDb } = await import('../lib/firebase/admin');

  console.log('Seeding Database in Emulator...');
  
  // 1. Seed Subjects
  for (const [id, subject] of Object.entries(SEED_SUBJECTS)) {
    console.log(`Setting subject: ${id}`);
    await adminDb.collection('subjects').doc(id).set(subject);
  }

  // 2. Seed Courses & Lessons
  for (const [courseId, course] of Object.entries(SEED_COURSES)) {
    console.log(`Setting course: ${courseId}`);
    await adminDb.collection('courses').doc(courseId).set(course);

    // Seed Lessons subcollection
    const lessons = SEED_LESSONS[courseId] || [];
    const lessonsColl = adminDb.collection('courses').doc(courseId).collection('lessons');
    
    // Clear old lessons to prevent duplication
    const oldLessons = await lessonsColl.get();
    for (const doc of oldLessons.docs) {
      await doc.ref.delete();
    }

    for (let i = 0; i < lessons.length; i++) {
      const lesson = lessons[i];
      const lessonId = `${courseId}-l${i + 1}`;
      console.log(`  Setting lesson: ${lessonId}`);
      await lessonsColl.doc(lessonId).set(lesson);
    }
  }

  console.log('Successfully completed database seeding.');
  process.exit(0);
}

seedDatabase().catch((err) => {
  console.error('Error seeding database:', err);
  process.exit(1);
});
