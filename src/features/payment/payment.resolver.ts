import { combineResolvers } from 'graphql-resolvers';
import PaymentController from './payment.controller';
import { protectEntities } from '../../utils/auth-middleware';
import {
  getRequestedFields,
  toMongooseSelect,
} from '../../utils/graphql-field-selection.util';
import { GraphQLResolveInfo } from 'graphql';

const paymentResolvers = {
  // ===== QUERIES =====
  Query: {
    // Wallet queries
    getMyWallet: combineResolvers(
      protectEntities(['DRIVER', 'CUSTOMER']),
      PaymentController.getMyWallet
    ),

    getWallet: combineResolvers(
      protectEntities(['ADMIN']),
      PaymentController.getWallet
    ),

    listPayments: combineResolvers(
      protectEntities(['ADMIN']),
      PaymentController.listPayments
    ),

    // Transaction queries
    getMyTransactions: combineResolvers(
      protectEntities(['DRIVER', 'CUSTOMER']),
      PaymentController.getMyTransactions
    ),

    getTransaction: combineResolvers(
      protectEntities(['DRIVER', 'CUSTOMER', 'ADMIN']),
      PaymentController.getTransaction
    ),

    getUserTransactions: combineResolvers(
      protectEntities(['ADMIN']),
      PaymentController.getUserTransactions
    ),

    // Analytics and utilities
    getPaymentAnalytics: combineResolvers(
      protectEntities(['ADMIN']),
      PaymentController.getPaymentAnalytics
    ),

    getBankCodes: PaymentController.getBankCodes,
  },

  // ===== MUTATIONS =====
  Mutation: {
    // Wallet operations
    topUpWallet: combineResolvers(
      protectEntities(['DRIVER', 'CUSTOMER']),
      PaymentController.topUpWallet
    ),

    // Payment operations
    processTripPayment: combineResolvers(
      protectEntities(['CUSTOMER', 'DRIVER']),
      PaymentController.processTripPayment
    ),

    driverCashout: combineResolvers(
      protectEntities(['DRIVER']),
      PaymentController.driverCashout
    ),

    refundTripPayment: combineResolvers(
      protectEntities(['ADMIN']),
      PaymentController.refundTripPayment
    ),

    // Admin operations
    creditUserWallet: combineResolvers(
      protectEntities(['ADMIN']),
      PaymentController.creditUserWallet
    ),

    debitUserWallet: combineResolvers(
      protectEntities(['ADMIN']),
      PaymentController.debitUserWallet
    ),
  },

  // ===== FIELD RESOLVERS =====
  Transaction: {
    trip: async (
      parent: any,
      _args: any,
      context: any,
      info: GraphQLResolveInfo
    ) => {
      if (parent.trip) {
        return parent.trip;
      }

      if (!parent.tripId) return null;

      const requestedFields = getRequestedFields(info);
      const selectString = toMongooseSelect(requestedFields);

      return context.loaders.trip.load({
        id: parent.tripId,
        fields: selectString,
      });
    },
  },

  Wallet: {
    // Format balance for display
    formattedBalance: (parent: any) => {
      const balance = (parent.balance || 0) / 100; // Balance is in kobo by default
      return `₦${balance.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
    },
  },
};

export default paymentResolvers;
