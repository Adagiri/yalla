import { ErrorResponse } from '../../utils/responses';
import { PaymentModel } from '../../constants/payment-models';
import PaymentModelService from './payment-model.services';
import { ContextType } from '../../types';

interface SwitchPaymentModelInput {
  driverId: string;
  newModel: PaymentModel;
  reason?: string;
}

interface UpdateCommissionSettingsInput {
  driverId: string;
  customRate?: number;
  isActive?: boolean;
}

interface UpdateSubscriptionSettingsInput {
  driverId: string;
  requireActiveSubscription?: boolean;
  allowFallbackToCommission?: boolean;
}

class PaymentModelController {
  /**
   * Get payment model statistics (Admin only)
   */
  static async getPaymentModelStats() {
    try {
      return await PaymentModelService.getPaymentModelStats();
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error fetching payment model statistics',
        error.message
      );
    }
  }

  /**
   * Check if driver can accept rides
   */
  static async canDriverAcceptRides(
    _: any,
    { driverId }: { driverId?: string },
    { user }: ContextType
  ) {
    try {
      const targetDriverId = driverId || user.id;

      // Drivers can only check their own status, admins can check any driver
      if (user.accountType === 'DRIVER' && targetDriverId !== user.id) {
        throw new ErrorResponse(
          403,
          'Can only check your own ride acceptance status'
        );
      }

      return await PaymentModelService.canDriverAcceptRides(targetDriverId);
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error checking ride acceptance status',
        error.message
      );
    }
  }

  /**
   * Get driver's effective payment model for a trip amount
   */
  static async getDriverPaymentModel(
    _: any,
    { driverId, tripAmount }: { driverId?: string; tripAmount: number },
    { user }: ContextType
  ) {
    try {
      const targetDriverId = driverId || user.id;

      // Drivers can only check their own model, admins can check any driver
      if (user.accountType === 'DRIVER' && targetDriverId !== user.id) {
        throw new ErrorResponse(403, 'Can only check your own payment model');
      }

      return await PaymentModelService.determinePaymentModel(
        targetDriverId,
        tripAmount
      );
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error determining payment model',
        error.message
      );
    }
  }

  /**
   * Get drivers by payment model (Admin only)
   */
  static async getDriversByPaymentModel(
    _: any,
    {
      model,
      page = 1,
      limit = 20,
    }: { model: PaymentModel; page?: number; limit?: number }
  ) {
    try {
      const Driver = require('../driver/driver.model').default;
      const BaseController =
        require('../../controllers/base.controller').BaseController;

      return await BaseController.getPaginatedResults(
        Driver,
        { paymentModel: model },
        { page, limit, sortBy: 'createdAt', sortDirection: 'desc' }
      );
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error fetching drivers by payment model',
        error.message
      );
    }
  }

  /**
   * Switch driver's payment model (Admin only)
   */
  static async switchDriverPaymentModel(
    _: any,
    { input }: { input: SwitchPaymentModelInput },
    { user }: ContextType
  ) {
    try {
      return await PaymentModelService.switchDriverPaymentModel(
        input.driverId,
        input.newModel,
        user.id,
        input.reason
      );
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error switching payment model',
        error.message
      );
    }
  }

  /**
   * Update driver's commission settings (Admin only)
   */
  static async updateDriverCommissionSettings(
    _: any,
    { input }: { input: UpdateCommissionSettingsInput }
  ) {
    try {
      const Driver = require('../driver/driver.model').default;

      const updateData: any = {};
      if (input.customRate !== undefined) {
        updateData['commissionSettings.customRate'] = input.customRate;
      }
      if (input.isActive !== undefined) {
        updateData['commissionSettings.isActive'] = input.isActive;
      }

      const driver = await Driver.findByIdAndUpdate(
        input.driverId,
        updateData,
        { new: true }
      );

      if (!driver) {
        throw new ErrorResponse(404, 'Driver not found');
      }

      return driver;
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error updating commission settings',
        error.message
      );
    }
  }

  /**
   * Update driver's subscription settings (Admin only)
   */
  static async updateDriverSubscriptionSettings(
    _: any,
    { input }: { input: UpdateSubscriptionSettingsInput }
  ) {
    try {
      const Driver = require('../driver/driver.model').default;

      const updateData: any = {};
      if (input.requireActiveSubscription !== undefined) {
        updateData['subscriptionSettings.requireActiveSubscription'] =
          input.requireActiveSubscription;
      }
      if (input.allowFallbackToCommission !== undefined) {
        updateData['subscriptionSettings.allowFallbackToCommission'] =
          input.allowFallbackToCommission;
      }

      const driver = await Driver.findByIdAndUpdate(
        input.driverId,
        updateData,
        { new: true }
      );

      if (!driver) {
        throw new ErrorResponse(404, 'Driver not found');
      }

      return driver;
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error updating subscription settings',
        error.message
      );
    }
  }

  /**
   * Request payment model change (Driver only)
   */
  static async requestPaymentModelChange(
    _: any,
    { newModel, reason }: { newModel: PaymentModel; reason: string },
    { user }: ContextType
  ) {
    try {
      // Create an admin task/notification for manual review
      const Notification =
        require('../notification/notification.model').default;

      await Notification.create({
        userId: 'admin', // or specific admin user ID
        userType: 'admin',
        type: 'payment_model_change_request',
        title: 'Driver Payment Model Change Request',
        message: `Driver ${user.id} requests to change payment model to ${newModel}`,
        data: {
          driverId: user.id,
          requestedModel: newModel,
          reason,
          status: 'pending',
          requestedAt: new Date(),
        },
      });

      return true;
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error requesting payment model change',
        error.message
      );
    }
  }
}

export default PaymentModelController;
