// src/lib/certificates.ts
import PDFDocument from 'pdfkit';
import { adminDb, adminStorage } from '@/lib/firebase/admin';
import { firestore } from 'firebase-admin';
import { sendEmail } from '@/lib/email';

/**
 * Draws a gorgeous branded PDF certificate in landscape A4 size
 */
export async function generateCertificatePDF(
  studentName: string,
  courseTitle: string,
  completionDate: Date,
  certificateId: string
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        layout: 'landscape',
        size: 'A4',
        margins: { top: 40, bottom: 40, left: 40, right: 40 },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));

      // --- DRAW BACKGROUND & BORDERS ---
      // Background Fill
      doc.rect(0, 0, doc.page.width, doc.page.height).fill('#F9F7F7');

      // Outer Navy Border
      doc.lineWidth(4);
      doc.rect(20, 20, doc.page.width - 40, doc.page.height - 40).stroke('#112D4E');

      // Inner Light Blue Border
      doc.lineWidth(1.5);
      doc.rect(28, 28, doc.page.width - 56, doc.page.height - 56).stroke('#3F72AF');

      // --- CORNER DECORATIVE GEOMETRY ---
      // Top-Left Corner Accent
      doc.rect(34, 34, 40, 6).fill('#112D4E');
      doc.rect(34, 34, 6, 40).fill('#112D4E');
      doc.rect(42, 42, 28, 4).fill('#3F72AF');
      doc.rect(42, 42, 4, 28).fill('#3F72AF');

      // Top-Right Corner Accent
      doc.rect(doc.page.width - 74, 34, 40, 6).fill('#112D4E');
      doc.rect(doc.page.width - 40, 34, 6, 40).fill('#112D4E');
      doc.rect(doc.page.width - 70, 42, 28, 4).fill('#3F72AF');
      doc.rect(doc.page.width - 46, 42, 4, 28).fill('#3F72AF');

      // Bottom-Left Corner Accent
      doc.rect(34, doc.page.height - 40, 40, 6).fill('#112D4E');
      doc.rect(34, doc.page.height - 74, 6, 40).fill('#112D4E');
      doc.rect(42, doc.page.height - 46, 28, 4).fill('#3F72AF');
      doc.rect(42, doc.page.height - 70, 4, 28).fill('#3F72AF');

      // Bottom-Right Corner Accent
      doc.rect(doc.page.width - 74, doc.page.height - 40, 40, 6).fill('#112D4E');
      doc.rect(doc.page.width - 40, doc.page.height - 74, 6, 40).fill('#112D4E');
      doc.rect(doc.page.width - 70, doc.page.height - 46, 28, 4).fill('#3F72AF');
      doc.rect(doc.page.width - 46, doc.page.height - 70, 4, 28).fill('#3F72AF');

      // --- HEADER: LOGO & ACADEMY NAME ---
      doc.fillColor('#3F72AF');
      // Logo (Graduation Cap Vector Path)
      doc.moveTo(doc.page.width / 2, 85)
         .lineTo(doc.page.width / 2 - 25, 95)
         .lineTo(doc.page.width / 2, 105)
         .lineTo(doc.page.width / 2 + 25, 95)
         .closePath()
         .fill();
      doc.rect(doc.page.width / 2 - 12, 98, 24, 12).fill();
      
      // Academy Name
      doc.fillColor('#112D4E');
      doc.font('Helvetica-Bold').fontSize(14).text('A L P H A   A C A D E M Y', 0, 125, {
        align: 'center',
        width: doc.page.width
      });

      // --- CERTIFICATE MAIN TITLE ---
      doc.moveDown(0.8);
      doc.font('Times-BoldItalic').fontSize(36).fillColor('#112D4E').text('Certificate of Completion', {
        align: 'center',
      });

      // --- RECIPIENT PRESENTATION ---
      doc.moveDown(0.6);
      doc.font('Helvetica').fontSize(12).fillColor('#555555').text('THIS CREDENTIAL IS PROUDLY PRESENTED TO', {
        align: 'center',
      });

      // --- RECIPIENT NAME ---
      doc.moveDown(0.6);
      doc.font('Times-Bold').fontSize(28).fillColor('#112D4E').text(studentName, {
        align: 'center',
      });

      // Underline recipient name
      doc.lineWidth(1);
      doc.moveTo(doc.page.width / 2 - 150, doc.y + 4)
         .lineTo(doc.page.width / 2 + 150, doc.y + 4)
         .stroke('#3F72AF');

      // --- HAS COMPLETED ---
      doc.moveDown(1.2);
      doc.font('Helvetica').fontSize(11).fillColor('#555555').text(
        'for successfully mastering and completing all curriculum requirements, lessons, and core challenges for',
        { align: 'center' }
      );

      // --- COURSE TITLE ---
      doc.moveDown(0.6);
      doc.font('Helvetica-Bold').fontSize(20).fillColor('#3F72AF').text(courseTitle, {
        align: 'center',
      });

      // --- DATES & METADATA FOOTER ---
      doc.moveDown(2);
      const footerY = doc.y;

      // Date Column
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#112D4E').text('DATE OF ISSUANCE', 80, footerY);
      doc.font('Helvetica').fontSize(10).fillColor('#555555').text(completionDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }), 80, footerY + 18);
      doc.moveTo(80, footerY + 32).lineTo(220, footerY + 32).lineWidth(0.5).stroke('#DBE2EF');

      // Verified Seal
      doc.fillColor('#3F72AF');
      doc.circle(doc.page.width / 2, footerY + 15, 25).fill();
      doc.fillColor('#ffffff');
      doc.font('Helvetica-Bold').fontSize(8).text('VERIFIED', doc.page.width / 2 - 25, footerY + 8, {
        align: 'center',
        width: 50
      });
      doc.font('Helvetica-Bold').fontSize(6).text('CREDENTIAL', doc.page.width / 2 - 25, footerY + 17, {
        align: 'center',
        width: 50
      });

      // Instructor Signature Column
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#112D4E').text('AUTHORIZED SIGNATURE', doc.page.width - 220, footerY);
      doc.font('Times-BoldItalic').fontSize(12).fillColor('#3F72AF').text('Dr. Kwame Mensah', doc.page.width - 220, footerY + 16);
      doc.font('Helvetica').fontSize(9).fillColor('#888888').text('Director, Alpha Academy', doc.page.width - 220, footerY + 30);
      doc.moveTo(doc.page.width - 220, footerY + 44).lineTo(doc.page.width - 80, footerY + 44).lineWidth(0.5).stroke('#DBE2EF');

      // --- CERTIFICATE CRYPTO ID (TINY BOTTOM CENTER) ---
      doc.font('Courier').fontSize(7).fillColor('#888888').text(`Verify Online: alphaacademy.edu.gh/verify/${certificateId}`, 0, doc.page.height - 50, {
        align: 'center',
        width: doc.page.width
      });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Checks if a student has completed all course lessons (+ quiz if exists).
 * If requirements are met, generates and uploads the PDF certificate, updates Firestore collections, and sends emails.
 */
