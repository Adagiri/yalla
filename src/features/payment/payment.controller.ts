import { ContextType } from '../../types';
import { Pagination } from '../../types/list-resources';
import { setPagePaginationHeaders } from '../../utils/pagination-headers.util';
import { ErrorResponse } from '../../utils/responses';
import WalletService from '../../services/wallet.service';
import PaymentService from './payment.service';
import PaystackService from '../../services/paystack.services';
import { CashoutInput, PaymentFilter, PaymentSort, ProcessTripPaymentInput, TopUpWalletInput, TransactionFilter, TransactionSort } from './payment.types';


class PaymentController {
  /**
   * List all payments (Admin only)
   */
  static async listPayments(
    _: any,
    {
      pagination,
      filter,
      sort,
    }: {
      pagination?: Pagination;
      filter?: PaymentFilter;
      sort?: PaymentSort;
    },
    { res }: ContextType
  ) {
    const { data, paginationResult } = await PaymentService.listPayments(
      pagination,
      filter,
      sort
    );

    setPagePaginationHeaders(res, paginationResult);
    return data;
  }

  // ===== WALLET OPERATIONS =====

  /**
   * Get current user's wallet
   */
  static async getMyWallet(_: any, __: any, { user }: ContextType) {
    try {
      return await WalletService.getUserWallet(user.id);
    } catch (error: any) {
      throw new ErrorResponse(500, 'Error fetching wallet', error.message);
    }
  }

  /**
   * Get wallet by user ID (admin only)
   */
  static async getWallet(_: any, { userId }: { userId: string }) {
    try {
      return await WalletService.getUserWallet(userId);
    } catch (error: any) {
      throw new ErrorResponse(500, 'Error fetching wallet', error.message);
    }
  }

