import mongoose from 'mongoose';
import Wallet from '../models/wallet.model';
import { ErrorResponse } from '../utils/responses';
import PaystackService from '../services/paystack.services';
import Transaction from '../features/transaction/transaction.model';
import { AccountType } from '../constants/general';

interface CreateWalletInput {
  userId: string;
  userType: AccountType;
}

interface TopUpWalletInput {
  userId: string;
  amount: number; // In Naira
  paymentMethod: 'card' | 'bank_transfer';
  paymentReference?: string;
  saveCard?: boolean;
}

interface WalletTransactionInput {
  userId: string;
  amount: number; // In Naira
  type: 'credit' | 'debit';
  purpose: string;
  description: string;
  tripId?: string;
  paymentMethod?: string;
  metadata?: any;
}

interface TransferInput {
  fromUserId: string;
  toUserId: string;
  amount: number; // In Naira
  description: string;
  tripId?: string;
}

class WalletService {
  /**
   * Create wallet for user
   */
  static async createWallet(input: CreateWalletInput) {
    try {
      // Check if wallet already exists
      const existingWallet = await Wallet.findOne({ userId: input.userId });
      if (existingWallet) {
        return existingWallet;
      }

      const wallet = new Wallet({
        userId: input.userId,
        userType: input.userType,
        balance: 0,
        isActive: true,
      });

      await wallet.save();
      return wallet;
    } catch (error: any) {
      throw new ErrorResponse(500, 'Error creating wallet', error.message);
    }
  }

  /**
   * Get user wallet
   */
  static async getUserWallet(userId: string) {
    try {
      let wallet = await Wallet.findOne({ userId });

      if (!wallet) {
        // Auto-create wallet if it doesn't exist
        const userType = await this.getUserType(userId);
        wallet = await this.createWallet({ userId, userType });
      }

      return wallet;
    } catch (error: any) {
      throw new ErrorResponse(500, 'Error fetching wallet', error.message);
    }
  }

