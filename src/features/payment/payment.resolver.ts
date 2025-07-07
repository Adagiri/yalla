import { combineResolvers } from 'graphql-resolvers';
import PaymentController from './payment.controller';
import { protectEntities } from '../../utils/auth-middleware';

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
    trip: async (parent: any) => {
      if (!parent.tripId) return null;

      const Trip = require('../../features/trip/trip.model').default;
      return await Trip.findById(parent.tripId);
    },
  },

  Wallet: {
    // Format balance for display
    formattedBalance: (parent: any) => {
      const balance = parent.balance || 0;
      return `₦${balance.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
    },
  },
};

export default paymentResolvers;
