// src/features/transaction/transaction-history.controller.ts

import { ErrorResponse } from '../../utils/responses';
import Transaction from './transaction.model';
import Wallet from '../../models/wallet.model';
import { ContextType } from '../../types';
import { setPagePaginationHeaders } from '../../utils/pagination-headers.util';

interface EarningsPeriod {
  startDate: Date;
  endDate: Date;
  label: string;
}

class TransactionHistoryController {
  /**
   * Get earnings summary for driver with period filtering
   */
  static async getMyEarnings(
    _: any,
    {
      period,
      customRange,
      page = 1,
      limit = 20,
    }: {
      period: string;
      customRange?: { startDate: Date; endDate: Date };
      page?: number;
      limit?: number;
    },
    { user, res }: ContextType
  ) {
    try {
      const periodDates = TransactionHistoryController.calculatePeriodDates(
        period,
        customRange
      );
      // Query earnings transactions
      const query: any = {
        userId: user.id,
        purpose: 'driver_earnings',
        status: 'completed',
        createdAt: {
          $gte: periodDates.startDate,
          $lte: periodDates.endDate,
        },
      };

      const transactions = await Transaction.find(query)
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip((page - 1) * limit)
        // .populate('tripId', 'tripNumber pickup destination fare createdAt');

      const total = await Transaction.countDocuments(query);

      // Calculate summary
      const totalEarnings = transactions.reduce(
        (sum, txn) => sum + (txn.amount || 0),
        0
      );

      // Get unique trip count
      const tripIds = new Set(
        transactions.map((txn) => txn.tripId).filter(Boolean)
      );

      if (res) {
        setPagePaginationHeaders(res, {
          totalDocs: total,
          docsRetrieved: transactions.length,
          hasNextPage: page < Math.ceil(total / limit),
          hasPreviousPage: page > 1,
          nextPage: page < Math.ceil(total / limit) ? page + 1 : undefined,
          previousPage: page > 1 ? page - 1 : undefined,
        });
      }

      return {
        totalEarnings: totalEarnings / 100, // Convert from kobo to naira
        tripCount: tripIds.size,
        period: periodDates.label,
        periodStart: periodDates.startDate,
        periodEnd: periodDates.endDate,
        transactions,
      };
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error fetching earnings summary',
        error.message
      );
    }
  }

  /**
   * Get payout history for driver
   */
  static async getMyPayouts(
    _: any,
    {
      page = 1,
      limit = 20,
      status,
      dateFrom,
      dateTo,
    }: {
      page?: number;
      limit?: number;
      status?: string;
      dateFrom?: Date;
      dateTo?: Date;
    },
    { user, res }: ContextType
  ) {
    try {
      const query: any = {
        userId: user.id,
        purpose: 'cashout',
      };

      if (status) {
        query.status = status;
      }

      // Add date filters
      if (dateFrom || dateTo) {
        query.createdAt = {};
        if (dateFrom) {
          query.createdAt.$gte = new Date(dateFrom);
        }
        if (dateTo) {
          query.createdAt.$lte = new Date(dateTo);
        }
      }

      const transactions = await Transaction.find(query)
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip((page - 1) * limit);

      const total = await Transaction.countDocuments(query);

      // Calculate summary stats (use same query for consistency)
      const allPayouts = await Transaction.find({
        userId: user.id,
        purpose: 'cashout',
        ...(dateFrom || dateTo ? { createdAt: query.createdAt } : {}),
      });

      const totalPayouts = allPayouts.reduce(
        (sum, txn) => sum + (txn.amount || 0),
        0
      );
      const successfulPayouts = allPayouts.filter(
        (txn) => txn.status === 'completed'
      ).length;
      const pendingPayouts = allPayouts.filter(
        (txn) => txn.status === 'pending'
      ).length;
      const failedPayouts = allPayouts.filter(
        (txn) => txn.status === 'failed'
      ).length;

      if (res) {
        setPagePaginationHeaders(res, {
          totalDocs: total,
          docsRetrieved: transactions.length,
          hasNextPage: page < Math.ceil(total / limit),
          hasPreviousPage: page > 1,
          nextPage: page < Math.ceil(total / limit) ? page + 1 : undefined,
          previousPage: page > 1 ? page - 1 : undefined,
        });
      }

      return {
        totalPayouts: totalPayouts / 100,
        successfulPayouts,
        pendingPayouts,
        failedPayouts,
        transactions,
      };
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error fetching payout history',
        error.message
      );
    }
  }

  /**
   * Get wallet summary with recent transactions
   */
  static async getMyWalletSummary(
    _: any,
    { limit = 10 }: { limit?: number },
    { user }: ContextType
  ) {
    try {
      const wallet = await Wallet.findOne({ userId: user.id });

      if (!wallet) {
        throw new ErrorResponse(404, 'Wallet not found');
      }

      // Get recent wallet transactions
      const recentTransactions = await Transaction.find({
        userId: user.id,
        purpose: {
          $in: ['wallet_topup', 'cashout', 'adjustment', 'bonus', 'penalty'],
        },
        status: 'completed',
      })
        .sort({ createdAt: -1 })
        .limit(limit);

      // Calculate totals
      const topUps = await Transaction.aggregate([
        {
          $match: {
            userId: user.id,
            purpose: 'wallet_topup',
            status: 'completed',
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$amount' },
          },
        },
      ]);

      const withdrawals = await Transaction.aggregate([
        {
          $match: {
            userId: user.id,
            purpose: 'cashout',
            status: 'completed',
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$amount' },
          },
        },
      ]);

      return {
        balance: wallet.balance / 100,
        totalTopUps: topUps[0]?.total / 100 || 0,
        totalWithdrawals: withdrawals[0]?.total / 100 || 0,
        recentTransactions,
      };
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error fetching wallet summary',
        error.message
      );
    }
  }

  /**
   * Get formatted transaction receipt
   */
  static async getTransactionReceipt(
    _: any,
    { transactionId }: { transactionId: string },
    { user }: ContextType
  ) {
    try {
      const transaction = await Transaction.findById(transactionId);

      if (!transaction) {
        throw new ErrorResponse(404, 'Transaction not found');
      }

      // Verify ownership
      if (transaction.userId !== user.id) {
        throw new ErrorResponse(403, 'Unauthorized access to transaction');
      }

      // Company details
      const companyDetails = {
        name: 'Yalla Ride',
        accountNumber: 'Via Paystack',
        bankName: 'Paystack Transfer',
        bankCode: '',
      };

      // Extract recipient and sender details from metadata
      const metadata = transaction.metadata || {};
      const recipientDetails = metadata.recipientDetails || null;
      const senderDetails = metadata.senderDetails || companyDetails;

      // Format date
      const formattedDate = new Date(transaction.createdAt).toLocaleString(
        'en-NG',
        {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }
      );

      // Generate session ID if not exists
      const sessionId =
        metadata.sessionId ||
        transaction.paymentReference ||
        `${Date.now()}${Math.random().toString(36).substring(2, 11).toUpperCase()}`;

      return {
        transaction,
        companyDetails,
        recipientDetails,
        senderDetails,
        formattedDate,
        sessionId,
      };
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error fetching transaction receipt',
        error.message
      );
    }
  }

  /**
   * Helper: Calculate period date ranges
   */
  private static calculatePeriodDates(
    period: string,
    customRange?: { startDate: Date; endDate: Date }
  ): EarningsPeriod {
    const now = new Date();
    let startDate: Date;
    let endDate: Date = now;
    let label: string;

    switch (period) {
      case 'TODAY':
        startDate = new Date(now.setHours(0, 0, 0, 0));
        label = 'Today';
        break;

      case 'THIS_WEEK':
        const dayOfWeek = now.getDay();
        const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        startDate = new Date(now);
        startDate.setDate(now.getDate() + mondayOffset);
        startDate.setHours(0, 0, 0, 0);
        label = 'This Week';
        break;

      case 'LAST_WEEK':
        const lastWeekEnd = new Date(now);
        lastWeekEnd.setDate(
          now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 0)
        );
        lastWeekEnd.setHours(23, 59, 59, 999);
        startDate = new Date(lastWeekEnd);
        startDate.setDate(lastWeekEnd.getDate() - 6);
        startDate.setHours(0, 0, 0, 0);
        endDate = lastWeekEnd;
        label = 'Last Week';
        break;

      case 'THIS_MONTH':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        label = 'This Month';
        break;

      case 'LAST_MONTH':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
        label = 'Last Month';
        break;

      case 'CUSTOM':
        if (!customRange) {
          throw new ErrorResponse(
            400,
            'Custom range requires start and end dates'
          );
        }
        startDate = new Date(customRange.startDate);
        endDate = new Date(customRange.endDate);
        label = 'Custom Range';
        break;

      default:
        startDate = new Date(now.setHours(0, 0, 0, 0));
        label = 'Today';
    }
    return { startDate, endDate, label };
  }
}

export default TransactionHistoryController;