  /**
   * Top up wallet via Paystack
   */
  static async topUpWallet(input: TopUpWalletInput) {
    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      const wallet = await this.getUserWallet(input.userId);
      if (!wallet.isActive) {
        throw new ErrorResponse(400, 'Wallet is inactive');
      }

      // Convert amount to kobo
      const amountInKobo = Math.round(input.amount * 100);

      // Initialize Paystack transaction
      const paystackResponse = await PaystackService.initializeTransaction({
        email: await this.getUserEmail(input.userId),
        amount: input.amount, // Paystack expects Naira amount
        metadata: {
          userId: input.userId,
          purpose: 'wallet_topup',
          walletId: wallet._id,
        },
        channels: input.paymentMethod === 'card' ? ['card'] : ['bank'],
        reference: input.paymentReference,
      });

      // Create pending transaction
      const transaction = new Transaction({
        userId: input.userId,
        userType: wallet.userType,
        type: 'credit',
        amount: amountInKobo,
        paymentMethod: input.paymentMethod,
        paymentReference: paystackResponse.reference,
        purpose: 'wallet_topup',
        status: 'pending',
        balanceBefore: wallet.balance,
        balanceAfter: wallet.balance, // Will be updated when payment is confirmed
        description: `Wallet top-up via ${input.paymentMethod}`,
        paystackData: {
          reference: paystackResponse.reference,
        },
      });

      await transaction.save({ session });
      await session.commitTransaction();

      return {
        transaction,
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
        'Error initiating wallet top-up',
        error.message
      );
    } finally {
      session.endSession();
    }
  }

  /**
   * Process successful payment from webhook
   */
  static async processSuccessfulPayment(paystackData: any) {
    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      const { reference, amount, metadata } = paystackData;

      // Find pending transaction
      const transaction = await Transaction.findOne({
        paymentReference: reference,
        status: 'pending',
      });

      if (!transaction) {
        throw new ErrorResponse(404, 'Transaction not found');
      }

      // Get wallet
      const wallet = await Wallet.findOne({ userId: transaction.userId });
      if (!wallet) {
        throw new ErrorResponse(404, 'Wallet not found');
      }

      // Update wallet balance
      const amountInKobo = amount; // Paystack webhook sends amount in kobo
      const newBalance = wallet.balance + amountInKobo;

      wallet.balance = newBalance;
      wallet.totalCredits += amountInKobo;
      wallet.lastTransactionAt = new Date();

      // Update transaction
      transaction.status = 'completed';
      transaction.balanceAfter = newBalance;
      transaction.completedAt = new Date();

      // Save Paystack data
      if (paystackData.authorization) {
        transaction.paystackData = {
          ...transaction.paystackData,
          authorizationCode: paystackData.authorization.authorization_code,
          lastFour: paystackData.authorization.last4,
          bank: paystackData.authorization.bank,
          brand: paystackData.authorization.brand,
        };
      }

      await wallet.save({ session });
      await transaction.save({ session });

      await session.commitTransaction();

      return { wallet, transaction };
    } catch (error: any) {
      await session.abortTransaction();
      throw new ErrorResponse(500, 'Error processing payment', error.message);
    } finally {
      session.endSession();
    }
  }

  /**
   * Debit wallet (for trip payments, etc.)
   */
  static async debitWallet(input: WalletTransactionInput) {
    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      const wallet = await this.getUserWallet(input.userId);
      if (!wallet.isActive) {
        throw new ErrorResponse(400, 'Wallet is inactive');
      }

      const amountInKobo = Math.round(input.amount * 100);

      // Check sufficient balance
      if (wallet.balance < amountInKobo) {
        throw new ErrorResponse(400, 'Insufficient wallet balance');
      }

      // Update wallet
      const newBalance = wallet.balance - amountInKobo;
      wallet.balance = newBalance;
      wallet.totalDebits += amountInKobo;
      wallet.lastTransactionAt = new Date();

      // Create transaction record
      const transaction = new Transaction({
        userId: input.userId,
        userType: wallet.userType,
        type: 'debit',
        amount: amountInKobo,
        paymentMethod: input.paymentMethod || 'wallet',
        purpose: input.purpose,
        status: 'completed',
        balanceBefore: wallet.balance + amountInKobo,
        balanceAfter: newBalance,
        description: input.description,
        tripId: input.tripId,
        metadata: input.metadata,
        completedAt: new Date(),
      });

      await wallet.save({ session });
      await transaction.save({ session });

      await session.commitTransaction();

      return { wallet, transaction };
    } catch (error: any) {
      await session.abortTransaction();
      throw new ErrorResponse(500, 'Error debiting wallet', error.message);
    } finally {
      session.endSession();
    }
  }

  /**
   * Credit wallet (for driver earnings, refunds, etc.)
   */
  static async creditWallet(input: WalletTransactionInput) {
    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      const wallet = await this.getUserWallet(input.userId);
      if (!wallet.isActive) {
        throw new ErrorResponse(400, 'Wallet is inactive');
      }

      const amountInKobo = Math.round(input.amount * 100);

      // Update wallet
      const newBalance = wallet.balance + amountInKobo;
      wallet.balance = newBalance;
      wallet.totalCredits += amountInKobo;
      wallet.lastTransactionAt = new Date();

      // Create transaction record
      const transaction = new Transaction({
        userId: input.userId,
        userType: wallet.userType,
        type: 'credit',
        amount: amountInKobo,
        paymentMethod: input.paymentMethod || 'system',
        purpose: input.purpose,
        status: 'completed',
        balanceBefore: wallet.balance - amountInKobo,
        balanceAfter: newBalance,
        description: input.description,
        tripId: input.tripId,
        metadata: input.metadata,
        completedAt: new Date(),
      });

      await wallet.save({ session });
      await transaction.save({ session });

      await session.commitTransaction();

      return { wallet, transaction };
    } catch (error: any) {
      await session.abortTransaction();
      throw new ErrorResponse(500, 'Error crediting wallet', error.message);
    } finally {
      session.endSession();
    }
  }

  /**
   * Transfer between wallets (for trip payments)
   */
  static async transferBetweenWallets(input: TransferInput) {
    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      const [fromWallet, toWallet] = await Promise.all([
        this.getUserWallet(input.fromUserId),
        this.getUserWallet(input.toUserId),
      ]);

      if (!fromWallet.isActive || !toWallet.isActive) {
        throw new ErrorResponse(400, 'One or both wallets are inactive');
      }

      const amountInKobo = Math.round(input.amount * 100);

      // Check sufficient balance
      if (fromWallet.balance < amountInKobo) {
        throw new ErrorResponse(400, 'Insufficient balance for transfer');
      }

      // Update balances
      fromWallet.balance -= amountInKobo;
      fromWallet.totalDebits += amountInKobo;
      fromWallet.lastTransactionAt = new Date();

      toWallet.balance += amountInKobo;
      toWallet.totalCredits += amountInKobo;
      toWallet.lastTransactionAt = new Date();

      // Create debit transaction
      const debitTransaction = new Transaction({
        userId: input.fromUserId,
        userType: fromWallet.userType,
        type: 'debit',
        amount: amountInKobo,
        paymentMethod: 'wallet',
        purpose: 'trip_payment',
        status: 'completed',
        balanceBefore: fromWallet.balance + amountInKobo,
        balanceAfter: fromWallet.balance,
        description: input.description,
        tripId: input.tripId,
        completedAt: new Date(),
      });

      // Create credit transaction
      const creditTransaction = new Transaction({
        userId: input.toUserId,
        userType: toWallet.userType,
        type: 'credit',
        amount: amountInKobo,
        paymentMethod: 'wallet',
        purpose: 'driver_earnings',
        status: 'completed',
        balanceBefore: toWallet.balance - amountInKobo,
        balanceAfter: toWallet.balance,
        description: `Earnings: ${input.description}`,
        tripId: input.tripId,
        relatedTransactionId: debitTransaction._id,
        completedAt: new Date(),
      });

      // Link transactions
      debitTransaction.relatedTransactionId = creditTransaction._id;

      await fromWallet.save({ session });
      await toWallet.save({ session });
      await debitTransaction.save({ session });
      await creditTransaction.save({ session });

      await session.commitTransaction();

      return {
        fromWallet,
        toWallet,
        debitTransaction,
        creditTransaction,
      };
    } catch (error: any) {
      await session.abortTransaction();
      throw new ErrorResponse(500, 'Error transferring funds', error.message);
    } finally {
      session.endSession();
    }
  }

  /**
   * Get wallet transaction history
   */
  static async getTransactionHistory(
    userId: string,
    pagination: { page: number; limit: number },
    filter?: { type?: 'credit' | 'debit'; purpose?: string; status?: string }
  ) {
    try {
      const query: any = { userId };

      if (filter?.type) query.type = filter.type;
      if (filter?.purpose) query.purpose = filter.purpose;
      if (filter?.status) query.status = filter.status;

      const transactions = await Transaction.find(query)
        .sort({ createdAt: -1 })
        .limit(pagination.limit)
        .skip((pagination.page - 1) * pagination.limit)
        .populate('tripId', 'tripNumber pickup destination');

      const total = await Transaction.countDocuments(query);

      return {
        transactions,
        total,
        page: pagination.page,
        totalPages: Math.ceil(total / pagination.limit),
      };
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error fetching transaction history',
        error.message
      );
    }
  }

  /**
   * Helper: Get user type
   */
  private static async getUserType(
    userId: string
  ): Promise<AccountType> {
    // This would typically check the user's account type from the user model
    // For now, we'll implement a basic check
    const Driver = mongoose.model('Driver');
    const Customer = mongoose.model('Customer');

    const driver = await Driver.findById(userId);
    if (driver) return AccountType.DRIVER;

    const customer = await Customer.findById(userId);
    if (customer) return AccountType.CUSTOMER;

    throw new ErrorResponse(404, 'User not found');
  }

  /**
   * Helper: Get user email
   */
  private static async getUserEmail(userId: string): Promise<string> {
    const Driver = mongoose.model('Driver');
    const Customer = mongoose.model('Customer');

    const driver = await Driver.findById(userId);
    if (driver) return driver.email;

    const customer = await Customer.findById(userId);
    if (customer) return customer.email;

    throw new ErrorResponse(404, 'User email not found');
  }
}

export default WalletService;
