import { getFirebaseAuth } from './firebase-admin.service';
import { ErrorResponse } from '../utils/responses';

class FirebaseAuthService {
  static async verifyFirebaseToken(idToken: string) {
    try {
      const decodedToken = await getFirebaseAuth().verifyIdToken(idToken);

      if (!decodedToken.email || !decodedToken.email_verified) {
        throw new ErrorResponse(400, 'Email not verified with Firebase');
      }

      return {
        email: decodedToken.email,
        firstName: decodedToken.name?.split(' ')[0] || '',
        lastName: decodedToken.name?.split(' ').slice(1).join(' ') || '',
        profilePhoto: decodedToken.picture,
        firebaseUid: decodedToken.uid,
      };
    } catch (error: any) {
      if (error.code === 'auth/id-token-expired') {
        throw new ErrorResponse(401, 'Firebase token expired');
      }
      if (error.code === 'auth/argument-error') {
        throw new ErrorResponse(401, 'Invalid Firebase token');
      }
      throw new ErrorResponse(
        401,
        'Firebase authentication failed',
        error.message
      );
    }
  }
}

export default FirebaseAuthService;
