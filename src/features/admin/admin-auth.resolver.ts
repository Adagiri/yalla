import { combineResolvers } from 'graphql-resolvers';
import AdminAuthService from './admin-auth.service';
import { protectEntities } from '../../utils/auth-middleware';
import { ContextType } from '../../types';

const adminAuthResolvers = {
  Query: {
    getCurrentAdmin: combineResolvers(
      protectEntities(['ADMIN']),
      async (_: any, __: any, { user }: ContextType) => {
        return await AdminAuthService.getCurrentAdmin(user.id);
      }
    ),
  },

  Mutation: {
    adminLogin: async (_: any, { input }: { input: { email: string; password: string } }) => {
      const { email, password } = input;
      return await AdminAuthService.login(email, password);
    },

    adminLogout: combineResolvers(
      protectEntities(['ADMIN']),
      async (_: any, __: any, { user }: ContextType) => {
        return await AdminAuthService.logout(user.id);
      }
    ),

    requestAdminPasswordReset: async (_: any, { input }: { input: { email: string } }) => {
      return await AdminAuthService.requestPasswordReset(input.email);
    },

    verifyAdminResetCode: async (
      _: any, 
      { input }: { input: { email: string; code: string; token: string } }
    ) => {
      return await AdminAuthService.verifyResetCode(input.email, input.code, input.token);
    },

    resetAdminPassword: async (
      _: any, 
      { input }: { 
        input: { 
          email: string; 
          code: string; 
          token: string; 
          newPassword: string; 
        } 
      }
    ) => {
      return await AdminAuthService.resetPassword(input);
    },

    changeAdminPassword: combineResolvers(
      protectEntities(['ADMIN']),
      async (
        _: any, 
        { input }: { input: { currentPassword: string; newPassword: string } },
        { user }: ContextType
      ) => {
        return await AdminAuthService.changePassword(
          user.id, 
          input.currentPassword, 
          input.newPassword
        );
      }
    ),
  },
};

export default adminAuthResolvers;