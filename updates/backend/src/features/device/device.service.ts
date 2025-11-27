import CustomerService from '../customer/customer.service';
import DriverService from '../driver/driver.service';
import { AccountType_ } from '../../constants/general';
import { ErrorResponse } from '../../utils/error-response';

interface DeviceTokenInput {
  token: string;
}

class DeviceTokenService {
  /**
   * Register a device token for push notifications
   */
  static async registerDeviceToken(
    userId: string,
    accountType: string,
    token: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      if (accountType === AccountType_.CUSTOMER) {
        await CustomerService.updateDeviceToken(userId, token, 'add');
      } else if (accountType === AccountType_.DRIVER) {
        await DriverService.updateDeviceToken(userId, token, 'add');
      } else {
        throw new ErrorResponse(400, 'Invalid account type');
      }

      return {
        success: true,
        message: 'Device token registered successfully',
      };
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Failed to register device token',
        error.message
      );
    }
  }

  /**
   * Remove a device token (e.g., on logout)
   */
  static async removeDeviceToken(
    userId: string,
    accountType: string,
    token: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      if (accountType === AccountType_.CUSTOMER) {
        await CustomerService.updateDeviceToken(userId, token, 'remove');
      } else if (accountType === AccountType_.DRIVER) {
        await DriverService.updateDeviceToken(userId, token, 'remove');
      } else {
        throw new ErrorResponse(400, 'Invalid account type');
      }

      return {
        success: true,
        message: 'Device token removed successfully',
      };
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Failed to remove device token',
        error.message
      );
    }
  }

  /**
   * Remove all device tokens for a user (e.g., on account deletion)
   */
  static async removeAllDeviceTokens(
    userId: string,
    accountType: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      if (accountType === AccountType_.CUSTOMER) {
        const customer = await CustomerService.updateDeviceToken(
          userId,
          '',
          'remove'
        );
        // Clear all tokens
        customer.deviceTokens = [];
        await customer.save();
      } else if (accountType === AccountType_.DRIVER) {
        const driver = await DriverService.updateDeviceToken(userId, '', 'remove');
        // Clear all tokens
        driver.deviceTokens = [];
        await driver.save();
      } else {
        throw new ErrorResponse(400, 'Invalid account type');
      }

      return {
        success: true,
        message: 'All device tokens removed successfully',
      };
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Failed to remove device tokens',
        error.message
      );
    }
  }
}

export default DeviceTokenService;
