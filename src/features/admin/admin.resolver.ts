import { combineResolvers } from 'graphql-resolvers';
import AdminController from './admin.controller';
import { protectAdmin } from '../../utils/auth-middleware';

const adminResolvers = {
  Query: {
    listEmailTemplates: combineResolvers(
      // protectAdmin,
      AdminController.listEmailTemplates
    ),
  },

  Mutation: {
    createEmailTemplate: combineResolvers(
      // protectAdmin,
      AdminController.createEmailTemplate
    ),
    updateEmailTemplate: combineResolvers(
      // protectAdmin,
      AdminController.updateEmailTemplate
    ),
    deleteEmailTemplate: combineResolvers(
      // protectAdmin,
      AdminController.deleteEmailTemplate
    ),
  },
};

export default adminResolvers;
