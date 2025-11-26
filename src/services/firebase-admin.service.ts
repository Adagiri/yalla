import * as admin from 'firebase-admin';
import { ENV } from '../config/env';

let firebaseInitialized = false;

export const initializeFirebase = () => {
  if (firebaseInitialized) return;

  try {
    const privateKey = Buffer.from(
      ENV.FIREBASE_PRIVATE_KEY_IN_BASE_64,
      'base64'
    ).toString('utf-8');

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: ENV.FIREBASE_PROJECT_ID,
        clientEmail: ENV.FIREBASE_CLIENT_EMAIL,
        privateKey,
      }),
    });

    firebaseInitialized = true;
    console.log('✅ Firebase Admin initialized');
  } catch (error) {
    console.error('❌ Firebase initialization failed:', error);
    throw error;
  }
};

export const getFirebaseAuth = () => admin.auth();

export default admin;
