import { combineResolvers } from 'graphql-resolvers';
import GeneralController from './general.controller';
import { protectEntities } from '../../utils/auth-middleware';
import { AccountType } from '../../constants/general';

const managerResolvers = {
  AuthEntity: {
    __resolveType(obj: any) {
      if (obj.accountType === AccountType.ADMIN) {
        return 'Admin';
      }

      if (obj.accountType === AccountType.DRIVER) {
        return 'Driver';
      }
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
    },
  },
  Query: {
    getBankCodes: GeneralController.getBankCodes,
  },
  Mutation: {
    resendCode: GeneralController.resendCode,
    verifyCode: GeneralController.verifyCode,
    requestResetPassword: GeneralController.requestResetPassword,
    resetPassword: GeneralController.resetPassword,

    login: GeneralController.login,

    enableMfa: combineResolvers(
      protectEntities(['MANAGER', 'USER', 'ADMIN']),
      GeneralController.enableMfa
    ),

    disableMfa: combineResolvers(
      protectEntities(['MANAGER', 'USER', 'ADMIN']),
      GeneralController.disableMfa
    ),
  },
};

export default managerResolvers;