export async function checkAndTriggerCourseCompletion(uid: string, courseId: string): Promise<any | null> {
  console.log(`Checking course completion status for student: ${uid}, course: ${courseId}`);

  // 1. Fetch course details
  const courseDoc = await adminDb.collection('courses').doc(courseId).get();
  if (!courseDoc.exists) {
    console.error(`Course ${courseId} not found.`);
    return null;
  }
  const courseData = courseDoc.data();
  const courseTitle = courseData?.title || 'Unknown Course';

  // 2. Fetch all published lessons for this course
  const lessonsQuery = await adminDb
    .collection('courses')
    .doc(courseId)
    .collection('lessons')
    .where('status', '==', 'published')
    .get();
  
  const totalLessonsCount = lessonsQuery.size;
  if (totalLessonsCount === 0) {
    console.log(`Course ${courseId} has no published lessons. Skipping completion check.`);
    return null;
  }

  // 3. Fetch completed progress documents for this user & course
  const completedProgressQuery = await adminDb
    .collection('progress')
    .where('uid', '==', uid)
    .where('courseId', '==', courseId)
    .where('completed', '==', true)
    .get();

  const completedLessonsCount = completedProgressQuery.size;
  console.log(`Completed ${completedLessonsCount}/${totalLessonsCount} lessons for course ${courseId}`);

  if (completedLessonsCount < totalLessonsCount) {
    console.log(`Student has not completed all lessons (${completedLessonsCount}/${totalLessonsCount}).`);
    return null;
  }

  // 4. Check if course has a quiz, and if so, check if the user passed it
  const quizzesQuery = await adminDb
    .collection('quizzes')
    .where('courseId', '==', courseId)
    .where('status', '==', 'published')
    .get();

  if (!quizzesQuery.empty) {
    const quizAttemptsQuery = await adminDb
      .collection('quizAttempts')
      .where('uid', '==', uid)
      .where('courseId', '==', courseId)
      .where('passed', '==', true)
      .limit(1)
      .get();

    if (quizAttemptsQuery.empty) {
      console.log(`Course has a quiz, but student has no passing attempt yet.`);
      return null;
    }
  }

  // 5. Prevent duplicate certificate generation
  const certId = `${uid}_${courseId}`;
  const certRef = adminDb.collection('certificates').doc(certId);
  const certSnap = await certRef.get();
  if (certSnap.exists) {
    console.log('Certificate already generated. Skipping.');
    return certSnap.data();
  }

  // 6. Fetch student profile details
  const profileRef = adminDb.collection('profiles').doc(uid);
  const profileSnap = await profileRef.get();
  if (!profileSnap.exists) {
    console.error(`Student profile ${uid} not found.`);
    return null;
  }
  const profileData = profileSnap.data();
  const studentName = profileData?.displayName || 'Scholar';
  const studentEmail = profileData?.email || '';

  // 7. Generate PDF Certificate buffer
  console.log('All criteria met! Generating PDF Certificate...');
  const completionDate = new Date();
  const pdfBuffer = await generateCertificatePDF(studentName, courseTitle, completionDate, certId);

  // 8. Upload to Firebase Storage
  const storageBucket = adminStorage.bucket();
  const storagePath = `certificates/${uid}/${courseId}.pdf`;
  const fileRef = storageBucket.file(storagePath);
  
  await fileRef.save(pdfBuffer, {
    contentType: 'application/pdf',
    metadata: {
      metadata: {
        uid,
        courseId,
        studentName,
      }
    }
  });

  // Resolve download url
  let downloadUrl = '';
  const isMock = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === 'true';
  const bucketName = storageBucket.name || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'alpha-academy.appspot.com';
  
  if (isMock) {
    const storageHost = process.env.FIREBASE_STORAGE_EMULATOR_HOST || '127.0.0.1:9199';
    downloadUrl = `http://${storageHost}/v0/b/${bucketName}/o/${encodeURIComponent(storagePath)}?alt=media`;
  } else {
    try {
      const [url] = await fileRef.getSignedUrl({
        action: 'read',
        expires: '12-31-2099',
      });
      downloadUrl = url;
    } catch (e) {
      downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(storagePath)}?alt=media`;
    }
  }

  // 9. Write certificate metadata and update enrollment/leaderboard in a batch
  const batch = adminDb.batch();
  
  batch.set(certRef, {
    id: certId,
    uid,
    courseId,
    courseTitle,
    studentName,
    issuedAt: firestore.Timestamp.fromDate(completionDate),
    storagePath,
    downloadUrl,
  });

  const enrollmentRef = adminDb.collection('enrollments').doc(certId);
  batch.update(enrollmentRef, {
    completedAt: firestore.Timestamp.fromDate(completionDate),
    certificateUrl: downloadUrl,
  });

  const leaderboardRef = adminDb.collection('leaderboard').doc(uid);
  batch.set(
    leaderboardRef,
    {
      coursesCompleted: firestore.FieldValue.increment(1),
      updatedAt: firestore.Timestamp.now(),
    },
    { merge: true }
  );

  const notificationId = `notif_${Math.random().toString(36).substring(7)}`;
  const notificationRef = adminDb.collection('notifications').doc(notificationId);
  batch.set(notificationRef, {
    id: notificationId,
    uid,
    type: 'certificate_ready',
    title: 'Certificate Issued!',
    body: `Congratulations! You have completed "${courseTitle}" and your official certificate is ready.`,
    read: false,
    channels: ['email', 'in_app'],
    createdAt: firestore.Timestamp.now(),
  });

  await batch.commit();
  console.log(`Certificate ${certId} successfully written and saved.`);

  // 10. Send transactional email notification
  if (studentEmail) {
    try {
      await sendEmail({
        to: studentEmail,
        subject: `Certificate Issued: ${courseTitle} - Alpha Academy`,
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #112D4E; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #DBE2EF; border-radius: 8px;">
            <h2 style="color: #3F72AF;">Congratulations, ${studentName}!</h2>
            <p>You have successfully completed all core lessons, requirements, and assessments for <strong>${courseTitle}</strong>.</p>
            <p>Your official, verified completion certificate has been generated and is ready to view and download.</p>
            <div style="margin: 30px 0; text-align: center;">
              <a href="${downloadUrl}" style="background-color: #3F72AF; color: white; padding: 12px 24px; text-decoration: none; font-weight: bold; border-radius: 6px;">View Certificate</a>
            </div>
            <p>Add this certificate to your resume or LinkedIn profile to show your verified technical expertise.</p>
            <hr style="border: 0; border-top: 1px solid #DBE2EF; margin: 20px 0;">
            <p style="font-size: 11px; color: #888888;">This is an automated message sent from Alpha Academy. Please do not reply directly to this email.</p>
          </div>
        `,
      });
      console.log(`Notification email sent successfully to ${studentEmail}.`);
    } catch (emailErr) {
      console.error('Failed to send certificate notification email:', emailErr);
    }
  }

  return {
    id: certId,
    uid,
    courseId,
    courseTitle,
    studentName,
    downloadUrl,
  };
}
