
import { combineResolvers } from 'graphql-resolvers';
import PaymentModelController from './payment-model.controller';
import { protectEntities } from '../../utils/auth-middleware';
import PaymentModelService from './payment-model.services';

const paymentModelResolvers = {
  Query: {
    // Get payment model statistics (Admin only)
    getPaymentModelStats: combineResolvers(
      protectEntities(['ADMIN']),
      PaymentModelController.getPaymentModelStats
    ),

    // Check if driver can accept rides
    canDriverAcceptRides: combineResolvers(
      protectEntities(['ADMIN', 'DRIVER']),
      PaymentModelController.canDriverAcceptRides
    ),

    // Get driver's effective payment model for a trip amount
    getDriverPaymentModel: combineResolvers(
      protectEntities(['ADMIN', 'DRIVER']),
      PaymentModelController.getDriverPaymentModel
    ),

    // Get drivers by payment model (Admin only)
    getDriversByPaymentModel: combineResolvers(
      protectEntities(['ADMIN']),
      PaymentModelController.getDriversByPaymentModel
    ),
  },

  Mutation: {
    // Admin: Switch driver's payment model
    switchDriverPaymentModel: combineResolvers(
      protectEntities(['ADMIN']),
      PaymentModelController.switchDriverPaymentModel
    ),

    // Admin: Update driver's commission settings
    updateDriverCommissionSettings: combineResolvers(
      protectEntities(['ADMIN']),
      PaymentModelController.updateDriverCommissionSettings
    ),

    // Admin: Update driver's subscription settings
    updateDriverSubscriptionSettings: combineResolvers(
      protectEntities(['ADMIN']),
      PaymentModelController.updateDriverSubscriptionSettings
    ),

    // Driver: Request payment model change
    requestPaymentModelChange: combineResolvers(
      protectEntities(['DRIVER']),
      PaymentModelController.requestPaymentModelChange
    ),
  },

  // Field resolvers for Driver type
  Driver: {
    canAcceptRides: async (driver: any) => {
      return await PaymentModelService.canDriverAcceptRides(driver._id);
    },

    effectivePaymentModel: async (driver: any) => {
      try {
        // Use a default trip amount for calculation
        return await PaymentModelService.determinePaymentModel(driver._id, 1000); // ₦10
      } catch {
        return null;
      }
    },
  },

  // Field resolvers for Trip type
  Trip: {
    paymentModel: (trip: any) => trip.paymentModel || null,
    driverEarnings: (trip: any) => trip.driverEarnings || 0,
    platformCommission: (trip: any) => trip.platformCommission || 0,
    commissionRate: (trip: any) => trip.commissionRate || 0,
  },
};
