import { authenticated } from '../../middleware/auth-guards';
import AuthController from './auth.controller';

interface LogoutInput {
  deviceToken?: string;
  allDevices?: boolean;
}

export const authResolvers = {
  Mutation: {
    logout: authenticated(
      async (_: any, { input }: { input?: LogoutInput }, context: any) => {
        const { userId, accountType } = context.user;
        const authToken = context.token; // Get token from context

        return await AuthController.logout(
          userId,
          accountType,
          authToken,
          input
        );
      }
    ),
  },
};
