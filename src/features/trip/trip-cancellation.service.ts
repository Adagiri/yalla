import Trip from './trip.model';
import Driver from '../driver/driver.model';
import PaymentSystemConfigService from '../general/payment-system-config.service';
import PaymentService from '../payment/payment.service';
import NotificationService from '../../services/notification.services';
import { AccountType_ } from '../../constants/general';
import { ErrorResponse } from '../../utils/responses';
import mongoose from 'mongoose';
import WalletService from '../../services/wallet.service';

interface CancellationResult {
  trip: any;
  refund?: {
    amount: number;
    percentage: number;
    reason: string;
    transactionId?: string;
  };
  penalty?: {
    amount: number;
    appliedTo: 'customer' | 'driver';
  };
}

class TripCancellationService {
  /**
   * Cancel trip with automatic refund calculation
   */
  static async cancelTrip(
    tripId: string,
    cancelledBy: 'customer' | 'driver' | 'system',
    reason?: string,
    adminId?: string
  ): Promise<CancellationResult> {
    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      const trip = await Trip.findById(tripId).session(session);
      if (!trip) {
        throw new ErrorResponse(404, 'Trip not found');
      }

      // Check if trip can be cancelled
      if (trip.status === 'completed') {
        throw new ErrorResponse(400, 'Cannot cancel completed trip');
      }

      if (trip.status === 'cancelled') {
        throw new ErrorResponse(400, 'Trip is already cancelled');
      }

      // Calculate refund based on current status
      const refundCalculation =
        await PaymentSystemConfigService.calculateRefundAmount(
          tripId,
          trip.status,
          trip.pricing.finalAmount
        );

      // Update trip status
      trip.status = 'cancelled';
      trip.cancelledAt = new Date();
      trip.cancelledBy = cancelledBy;
      trip.cancellationReason = reason;

      // Add to timeline
      trip.timeline.push({
        event: 'trip_cancelled',
        timestamp: new Date(),
        metadata: {
          cancelledBy,
          reason,
          refundAmount: refundCalculation.refundAmount,
          refundPercentage: refundCalculation.refundPercentage,
        },
      });

      await trip.save({ session });

      // Process refund if applicable
      let refundResult;
      if (
        refundCalculation.refundAmount > 0 &&
        trip.paymentStatus === 'completed'
      ) {
        refundResult = await this.processRefund(
          trip,
          refundCalculation.refundAmount,
          refundCalculation.reason,
          session
        );
      }

      // Apply penalty if driver cancelled after accepting
      let penaltyResult;
      if (
        cancelledBy === 'driver' &&
        ['driver_assigned', 'driver_arrived'].includes(trip.status)
      ) {
        penaltyResult = await this.applyDriverCancellationPenalty(
          trip.driverId,
          trip.pricing.finalAmount,
          session
        );
      }

      // Update driver availability if assigned
      if (trip.driverId) {
        await Driver.findByIdAndUpdate(
          trip.driverId,
          {
            isAvailable: true,
            $unset: { currentTripId: 1 },
            $inc: {
              'stats.cancelledTrips': cancelledBy === 'driver' ? 1 : 0,
            },
          },
          { session }
        );
      }

      await session.commitTransaction();

      // Send notifications
      await this.sendCancellationNotifications(
        trip,
        cancelledBy,
        refundCalculation
      );

      return {
        trip,
        refund: refundResult
          ? {
              amount: refundCalculation.refundAmount,
              percentage: refundCalculation.refundPercentage,
              reason: refundCalculation.reason,
              transactionId: refundResult.transactionId,
            }
          : undefined,
        penalty: penaltyResult,
      };
    } catch (error: any) {
      await session.abortTransaction();
      throw new ErrorResponse(500, 'Error cancelling trip', error.message);
    } finally {
      session.endSession();
    }
  }

  /**
   * Process refund based on payment method
   */
  private static async processRefund(
    trip: any,
    refundAmount: number,
    reason: string,
    session: any
  ) {
    try {
      switch (trip.paymentMethod) {
        case 'wallet':
          // Credit customer wallet
          const walletRefund = await WalletService.creditWallet(
            {
              userId: trip.customerId,
              amount: refundAmount,
              type: 'credit',
              purpose: 'trip_refund',
              description: `Refund for cancelled trip ${trip.tripNumber}: ${reason}`,
              tripId: trip._id,
              paymentMethod: 'system',
            },
            session
          );

          // If driver was already credited, debit their wallet
          if (trip.driverId && trip.paymentStatus === 'completed') {
            await WalletService.debitWallet(
              {
                userId: trip.driverId,
                amount: refundAmount * 0.75, // Driver's share
                type: 'debit',
                purpose: 'trip_refund_reversal',
                description: `Refund reversal for cancelled trip ${trip.tripNumber}`,
                tripId: trip._id,
                paymentMethod: 'system',
              },
              session
            );
          }

          return { transactionId: walletRefund.transaction._id };

        case 'card':
          // Initiate Paystack refund
          // Note: This would need to be implemented in PaymentService
          throw new ErrorResponse(501, 'Card refunds not yet implemented');

        case 'cash':
          // No refund needed for cash payments
          return null;

        default:
          throw new ErrorResponse(400, 'Unknown payment method');
      }
    } catch (error: any) {
      throw new ErrorResponse(500, 'Error processing refund', error.message);
    }
  }

  /**
   * Apply penalty to driver for cancelling after accepting trip
   */
  private static async applyDriverCancellationPenalty(
    driverId: string,
    tripAmount: number,
    session: any
  ) {
    try {
      // Penalty: 10% of trip amount (configurable)
      const penaltyAmount = Math.round(tripAmount * 0.1);

      await WalletService.debitWallet(
        {
          userId: driverId,
          amount: penaltyAmount,
          type: 'debit',
          purpose: 'cancellation_penalty',
          description: 'Penalty for cancelling accepted trip',
          paymentMethod: 'system',
        },
        session
      );

      return {
        amount: penaltyAmount,
        appliedTo: 'driver' as const,
      };
    } catch (error: any) {
      console.error('Error applying driver penalty:', error);
      // Don't throw - penalty failure shouldn't block cancellation
      return undefined;
    }
  }

  /**
   * Send cancellation notifications to relevant parties
   */
  private static async sendCancellationNotifications(
    trip: any,
    cancelledBy: string,
    refundInfo: any
  ) {
    try {
      // Notify customer
      await NotificationService.sendNotification({
        userId: trip.customerId,
        userType: AccountType_.CUSTOMER,
        type: 'trip_cancelled',
        title: '🚫 Trip Cancelled',
        message: `Your trip has been cancelled. ${
          refundInfo.refundAmount > 0
            ? `A refund of ₦${refundInfo.refundAmount / 100} (${refundInfo.refundPercentage}%) has been processed.`
            : 'No refund applicable.'
        }`,
        data: {
          tripId: trip._id,
          tripNumber: trip.tripNumber,
          cancelledBy,
          refundAmount: refundInfo.refundAmount,
          refundPercentage: refundInfo.refundPercentage,
        },
        sendPush: true,
        sendEmail: true,
      });

      // Notify driver if assigned
      if (trip.driverId && cancelledBy !== 'driver') {
        await NotificationService.sendNotification({
          userId: trip.driverId,
          userType: AccountType_.DRIVER,
          type: 'trip_cancelled',
          title: '🚫 Trip Cancelled',
          message: `Trip ${trip.tripNumber} has been cancelled by ${cancelledBy}`,
          data: {
            tripId: trip._id,
            tripNumber: trip.tripNumber,
            cancelledBy,
          },
          sendPush: true,
        });
      }
    } catch (error) {
      console.error('Error sending cancellation notifications:', error);
      // Don't throw - notification failure shouldn't block cancellation
    }
  }

  /**
   * Get cancellation policy details
   */
  static async getCancellationPolicy() {
    try {
      const config = await PaymentSystemConfigService.getActiveConfig();

      return {
        refundEnabled: config.cancellationRefundEnabled,
        refundPolicy: {
          beforeDriverAssigned: {
            refundPercentage: config.refundTimeframes.beforeDriverAssigned,
            description: 'Full refund if cancelled before driver is assigned',
          },
          afterDriverAssigned: {
            refundPercentage: config.refundTimeframes.afterDriverAssigned,
            description: 'Partial refund if cancelled after driver accepts',
          },
          afterDriverArrived: {
            refundPercentage: config.refundTimeframes.afterDriverArrived,
            description: 'Reduced refund if cancelled after driver arrives',
          },
          afterTripStarted: {
            refundPercentage: config.refundTimeframes.afterTripStarted,
            description: 'No refund if cancelled after trip starts',
          },
        },
        driverPenalty: {
          enabled: true,
          amount: '10% of trip fare',
          description:
            'Drivers who cancel after accepting a trip will be charged a penalty',
        },
      };
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error fetching cancellation policy',
        error.message
      );
    }
  }
}

export default TripCancellationService;
