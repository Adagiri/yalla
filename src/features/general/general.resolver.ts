import { combineResolvers } from 'graphql-resolvers';
import GeneralController from './general.controller';
import { protectEntities } from '../../utils/auth-middleware';
import { AccountType } from '../../constants/general';

const generalResolvers = {
  AuthEntity: {
    __resolveType(obj: any) {
      if (obj.accountType === AccountType.ADMIN) {
        return 'Admin';
      }
      if (obj.accountType === AccountType.DRIVER) {
        return 'Driver';
      }
      if (obj.accountType === AccountType.CUSTOMER) {
        return 'Customer';
      }
      return null;
    },
  },

  AccountEntity: {
    __resolveType(obj: any) {
      if (obj.accountType === AccountType.ADMIN) {
        return 'Admin';
      }
      if (obj.accountType === AccountType.DRIVER) {
        return 'Driver';
      }
      if (obj.accountType === AccountType.CUSTOMER) {
        return 'Customer';
      }
      return null;
    },
  },

  Query: {
    getBankCodes: GeneralController.getBankCodes,
    getImageUploadUrl: GeneralController.getImageUploadUrl,
  },

  Mutation: {
    resendCode: GeneralController.resendCode,
    verifyCode: GeneralController.verifyCode,
    requestResetPassword: GeneralController.requestResetPassword,
    resetPassword: GeneralController.resetPassword,
    login: GeneralController.login,
    enableMfa: combineResolvers(
      protectEntities(['ADMIN', 'DRIVER', 'CUSTOMER']),
      GeneralController.enableMfa
    ),
    disableMfa: combineResolvers(
      protectEntities(['ADMIN', 'DRIVER', 'CUSTOMER']),
      GeneralController.disableMfa
    ),
  },
};

export default generalResolvers;
