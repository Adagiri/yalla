import { combineResolvers } from 'graphql-resolvers';
import MerchantController from './merchant.controller';
import { protectEntities } from '../../utils/auth-middleware';

const merchantResolvers = {
  Query: {
    listMerchants: combineResolvers(
      protectEntities(['ADMIN']),
      MerchantController.listMerchants
    ),
    getMerchant: combineResolvers(
      protectEntities(['ADMIN']),
      MerchantController.getMerchant
    ),
    loggedInMerchant: combineResolvers(
      protectEntities(['DRIVER', 'ADMIN']),
      MerchantController.loggedInMerchant
    ),
  },
  Mutation: {
    registerMerchant: MerchantController.registerMerchant,
    updatePersonalInfo: combineResolvers(
      protectEntities(['DRIVER', 'ADMIN']),
      MerchantController.updatePersonalInfo
    ),

    updateProfilePhoto: combineResolvers(
      protectEntities(['DRIVER', 'ADMIN']),
      MerchantController.updateProfilePhoto
    ),
  },
};

export default merchantResolvers;
