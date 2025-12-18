import { authenticated } from '../../middleware/auth-guards';
import DeviceTokenController from './device.controller';

interface RegisterDeviceTokenInput {
  token: string;
}

export const deviceResolvers = {
  Mutation: {
    registerDeviceToken: authenticated(
      async (_: any, { input }: { input: RegisterDeviceTokenInput }, context: any) => {
        const { userId, accountType } = context.user;
        return await DeviceTokenController.registerDeviceToken(
          userId,
          accountType,
          input
        );
      }
    ),

    removeDeviceToken: authenticated(
      async (_: any, { input }: { input: RegisterDeviceTokenInput }, context: any) => {
        const { userId, accountType } = context.user;
        return await DeviceTokenController.removeDeviceToken(
          userId,
          accountType,
          input
        );
      }
    ),
  },
};
