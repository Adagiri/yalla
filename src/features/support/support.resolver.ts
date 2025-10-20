import { combineResolvers } from 'graphql-resolvers';
import SupportController from './support.controller';
import { protectEntities } from '../../utils/auth-middleware';

const supportResolvers = {
  Query: {
    getMyTickets: combineResolvers(
      protectEntities(['CUSTOMER', 'DRIVER']),
      SupportController.getMyTickets
    ),
    getAllTickets: combineResolvers(
      protectEntities(['ADMIN']),
      SupportController.getAllTickets
    ),
    getTicket: combineResolvers(
      protectEntities(['CUSTOMER', 'DRIVER', 'ADMIN']),
      SupportController.getTicket
    ),
    getTicketStats: combineResolvers(
      protectEntities(['ADMIN']),
      SupportController.getTicketStats
    ),
  },

  Mutation: {
    createTicket: combineResolvers(
      protectEntities(['CUSTOMER', 'DRIVER']),
      SupportController.createTicket
    ),
    addMessage: combineResolvers(
      protectEntities(['CUSTOMER', 'DRIVER', 'ADMIN']),
      SupportController.addMessage
    ),
    updateTicket: combineResolvers(
      protectEntities(['ADMIN']),
      SupportController.updateTicket
    ),
  },
};

export default supportResolvers;
