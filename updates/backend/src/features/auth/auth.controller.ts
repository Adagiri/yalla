import AuthService from './auth.service';
import { ErrorResponse } from '../../utils/error-response';

interface LogoutInput {
  deviceToken?: string;
  allDevices?: boolean;
}

class AuthController {
  /**
   * Logout user
   */
  static async logout(
    userId: string,
    accountType: string,
    authToken: string,
    input?: LogoutInput
  ) {
    try {
      return await AuthService.logout(userId, accountType, authToken, input);
    } catch (error: any) {
      throw new ErrorResponse(
        error.statusCode || 500,
        'Logout failed',
        error.message
      );
    }
  }
}

export default AuthController;
