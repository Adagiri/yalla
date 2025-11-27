import { authTokenCache } from '../../services/auth-token-cache.service';
import DeviceTokenService from '../device/device.service';
import { ErrorResponse } from '../../utils/error-response';

interface LogoutInput {
  deviceToken?: string; // Optional: specific device to logout from
  allDevices?: boolean; // Optional: logout from all devices
}

class AuthService {
  /**
   * Logout user
   * - Invalidates auth token(s) from Redis cache
   * - Removes device token(s) for push notifications
   */
  static async logout(
    userId: string,
    accountType: string,
    currentAuthToken: string,
    input?: LogoutInput
  ): Promise<{ success: boolean; message: string }> {
    try {
      const { deviceToken, allDevices } = input || {};

      // 1. Handle Auth Token Invalidation
      if (allDevices) {
        // Logout from ALL devices - invalidate all auth tokens
        const count = await authTokenCache.invalidateAllUserTokens(userId);
        console.log(`Invalidated ${count} auth tokens for user ${userId}`);
      } else {
        // Logout from current device only - invalidate current auth token
        await authTokenCache.invalidateToken(currentAuthToken);
        console.log(`Invalidated auth token for user ${userId}`);
      }

      // 2. Handle Device Token Removal
      if (allDevices) {
        // Remove ALL device tokens (logout from all devices)
        await DeviceTokenService.removeAllDeviceTokens(userId, accountType);
        console.log(`Removed all device tokens for user ${userId}`);
      } else if (deviceToken) {
        // Remove specific device token (logout from this device)
        await DeviceTokenService.removeDeviceToken(
          userId,
          accountType,
          deviceToken
        );
        console.log(`Removed device token for user ${userId}`);
      }
      // If no deviceToken provided, only auth token is invalidated (still logged out)

      const message = allDevices
        ? 'Logged out from all devices successfully'
        : 'Logged out successfully';

      return {
        success: true,
        message,
      };
    } catch (error: any) {
      console.error('Logout error:', error);
      throw new ErrorResponse(500, 'Logout failed', error.message);
    }
  }
}

export default AuthService;
