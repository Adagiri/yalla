import { authenticated } from '../../middleware/auth-guards';
import CustomerService from '../customer/customer.service';
import DriverService from '../driver/driver.service';
import { AccountType_ } from '../../constants/general';

interface RegisterDeviceTokenInput {
  token: string;
}

export const deviceResolvers = {
  Mutation: {
    registerDeviceToken: authenticated(
      async (_: any, { input }: { input: RegisterDeviceTokenInput }, context: any) => {
        try {
          const { token } = input;
          const { userId, accountType } = context.user;

          // Update device token based on user type
          if (accountType === AccountType_.CUSTOMER) {
            await CustomerService.updateDeviceToken(userId, token, 'add');
          } else if (accountType === AccountType_.DRIVER) {
            await DriverService.updateDeviceToken(userId, token, 'add');
          } else {
            return {
              success: false,
              message: 'Invalid account type',
            };
          }

          return {
            success: true,
            message: 'Device token registered successfully',
          };
        } catch (error: any) {
          console.error('Error registering device token:', error);
          return {
            success: false,
            message: error.message || 'Failed to register device token',
          };
        }
      }
    ),

    removeDeviceToken: authenticated(
      async (_: any, { input }: { input: RegisterDeviceTokenInput }, context: any) => {
        try {
          const { token } = input;
          const { userId, accountType } = context.user;

          // Remove device token based on user type
          if (accountType === AccountType_.CUSTOMER) {
            await CustomerService.updateDeviceToken(userId, token, 'remove');
          } else if (accountType === AccountType_.DRIVER) {
            await DriverService.updateDeviceToken(userId, token, 'remove');
          } else {
            return {
              success: false,
              message: 'Invalid account type',
            };
          }

          return {
            success: true,
            message: 'Device token removed successfully',
          };
        } catch (error: any) {
          console.error('Error removing device token:', error);
          return {
            success: false,
            message: error.message || 'Failed to remove device token',
          };
        }
      }
    ),
  },
};
