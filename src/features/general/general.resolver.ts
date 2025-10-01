import { combineResolvers } from 'graphql-resolvers';
import GeneralController from './general.controller';
import { protectEntities } from '../../utils/auth-middleware';
import { AccountType, AccountType_ } from '../../constants/general';

const generalResolvers = {
  AuthEntity: {
    __resolveType(obj: any) {
      if (obj.accountType === AccountType_.ADMIN) {
        return 'Admin';
      }
      if (obj.accountType === AccountType_.DRIVER) {
        return 'Driver';
      }
      if (obj.accountType === AccountType_.CUSTOMER) {
        return 'Customer';
      }
      return null;
    },
  },

  AccountEntity: {
    __resolveType(obj: any) {
      if (obj.accountType === AccountType_.ADMIN) {
        return 'Admin';
      }
      if (obj.accountType === AccountType_.DRIVER) {
        return 'Driver';
      }
      if (obj.accountType === AccountType_.CUSTOMER) {
        return 'Customer';
      }
      return null;
    },
  },

  Query: {
    getBankCodes: GeneralController.getBankCodes,
    getImageUploadUrl: GeneralController.getImageUploadUrl,
    getFileUploadUrl: combineResolvers(
      protectEntities(['ADMIN', 'DRIVER', 'CUSTOMER']),
      GeneralController.getFileUploadUrl
    ),
    getFileDownloadUrl: combineResolvers(
      protectEntities(['ADMIN', 'DRIVER', 'CUSTOMER']),
      GeneralController.getFileDownloadUrl
    ),
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

    googleLogin: GeneralController.googleLogin,
  },
};

export default generalResolvers;
