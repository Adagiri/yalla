import cron from 'node-cron';
import Driver from '../features/driver/driver.model';
import Customer from '../features/customer/customer.model';
import WalletService from '../services/wallet.service';
import NotificationService from '../services/notification.services';
import { AccountType_ } from '../constants/general';
import mongoose from 'mongoose';

/**
 * Service to automatically clear outstanding balances from wallets
 */
class WalletBalanceClearanceService {
  /**
   * Process all drivers with outstanding balance
   * Attempts to deduct from wallet balance
   */
  static async processDriverOutstandingBalance() {
    let successCount = 0;
    let insufficientCount = 0;
    let totalCleared = 0;

    try {
      // Find all drivers with outstanding balance > 0 and wallet balance > 0
      const driversWithBalance = await Driver.find({
        outstandingBalance: { $gt: 0 },
      }).select('_id firstname lastname outstandingBalance commissionOwed');

      console.log(
        `📊 Found ${driversWithBalance.length} drivers with outstanding balance`
      );

      for (const driver of driversWithBalance) {
        try {
          const session = await mongoose.startSession();
          session.startTransaction();

          const wallet = await WalletService.getUserWallet(driver._id);
          const outstandingBalance = driver.outstandingBalance || 0;
          const commissionOwed = driver.commissionOwed || 0;
          const totalOwed = outstandingBalance + commissionOwed;

          // Check if wallet has sufficient balance
          if (wallet.balance < totalOwed) {
            insufficientCount++;
            await session.abortTransaction();
            session.endSession();
            continue;
          }

          // Debit wallet for outstanding balance + commission
          await WalletService.debitWallet(
            {
              userId: driver._id,
              amount: totalOwed / 100, // Convert kobo to naira
              type: 'debit',
              purpose: 'outstanding_balance_clearance',
              description: `Auto-clearance: Outstanding balance ₦${(outstandingBalance / 100).toFixed(2)} + Commission ₦${(commissionOwed / 100).toFixed(2)}`,
              paymentMethod: 'wallet',
              metadata: {
                outstandingBalance,
                commissionOwed,
                totalOwed,
                automated: true,
              },
            },
            session
          );

          // Update driver - clear both fields
          await Driver.findByIdAndUpdate(
            driver._id,
            {
              $set: {
                outstandingBalance: 0,
                commissionOwed: 0,
              },
            },
            { session }
          );

          await session.commitTransaction();
          session.endSession();

          // Send notification
          await NotificationService.sendNotification({
            userId: driver._id,
            userType: AccountType_.DRIVER,
            type: 'outstanding_balance_cleared',
            title: '✅ Balance Cleared',
            message: `₦${(totalOwed / 100).toFixed(2)} has been automatically deducted from your wallet to clear outstanding balance and commission.`,
            data: { amount: totalOwed / 100 },
            sendPush: true,
          });

          successCount++;
          totalCleared += totalOwed;

          console.log(
            `✅ Cleared ₦${(totalOwed / 100).toFixed(2)} for driver ${driver._id}`
          );
        } catch (error: any) {
          console.error(
            `❌ Failed to clear balance for driver ${driver._id}:`,
            error.message
          );
        }
      }

      return {
        success: true,
        driversProcessed: driversWithBalance.length,
        successCount,
        insufficientCount,
        totalCleared: totalCleared / 100,
      };
    } catch (error: any) {
      console.error('❌ Error processing driver outstanding balances:', error);
      throw error;
    }
  }

  /**
   * Process all customers with outstanding balance
   * Attempts to deduct from wallet balance
   */
  static async processCustomerOutstandingBalance() {
    let successCount = 0;
    let insufficientCount = 0;
    let totalCleared = 0;

    try {
      // Find all customers with outstanding balance > 0
      const customersWithBalance = await Customer.find({
        outstandingBalance: { $gt: 0 },
      }).select('_id firstname lastname outstandingBalance accountStatus');

      console.log(
        `📊 Found ${customersWithBalance.length} customers with outstanding balance`
      );

      for (const customer of customersWithBalance) {
        try {
          const session = await mongoose.startSession();
          session.startTransaction();

          const wallet = await WalletService.getUserWallet(customer._id);
          const outstandingBalance = customer.outstandingBalance || 0;

          // Check if wallet has sufficient balance
          if (wallet.balance < outstandingBalance) {
            insufficientCount++;
            await session.abortTransaction();
            session.endSession();
            continue;
          }

          // Debit wallet for outstanding balance
          await WalletService.debitWallet(
            {
              userId: customer._id,
              amount: outstandingBalance / 100, // Convert kobo to naira
              type: 'debit',
              purpose: 'outstanding_balance_clearance',
              description: `Auto-clearance of outstanding balance: ₦${(outstandingBalance / 100).toFixed(2)}`,
              paymentMethod: 'wallet',
              metadata: {
                outstandingBalance,
                automated: true,
              },
            },
            session
          );

          // Update customer - clear outstanding balance and reactivate account
          await Customer.findByIdAndUpdate(
            customer._id,
            {
              $set: {
                outstandingBalance: 0,
                accountStatus: 'active',
              },
            },
            { session }
          );

          await session.commitTransaction();
          session.endSession();

          // Send notification
          await NotificationService.sendNotification({
            userId: customer._id,
            userType: AccountType_.CUSTOMER,
            type: 'outstanding_balance_cleared',
            title: '✅ Balance Cleared',
            message: `₦${(outstandingBalance / 100).toFixed(2)} has been automatically deducted from your wallet to clear your outstanding balance.`,
            data: { amount: outstandingBalance / 100 },
            sendPush: true,
            sendEmail: true,
          });

          successCount++;
          totalCleared += outstandingBalance;

          console.log(
            `✅ Cleared ₦${(outstandingBalance / 100).toFixed(2)} for customer ${customer._id}`
          );
        } catch (error: any) {
          console.error(
            `❌ Failed to clear balance for customer ${customer._id}:`,
            error.message
          );
        }
      }

      return {
        success: true,
        customersProcessed: customersWithBalance.length,
        successCount,
        insufficientCount,
        totalCleared: totalCleared / 100,
      };
    } catch (error: any) {
      console.error('❌ Error processing customer outstanding balances:', error);
      throw error;
    }
  }
}

// Cron job to clear outstanding balances from wallets
// Runs every 1 minute
// Cron expression: */1 * * * * = Every 1 minute

export const startWalletBalanceClearanceJob = () => {
  const job = cron.schedule('*/1 * * * *', async () => {
    console.log('⏰ Running wallet balance clearance job...');

    try {
      // Process drivers
      const driverResult =
        await WalletBalanceClearanceService.processDriverOutstandingBalance();
      console.log('✅ Driver wallet clearance completed:', driverResult);

      // Process customers
      const customerResult =
        await WalletBalanceClearanceService.processCustomerOutstandingBalance();
      console.log('✅ Customer wallet clearance completed:', customerResult);
    } catch (error: any) {
      console.error('❌ Wallet balance clearance job failed:', error);
    }
  });

  console.log(
    '🚀 Wallet balance clearance cron job started (runs every 1 minute)'
  );

  return job;
};

// Manual trigger for testing
export const triggerWalletBalanceClearance = async () => {
  console.log('🔧 Manually triggering wallet balance clearance...');
  const driverResult =
    await WalletBalanceClearanceService.processDriverOutstandingBalance();
  const customerResult =
    await WalletBalanceClearanceService.processCustomerOutstandingBalance();
  return { driverResult, customerResult };
};

export default WalletBalanceClearanceService;