  /**
   * Top up wallet
   */
  static async topUpWallet(
    _: any,
    { input }: { input: TopUpWalletInput },
    { user }: ContextType
  ) {
    try {
      // Validate amount
      if (input.amount < 100) {
        throw new ErrorResponse(400, 'Minimum top-up amount is ₦100');
      }

      if (input.amount > 500000) {
        throw new ErrorResponse(400, 'Maximum top-up amount is ₦500,000');
      }

      const result = await WalletService.topUpWallet({
        userId: user.id,
        amount: input.amount,
        paymentMethod: input.paymentMethod,
        saveCard: input.saveCard,
      });

      return {
        success: true,
        transaction: result.transaction,
        paystackData: result.paystackData,
      };
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error initiating wallet top-up',
        error.message
      );
    }
  }

  // ===== TRANSACTION OPERATIONS =====

  /**
   * Get current user's transactions
   */
  static async getMyTransactions(
    _: any,
    {
      page = 1,
      limit = 20,
      filter,
      sort,
    }: {
      page?: number;
      limit?: number;
      filter?: TransactionFilter;
      sort?: TransactionSort;
    },
    { user, res }: ContextType
  ) {
    try {
      const result = await WalletService.getTransactionHistory(
        user.id,
        { page, limit },
        filter
      );

      // Set pagination headers
      if (res) {
        setPagePaginationHeaders(res, {
          totalDocs: result.total,
          docsRetrieved: result.transactions.length,
          hasNextPage: result.page < result.totalPages,
          hasPreviousPage: result.page > 1,
          nextPage:
            result.page < result.totalPages ? result.page + 1 : undefined,
          previousPage: result.page > 1 ? result.page - 1 : undefined,
        });
      }

      return result.transactions;
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error fetching transactions',
        error.message
      );
    }
  }

  /**
   * Get user transactions (admin only)
   */
  static async getUserTransactions(
    _: any,
    {
      userId,
      page = 1,
      limit = 20,
      filter,
      sort,
    }: {
      userId: string;
      page?: number;
      limit?: number;
      filter?: TransactionFilter;
      sort?: TransactionSort;
    },
    { res }: ContextType
  ) {
    try {
      const result = await WalletService.getTransactionHistory(
        userId,
        { page, limit },
        filter
      );

      if (res) {
        setPagePaginationHeaders(res, {
          totalDocs: result.total,
          docsRetrieved: result.transactions.length,
          hasNextPage: result.page < result.totalPages,
          hasPreviousPage: result.page > 1,
          nextPage:
            result.page < result.totalPages ? result.page + 1 : undefined,
          previousPage: result.page > 1 ? result.page - 1 : undefined,
        });
      }

      return result.transactions;
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error fetching user transactions',
        error.message
      );
    }
  }

  /**
   * Get transaction by ID
   */
  static async getTransaction(_: any, { id }: { id: string }) {
    try {
      const Transaction = require('../../models/transaction.model').default;
      const transaction = await Transaction.findById(id).populate('tripId');

      if (!transaction) {
        throw new ErrorResponse(404, 'Transaction not found');
      }

      return transaction;
    } catch (error: any) {
      throw new ErrorResponse(500, 'Error fetching transaction', error.message);
    }
  }

  // ===== PAYMENT OPERATIONS =====

  /**
   * Process trip payment
   */
  static async processTripPayment(
    _: any,
    { input }: { input: ProcessTripPaymentInput },
    { user }: ContextType
  ) {
    try {
      // Get trip details to determine customer and driver
      const Trip = require('../../features/trip/trip.model').default;
      const trip = await Trip.findById(input.tripId).populate(
        'driverId customerId'
      );

      if (!trip) {
        throw new ErrorResponse(404, 'Trip not found');
      }

      // Verify user is the customer or driver of this trip
      if (trip.customerId._id !== user.id && trip.driverId?._id !== user.id) {
        throw new ErrorResponse(
          403,
          'Not authorized to process payment for this trip'
        );
      }

      const result = await PaymentService.processTripPayment({
        tripId: input.tripId,
        customerId: trip.customerId._id,
        driverId: trip.driverId._id,
        amount: trip.pricing.finalAmount,
        paymentMethod: input.paymentMethod,
        paymentToken: input.paymentToken,
      });

      return result;
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error processing trip payment',
        error.message
      );
    }
  }

  /**
   * Driver cashout
   */
  static async driverCashout(
    _: any,
    { input }: { input: CashoutInput },
    { user }: ContextType
  ) {
    try {
      // Verify user is a driver
      if (user.accountType !== 'DRIVER') {
        throw new ErrorResponse(403, 'Only drivers can request cashouts');
      }

      const result = await PaymentService.driverCashout({
        driverId: user.id,
        amount: input.amount,
        accountNumber: input.accountNumber,
        bankCode: input.bankCode,
      });

      return result;
    } catch (error: any) {
      throw new ErrorResponse(500, 'Error processing cashout', error.message);
    }
  }

  /**
   * Refund trip payment (admin only)
   */
  static async refundTripPayment(
    _: any,
    { tripId, reason }: { tripId: string; reason: string }
  ) {
    try {
      return await PaymentService.refundTripPayment(tripId, reason);
    } catch (error: any) {
      throw new ErrorResponse(500, 'Error processing refund', error.message);
    }
  }

  // ===== ADMIN OPERATIONS =====

  /**
   * Credit user wallet (admin only)
   */
  static async creditUserWallet(
    _: any,
    {
      userId,
      amount,
      description,
      purpose = 'bonus',
    }: {
      userId: string;
      amount: number;
      description: string;
      purpose?: string;
    }
  ) {
    try {
      const result = await WalletService.creditWallet({
        userId,
        amount,
        type: 'credit',
        purpose,
        description,
        paymentMethod: 'system',
      });

      return result.transaction;
    } catch (error: any) {
      throw new ErrorResponse(500, 'Error crediting wallet', error.message);
    }
  }

  /**
   * Debit user wallet (admin only)
   */
  static async debitUserWallet(
    _: any,
    {
      userId,
      amount,
      description,
      purpose = 'penalty',
    }: {
      userId: string;
      amount: number;
      description: string;
      purpose?: string;
    }
  ) {
    try {
      const result = await WalletService.debitWallet({
        userId,
        amount,
        type: 'debit',
        purpose,
        description,
        paymentMethod: 'system',
      });

      return result.transaction;
    } catch (error: any) {
      throw new ErrorResponse(500, 'Error debiting wallet', error.message);
    }
  }

  // ===== ANALYTICS =====

  /**
   * Get payment analytics (admin only)
   */
  static async getPaymentAnalytics(
    _: any,
    { dateFrom, dateTo }: { dateFrom?: Date; dateTo?: Date }
  ) {
    try {
      return await PaymentService.getPaymentAnalytics(dateFrom, dateTo);
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error fetching payment analytics',
        error.message
      );
    }
  }

  /**
   * Get bank codes
   */
  static async getBankCodes() {
    try {
      return await PaystackService.getBanks();
    } catch (error: any) {
      throw new ErrorResponse(500, 'Error fetching bank codes', error.message);
    }
  }
}

export default PaymentController;
