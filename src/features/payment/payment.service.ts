import mongoose, { ClientSession } from 'mongoose';
import Trip, { TripDocument } from '../trip/trip.model';
import WalletService from '../../services/wallet.service';
import PaystackService from '../../services/paystack.services';
import { ErrorResponse } from '../../utils/responses';
import Driver from '../driver/driver.model';
import Customer from '../customer/customer.model';
import { Pagination } from '../../types/list-resources';
import {
  CardPaymentInput,
  CashoutInput,
  PaymentFilter,
  PaymentSort,
  ProcessTripPaymentInput,
  SuccessfulCardPaymentResult,
} from './payment.types';
import Transaction from '../transaction/transaction.model';
import { listResourcesPagination } from '../../helpers/list-resources-pagination.helper';
import NotificationService from '../../services/notification.services';
import { AccountType_ } from '../../constants/general';
import TransactionMetadataService from '../../services/transaction-metadata.service';

class PaymentService {
  /**
   * Process trip payment based on payment method
   */
  static async processTripPayment(input: ProcessTripPaymentInput) {
    try {
      const trip = await Trip.findById(input.tripId);
      if (!trip) {
        throw new ErrorResponse(404, 'Trip not found');
      }

      if (trip.paymentStatus === 'completed') {
        throw new ErrorResponse(400, 'Trip payment already completed');
      }

      switch (input.paymentMethod) {
        case 'wallet':
          return await this.processWalletPayment(input);

        case 'card':
          return await this.processCardPayment(input);

        case 'cash':
          return await this.processCashPayment(input);

        default:
          throw new ErrorResponse(400, 'Invalid payment method');
      }
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error processing trip payment',
        error.message
      );
    }
  }

  /**
   * Process wallet payment for trip
   */
  private static async processWalletPayment(input: ProcessTripPaymentInput) {
    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      // Calculate platform commission (25%)
      const platformCommission = Math.round(input.amount * 0.25);
      const driverEarnings = input.amount - platformCommission;

      // Transfer from customer wallet to driver wallet
      const transferResult = await WalletService.transferBetweenWallets({
        fromUserId: input.customerId,
        toUserId: input.driverId,
        amount: driverEarnings,
        description: `Payment for trip ${input.tripId}`,
        tripId: input.tripId,
      });

      // Deduct platform commission from customer
      await WalletService.debitWallet({
        userId: input.customerId,
        amount: platformCommission,
        type: 'debit',
        purpose: 'commission_deduction',
        description: `Platform commission for trip ${input.tripId}`,
        tripId: input.tripId,
        paymentMethod: 'wallet',
      });

      // Update trip payment status
      const trip = await Trip.findByIdAndUpdate(
        input.tripId,
        {
          paymentStatus: 'completed',
          $push: {
            timeline: {
              event: 'payment_completed',
              timestamp: new Date(),
              metadata: { method: 'wallet' },
            },
          },
        },
        { new: true, session }
      );

      await session.commitTransaction();

      return {
        success: true,
        paymentMethod: 'wallet',
        trip,
        transactions: {
          customerDebit: transferResult.debitTransaction,
          driverCredit: transferResult.creditTransaction,
        },
        amounts: {
          total: input.amount,
          driverEarnings,
          platformCommission,
        },
      };
    } catch (error: any) {
      await session.abortTransaction();
      throw new ErrorResponse(
        500,
        'Error processing wallet payment',
        error.message
      );
    } finally {
      session.endSession();
    }
  }

  /**
   * Process card payment for trip
   */
  private static async processCardPayment(input: CardPaymentInput) {
    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      const trip = await Trip.findById(input.tripId).populate('customerId');
      if (!trip) {
        throw new ErrorResponse(404, 'Trip not found');
      }

      const customer = await Customer.findById(trip.customerId).select(
        'firstname lastname phone email'
      );

      if (!customer) {
        throw new ErrorResponse(400, 'Customer not found');
      }

      // Initialize Paystack transaction
      const paystackResponse = await PaystackService.initializeTransaction({
        email: customer.email,
        amount: input.amount,
        metadata: {
          tripId: input.tripId,
          customerId: input.customerId,
          purpose: 'trip_payment',
          saveCard: input.saveCard || false,
        },
        channels: ['card'],
        reference: `TRIP_${input.tripId}_${Date.now()}`,
      });

      // Update trip with payment reference
      await Trip.findByIdAndUpdate(
        input.tripId,
        {
          paymentReference: paystackResponse.reference,
          $push: {
            timeline: {
              event: 'payment_initiated',
              timestamp: new Date(),
              metadata: {
                method: 'card',
                reference: paystackResponse.reference,
              },
            },
          },
        },
        { session }
      );

      await session.commitTransaction();

      return {
        success: true,
        paymentMethod: 'card',
        paystackData: {
          authorization_url: paystackResponse.authorization_url,
          access_code: paystackResponse.access_code,
          reference: paystackResponse.reference,
        },
      };
    } catch (error: any) {
      await session.abortTransaction();
      throw new ErrorResponse(
        500,
        'Error processing card payment',
        error.message
      );
    } finally {
      session.endSession();
    }
  }

  /**
   * Process cash payment for trip
   */
  private static async processCashPayment(input: ProcessTripPaymentInput) {
    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      // Calculate platform commission (25%)
      const platformCommission = Math.round(input.amount * 0.25);
      const driverEarnings = input.amount - platformCommission;

      // Credit driver wallet with earnings
      await WalletService.creditWallet({
        userId: input.driverId,
        amount: driverEarnings,
        type: 'credit',
        purpose: 'driver_earnings',
        description: `Cash payment earnings for trip ${input.tripId}`,
        tripId: input.tripId,
        paymentMethod: 'cash',
      });

      // Update trip payment status
      const trip = await Trip.findByIdAndUpdate(
        input.tripId,
        {
          paymentStatus: 'completed',
          $push: {
            timeline: {
              event: 'payment_completed',
              timestamp: new Date(),
              metadata: { method: 'cash' },
            },
          },
        },
        { new: true, session }
      );

      await session.commitTransaction();

      return {
        success: true,
        paymentMethod: 'cash',
        trip,
        amounts: {
          total: input.amount,
          driverEarnings,
          platformCommission,
        },
        note: 'Driver received cash payment. Platform commission will be deducted from future earnings.',
      };
    } catch (error: any) {
      await session.abortTransaction();
      throw new ErrorResponse(
        500,
        'Error processing cash payment',
        error.message
      );
    } finally {
      session.endSession();
    }
  }

  /**
   * List payments/transactions with pagination
   */
  static async listPayments(
    pagination?: Pagination,
    filter?: PaymentFilter,
    sort?: PaymentSort
  ) {
    try {
      const baseFilter = {}; // No base filter needed

      const data = await listResourcesPagination({
        model: Transaction,
        baseFilter,
        additionalFilter: filter,
        sortParam: sort,
        pagination,
      });

      return data;
    } catch (error: any) {
      throw new ErrorResponse(500, 'Error fetching payments', error.message);
    }
  }

  /**
   * Process successful card payment from webhook
   */
  static async processSuccessfulCardPayment(
    paystackData: any
  ): Promise<SuccessfulCardPaymentResult> {
    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      const { reference, amount, metadata } = paystackData;

      if (metadata.purpose === 'trip_payment') {
        // Handle trip payment
        const trip = await Trip.findById(metadata.tripId).populate('driverId');
        if (!trip) {
          throw new ErrorResponse(404, 'Trip not found');
        }

        const amountInNaira = amount / 100; // Convert from kobo to naira
        const platformCommission = Math.round(amountInNaira * 0.25);
        const driverEarnings = amountInNaira - platformCommission;

        const driver = await Driver.findById(trip.driverId).select(
          'firstname lastname phone'
        );

        if (!driver) {
          throw new ErrorResponse(400, 'Customer not found');
        }
        // Credit driver wallet
        await WalletService.creditWallet({
          userId: driver._id,
          amount: driverEarnings,
          type: 'credit',
          purpose: 'driver_earnings',
          description: `Card payment earnings for trip ${trip.tripNumber}`,
          tripId: metadata.tripId,
          paymentMethod: 'card',
          metadata: {
            paystackReference: reference,
            platformCommission,
            totalAmount: amountInNaira,
          },
        });

        // Update trip
        const updatedTrip = await Trip.findByIdAndUpdate(
          trip._id,
          {
            paymentStatus: 'completed',
            $push: {
              timeline: {
                event: 'payment_completed',
                timestamp: new Date(),
                metadata: {
                  method: 'card',
                  reference,
                  amount: amountInNaira,
                },
              },
            },
          },
          { new: true, session }
        );

        await session.commitTransaction();

        return {
          success: true,
          trip: updatedTrip,
          amounts: {
            total: amountInNaira,
            driverEarnings,
            platformCommission,
          },
        };
      }

      throw new ErrorResponse(400, 'Unknown payment purpose');
    } catch (error: any) {
      await session.abortTransaction();
      throw new ErrorResponse(
        500,
        'Error processing successful payment',
        error.message
      );
    } finally {
      session.endSession();
    }
  }

  /**
   * Driver cashout to bank account
   */
  static async driverCashout(input: CashoutInput, session?: ClientSession) {
    const useSession = session || (await mongoose.startSession());
    const createdSession = !session;

    try {
      if (createdSession) {
        useSession.startTransaction();
      }

      // Get driver wallet
      const wallet = await WalletService.getUserWallet(input.driverId);
      const amountInKobo = Math.round(input.amount * 100);

      // Check minimum cashout amount (₦500)
      if (input.amount < 500) {
        throw new ErrorResponse(400, 'Minimum cashout amount is ₦500');
      }

      const driver = await Driver.findById(input.driverId).select(
        'firstname lastname commissionOwed cashCollected'
      );

      if (!driver) {
        throw new ErrorResponse(404, 'Driver not found');
      }

      const commissionOwed = driver.commissionOwed || 0;

      // Calculate available balance (after pending commission)
      const availableBalance = wallet.balance - commissionOwed;

      if (availableBalance < amountInKobo) {
        const message =
          commissionOwed > 0
            ? `Insufficient balance. Available: ₦${availableBalance / 100} (₦${commissionOwed / 100} reserved for commission settlement)`
            : `Insufficient balance. Available: ₦${availableBalance / 100}`;
        throw new ErrorResponse(400, message);
      }

      // Verify bank account
      const accountDetails = await PaystackService.getAccountDetail(
        input.accountNumber,
        input.bankCode
      );

      const enhancedMetadata =
        await TransactionMetadataService.generateCashoutMetadata({
          recipientAccountNumber: input.accountNumber,
          recipientBankCode: input.bankCode,
          amount: input.amount,
        });

      const recipient = await PaystackService.createTransferRecipient(
        accountDetails.account_name,
        input.accountNumber,
        input.bankCode,
        { driverId: input.driverId }
      );

      // Generate transfer reference
      const transferReference = `CASHOUT_${input.driverId}_${Date.now()}`;

      // Initiate transfer to Paystack
      const transfer = await PaystackService.initiateTransfer(
        input.amount,
        recipient.recipient_code,
        `Cashout for ${driver.firstname} ${driver.lastname}`,
        transferReference
      );

      enhancedMetadata.transferReference = transferReference;
      enhancedMetadata.transferCode = transfer.transfer_code;

      // Debit wallet with session (pass session!)
      const walletResult = await WalletService.debitWallet(
        {
          userId: input.driverId,
          amount: input.amount,
          type: 'debit',
          purpose: 'cashout',
          description: `Cashout to ${accountDetails.account_name} - ${input.accountNumber}`,
          paymentMethod: 'bank_transfer',
          metadata: enhancedMetadata,
        },
        useSession
      );

      if (createdSession) {
        await useSession.commitTransaction();
      }

      // Send notification
      await NotificationService.sendNotification({
        userId: input.driverId,
        userType: AccountType_.DRIVER,
        type: 'cashout_initiated',
        title: '💸 Cashout Initiated',
        message: `Cashout of ₦${input.amount} initiated to ${accountDetails.account_name}. Funds will arrive shortly.`,
        data: {
          amount: input.amount,
          accountName: accountDetails.account_name,
          accountNumber: input.accountNumber,
          transferReference,
        },
        sendPush: true,
      });

      return {
        success: true,
        transferReference,
        transferCode: transfer.transfer_code,
        accountDetails,
        transaction: walletResult.transaction,
        remainingBalance: walletResult.wallet.balance / 100,
        message: 'Cashout initiated successfully',
      };
    } catch (error: any) {
      if (createdSession) {
        await useSession.abortTransaction();
      }
      throw new ErrorResponse(500, 'Error processing cashout', error.message);
    } finally {
      if (createdSession) {
        useSession.endSession();
      }
    }
  }

  /**
   * Refund trip payment
   */
  static async refundTripPayment(
    tripId: string,
    reason: string,
    session?: ClientSession
  ) {
    const useSession = session || (await mongoose.startSession());
    const createdSession = !session;

    try {
      if (createdSession) {
        useSession.startTransaction();
      }

      const trip = await Trip.findById(tripId);
      if (!trip) {
        throw new ErrorResponse(404, 'Trip not found');
      }

      if (trip.paymentStatus !== 'completed') {
        throw new ErrorResponse(400, 'Cannot refund incomplete payment');
      }

      // Credit customer wallet with refund (pass session!)
      await WalletService.creditWallet(
        {
          userId: trip.customerId,
          amount: trip.pricing.finalAmount,
          type: 'credit',
          purpose: 'trip_refund',
          description: `Refund for trip ${trip.tripNumber}: ${reason}`,
          tripId: tripId,
          paymentMethod: 'system',
        },
        useSession
      );

      // Update trip status
      const updatedTrip = await Trip.findByIdAndUpdate(
        tripId,
        {
          paymentStatus: 'refunded',
          $push: {
            timeline: {
              event: 'payment_refunded',
              timestamp: new Date(),
              metadata: { reason },
            },
          },
        },
        { new: true, session: useSession }
      );

      if (createdSession) {
        await useSession.commitTransaction();
      }

      return {
        success: true,
        trip: updatedTrip,
        refundAmount: trip.pricing.finalAmount,
        reason,
      };
    } catch (error: any) {
      if (createdSession) {
        await useSession.abortTransaction();
      }
      throw new ErrorResponse(500, 'Error processing refund', error.message);
    } finally {
      if (createdSession) {
        useSession.endSession();
      }
    }
  }

  /**
   * Get payment analytics for admin
   */
  static async getPaymentAnalytics(dateFrom?: Date, dateTo?: Date) {
    try {
      const matchFilter: any = { status: 'completed' };

      if (dateFrom || dateTo) {
        matchFilter.completedAt = {};
        if (dateFrom) matchFilter.completedAt.$gte = dateFrom;
        if (dateTo) matchFilter.completedAt.$lte = dateTo;
      }

      const analytics = await mongoose.model('Transaction').aggregate([
        { $match: matchFilter },
        {
          $group: {
            _id: null,
            totalVolume: { $sum: '$amount' },
            totalTransactions: { $sum: 1 },
            walletTopUps: {
              $sum: {
                $cond: [{ $eq: ['$purpose', 'wallet_topup'] }, '$amount', 0],
              },
            },
            tripPayments: {
              $sum: {
                $cond: [{ $eq: ['$purpose', 'trip_payment'] }, '$amount', 0],
              },
            },
            driverEarnings: {
              $sum: {
                $cond: [{ $eq: ['$purpose', 'driver_earnings'] }, '$amount', 0],
              },
            },
            commissions: {
              $sum: {
                $cond: [
                  { $eq: ['$purpose', 'commission_deduction'] },
                  '$amount',
                  0,
                ],
              },
            },
            cashouts: {
              $sum: {
                $cond: [{ $eq: ['$purpose', 'cashout'] }, '$amount', 0],
              },
            },
          },
        },
      ]);

      const result = analytics[0] || {
        totalVolume: 0,
        totalTransactions: 0,
        walletTopUps: 0,
        tripPayments: 0,
        driverEarnings: 0,
        commissions: 0,
        cashouts: 0,
      };

      // Convert amounts from kobo to naira
      Object.keys(result).forEach((key) => {
        if (key !== 'totalTransactions' && key !== '_id') {
          result[key] = result[key] / 100;
        }
      });

      return result;
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error fetching payment analytics',
        error.message
      );
    }
  }
}

export default PaymentService;
