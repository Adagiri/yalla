import DeviceTokenService from './device.service';
import { ErrorResponse } from '../../utils/error-response';

interface DeviceTokenInput {
  token: string;
}

class DeviceTokenController {
  /**
   * Register device token
   */
  static async registerDeviceToken(
    userId: string,
    accountType: string,
    input: DeviceTokenInput
  ) {
    try {
      return await DeviceTokenService.registerDeviceToken(
        userId,
        accountType,
        input.token
      );
    } catch (error: any) {
      throw new ErrorResponse(
        error.statusCode || 500,
        'Failed to register device token',
        error.message
      );
    }
  }

  /**
   * Remove device token
   */
  static async removeDeviceToken(
    userId: string,
    accountType: string,
    input: DeviceTokenInput
  ) {
    try {
      return await DeviceTokenService.removeDeviceToken(
        userId,
        accountType,
        input.token
      );
    } catch (error: any) {
      throw new ErrorResponse(
        error.statusCode || 500,
        'Failed to remove device token',
        error.message
      );
    }
  }
}

export default DeviceTokenController;
