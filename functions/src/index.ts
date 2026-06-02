import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";
import * as firestore from "@google-cloud/firestore";

// Initialize Firebase Admin
admin.initializeApp();

/**
 * Nightly Firestore Backup
 * Runs at 03:00 UTC every day.
 * Exports all collections to a dedicated Cloud Storage bucket.
 */
export const scheduledFirestoreBackup = onSchedule(
  {
    schedule: "every day 03:00",
    timeZone: "UTC",
    timeoutSeconds: 540, // Max 9 minutes for large backups
    memory: "256MiB",
  },
  async (event) => {
    // The default GCP_PROJECT environment variable is automatically populated in the runtime
    const projectId = process.env.GCP_PROJECT || process.env.GCLOUD_PROJECT;
    if (!projectId) {
      throw new Error("Missing GCP_PROJECT or GCLOUD_PROJECT env var");
    }

    // Name of the backup bucket (must be created manually with a lifecycle policy)
    const bucketName = `gs://${projectId}-backups`;
    const databaseName = `projects/${projectId}/databases/(default)`;
    const client = new firestore.v1.FirestoreAdminClient();

    try {
      console.log(`Starting Firestore backup for ${databaseName} to ${bucketName}`);
      
      const responses = await client.exportDocuments({
        name: databaseName,
        outputUriPrefix: bucketName,
        // Leave collectionIds empty to export all collections
        collectionIds: [],
      });

      console.log(`Backup operation initiated successfully: ${responses[0].name}`);
    } catch (err) {
      console.error("Firestore backup failed", err);
      throw new Error("Backup operation failed");
    }
  }
);
