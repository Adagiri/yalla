import { combineResolvers } from 'graphql-resolvers';
import CustomerController from './customer.controller';
import { protectEntities } from '../../utils/auth-middleware';

const customerResolvers = {
  Query: {
    listCustomers: combineResolvers(
      protectEntities(['ADMIN']),
      CustomerController.listCustomers
    ),
    getCustomer: combineResolvers(
      protectEntities(['ADMIN']),
      CustomerController.getCustomer
    ),
    loggedInCustomer: combineResolvers(
      protectEntities(['DRIVER', 'ADMIN']),
      CustomerController.loggedInCustomer
    ),
  },
  Mutation: {
    registerCustomer: CustomerController.registerCustomer,
    updateCustomerPersonalInfo: combineResolvers(
      protectEntities(['DRIVER', 'ADMIN']),
      CustomerController.updateCustomerPersonalInfo
    ),

    updateCustomerProfilePhoto: combineResolvers(
      protectEntities(['DRIVER', 'ADMIN']),
      CustomerController.updateProfilePhoto
    ),
  },
};

export default customerResolvers;
