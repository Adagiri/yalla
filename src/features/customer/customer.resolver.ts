import { combineResolvers } from 'graphql-resolvers';
import CustomerController from './customer.controller';
import { protectEntities } from '../../utils/auth-middleware';
import { AccountType_ } from '../../constants/general';

const customerResolvers = {
  Query: {
    listCustomers: combineResolvers(
      protectEntities([AccountType_.ADMIN]),
      CustomerController.listCustomers
    ),
    getCustomer: combineResolvers(
      protectEntities([AccountType_.ADMIN]),
      CustomerController.getCustomer
    ),
    loggedInCustomer: combineResolvers(
      protectEntities([AccountType_.CUSTOMER, AccountType_.ADMIN]),
      CustomerController.loggedInCustomer
    ),
  },
  Mutation: {
    registerCustomer: CustomerController.registerCustomer,
    updateCustomerPersonalInfo: combineResolvers(
      protectEntities([AccountType_.CUSTOMER, AccountType_.ADMIN]),
      CustomerController.updateCustomerPersonalInfo
    ),

    updateCustomerProfilePhoto: combineResolvers(
      protectEntities([AccountType_.CUSTOMER, AccountType_.ADMIN]),
      CustomerController.updateProfilePhoto
    ),
  },
};

export default customerResolvers;
