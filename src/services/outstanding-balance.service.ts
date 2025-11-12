import mongoose from 'mongoose';
import Customer from '../features/customer/customer.model';
import Driver from '../features/driver/driver.model';
import PaystackService from './paystack.services';
import NotificationService from './notification.services';
import WalletService from '../features/payment/payment.service';
import { AccountType_ } from '../constants/general';
import { ErrorResponse } from '../utils/responses';

class OutstandingBalanceService {
  /**
   * Process all customers AND drivers with outstanding balances
   * Attempts to charge their saved cards
   */
  static async processOutstandingBalances() {
    const session = await mongoose.startSession();
    let customerSuccessCount = 0;
    let customerFailureCount = 0;
    let driverSuccessCount = 0;
    let driverFailureCount = 0;
    let totalAmount = 0;

    try {
      session.startTransaction();

      // ========== PROCESS CUSTOMERS ==========
      const customersWithDebt = await Customer.find({
        outstandingBalance: { $gt: 0 },
        'savedCards.0': { $exists: true },
      }).select(
        '_id email firstname lastname outstandingBalance savedCards accountStatus paymentPreferences'
      );

      console.log(
        `📊 Found ${customersWithDebt.length} customers with outstanding balances`
      );

      for (const customer of customersWithDebt) {
        try {
          const result = await this.chargeCustomerOutstandingBalance(
            customer,
            session
          );

          if (result.success) {
            customerSuccessCount++;
            totalAmount += result.amountCharged || 0;
          } else {
            customerFailureCount++;
          }
        } catch (error: any) {
          console.error(
            `Failed to charge customer ${customer._id}:`,
            error.message
          );
          customerFailureCount++;
        }
      }

      // ========== PROCESS DRIVERS ==========
      const driversWithDebt = await Driver.find({
        $or: [
          { outstandingBalance: { $gt: 0 } },
          { commissionOwed: { $gt: 0 } },
        ],
        'savedCards.0': { $exists: true },
      }).select(
        '_id email firstname lastname outstandingBalance commissionOwed savedCards paymentPreferences'
      );

      console.log(
        `📊 Found ${driversWithDebt.length} drivers with outstanding balances`
      );

      for (const driver of driversWithDebt) {
        try {
          const result = await this.chargeDriverOutstandingBalance(
            driver,
            session
          );

          if (result.success) {
            driverSuccessCount++;
            totalAmount += result.amountCharged || 0;
          } else {
            driverFailureCount++;
          }
        } catch (error: any) {
          console.error(
            `Failed to charge driver ${driver._id}:`,
            error.message
          );
          driverFailureCount++;
        }
      }

      await session.commitTransaction();

      const summary = {
        customers: {
          processed: customersWithDebt.length,
          successCount: customerSuccessCount,
          failureCount: customerFailureCount,
        },
        drivers: {
          processed: driversWithDebt.length,
          successCount: driverSuccessCount,
          failureCount: driverFailureCount,
        },
        totalAmountCollected: totalAmount / 100, // Convert kobo to naira
      };

      console.log('📊 Outstanding balance processing summary:', summary);

      return summary;
    } catch (error: any) {
      await session.abortTransaction();
      throw new ErrorResponse(
        500,
        'Error processing outstanding balances',
        error.message
      );
    } finally {
      session.endSession();
    }
  }

  /**
   * Charge a specific customer's outstanding balance
   */
  static async chargeCustomerOutstandingBalance(
    customer: any,
    session?: mongoose.ClientSession
  ) {
    const useSession = session || (await mongoose.startSession());
    const createdSession = !session;

    try {
      if (createdSession) {
        useSession.startTransaction();
      }

      const outstandingBalance = customer.outstandingBalance || 0;

      if (outstandingBalance <= 0) {
        return {
          success: true,
          message: 'No outstanding balance',
          amountCharged: 0,
        };
      }

      // Find preferred or default card
      const defaultCard = customer.savedCards?.find(
        (card: any) => card.isDefault
      );
      const preferredCardAuth = customer.paymentPreferences?.preferredCard;
      const preferredCard = preferredCardAuth
        ? customer.savedCards?.find(
            (card: any) => card.authorizationCode === preferredCardAuth
          )
        : null;

      const cardToCharge = preferredCard || defaultCard;

      if (!cardToCharge) {
        console.log(
          `⚠️ Customer ${customer._id} has no default/preferred card`
        );
        return {
          success: false,
          reason: 'No payment card available',
          amountCharged: 0,
        };
      }

      // Attempt to charge the card
      const chargeResult = await PaystackService.chargeAuthorization(
        cardToCharge.authorizationCode,
        outstandingBalance / 100, // Convert kobo to naira
        customer.email,
        {
          customerId: customer._id,
          purpose: 'outstanding_balance_payment',
          description: `Payment for outstanding balance of ₦${(outstandingBalance / 100).toFixed(2)}`,
        }
      );

      if (chargeResult.status === 'success') {
        // Clear outstanding balance
        await Customer.findByIdAndUpdate(
          customer._id,
          {
            $set: {
              outstandingBalance: 0,
              accountStatus: 'active',
            },
          },
          { session: useSession }
        );

        // Send success notification
        await NotificationService.sendNotification({
          userId: customer._id.toString(),
          userType: AccountType_.CUSTOMER,
          type: 'payment_success',
          title: '✅ Payment Successful',
          message: `Your outstanding balance of ₦${(outstandingBalance / 100).toFixed(2)} has been successfully charged to your card.`,
          data: {
            amount: outstandingBalance / 100,
            transactionReference: chargeResult.reference,
          },
          sendPush: true,
          sendEmail: true,
        });

        if (createdSession) {
          await useSession.commitTransaction();
        }

        console.log(
          `✅ Charged ₦${(outstandingBalance / 100).toFixed(2)} from customer ${customer._id}`
        );

        return {
          success: true,
          amountCharged: outstandingBalance,
          transactionReference: chargeResult.reference,
        };
      } else {
        // Payment failed
        console.log(
          `❌ Failed to charge customer ${customer._id}: ${chargeResult.message}`
        );

        // Notify customer of continued payment failure
        await NotificationService.sendNotification({
          userId: customer._id.toString(),
          userType: AccountType_.CUSTOMER,
          type: 'payment_failed',
          title: '❌ Payment Retry Failed',
          message: `We attempted to charge your outstanding balance of ₦${(outstandingBalance / 100).toFixed(2)} but your card was declined. Please update your payment method.`,
          sendPush: true,
          sendEmail: true,
        });

        return {
          success: false,
          reason: chargeResult.message || 'Card declined',
          amountCharged: 0,
        };
      }
    } catch (error: any) {
      if (createdSession) {
        await useSession.abortTransaction();
      }

      console.error(`Error charging customer ${customer._id}:`, error);

      // Notify customer of error
      await NotificationService.sendNotification({
        userId: customer._id.toString(),
        userType: AccountType_.CUSTOMER,
        type: 'payment_error',
        title: '⚠️ Payment Processing Error',
        message:
          'There was an error processing your outstanding balance payment. Our team has been notified.',
        sendPush: true,
      });

      return {
        success: false,
        reason: error.message,
        amountCharged: 0,
      };
    } finally {
      if (createdSession) {
        useSession.endSession();
      }
    }
  }

  /**
   * Charge a specific driver's outstanding balance
   * Handles both outstandingBalance and commissionOwed fields
   */
  static async chargeDriverOutstandingBalance(
    driver: any,
    session?: mongoose.ClientSession
  ) {
    const useSession = session || (await mongoose.startSession());
    const createdSession = !session;

    try {
      if (createdSession) {
        useSession.startTransaction();
      }

      const outstandingBalance = driver.outstandingBalance || 0;
      const commissionOwed = driver.commissionOwed || 0;
      const totalOwed = outstandingBalance + commissionOwed;

      if (totalOwed <= 0) {
        return {
          success: true,
          message: 'No outstanding balance',
          amountCharged: 0,
        };
      }

      // Find default card (drivers don't have payment preferences typically)
      const defaultCard = driver.savedCards?.find(
        (card: any) => card.isDefault
      );

      if (!defaultCard) {
        console.log(`⚠️ Driver ${driver._id} has no default card`);
        return {
          success: false,
          reason: 'No payment card available',
          amountCharged: 0,
        };
      }

      // Attempt to charge the card
      const chargeResult = await PaystackService.chargeAuthorization(
        defaultCard.authorizationCode,
        totalOwed / 100, // Convert kobo to naira
        driver.email,
        {
          customerId: driver._id,
          purpose: 'driver_outstanding_balance_payment',
          description: `Payment for outstanding balance: ₦${(outstandingBalance / 100).toFixed(2)} + Commission: ₦${(commissionOwed / 100).toFixed(2)}`,
        }
      );

      if (chargeResult.status === 'success') {
        // Clear both outstanding balance and commission owed
        await Driver.findByIdAndUpdate(
          driver._id,
          {
            $set: {
              outstandingBalance: 0,
              commissionOwed: 0,
            },
          },
          { session: useSession }
        );

        // Send success notification
        await NotificationService.sendNotification({
          userId: driver._id.toString(),
          userType: AccountType_.DRIVER,
          type: 'payment_success',
          title: '✅ Payment Successful',
          message: `Your outstanding balance of ₦${(totalOwed / 100).toFixed(2)} has been successfully charged to your card.`,
          data: {
            amount: totalOwed / 100,
            outstandingBalance: outstandingBalance / 100,
            commissionOwed: commissionOwed / 100,
            transactionReference: chargeResult.reference,
          },
          sendPush: true,
          sendEmail: true,
        });

        if (createdSession) {
          await useSession.commitTransaction();
        }

        console.log(
          `✅ Charged ₦${(totalOwed / 100).toFixed(2)} from driver ${driver._id} (Outstanding: ₦${(outstandingBalance / 100).toFixed(2)}, Commission: ₦${(commissionOwed / 100).toFixed(2)})`
        );

        return {
          success: true,
          amountCharged: totalOwed,
          transactionReference: chargeResult.reference,
        };
      } else {
        // Payment failed
        console.log(
          `❌ Failed to charge driver ${driver._id}: ${chargeResult.message}`
        );

        // Notify driver of continued payment failure
        await NotificationService.sendNotification({
          userId: driver._id.toString(),
          userType: AccountType_.DRIVER,
          type: 'payment_failed',
          title: '❌ Payment Retry Failed',
          message: `We attempted to charge your outstanding balance of ₦${(totalOwed / 100).toFixed(2)} but your card was declined. Please update your payment method or top up your wallet.`,
          sendPush: true,
          sendEmail: true,
        });

        return {
          success: false,
          reason: chargeResult.message || 'Card declined',
          amountCharged: 0,
        };
      }
    } catch (error: any) {
      if (createdSession) {
        await useSession.abortTransaction();
      }

      console.error(`Error charging driver ${driver._id}:`, error);

      // Notify driver of error
      await NotificationService.sendNotification({
        userId: driver._id.toString(),
        userType: AccountType_.DRIVER,
        type: 'payment_error',
        title: '⚠️ Payment Processing Error',
        message:
          'There was an error processing your outstanding balance payment. Our team has been notified.',
        sendPush: true,
      });

      return {
        success: false,
        reason: error.message,
        amountCharged: 0,
      };
    } finally {
      if (createdSession) {
        useSession.endSession();
      }
    }
  }

  /**
   * Get customers with outstanding balances (for admin reporting)
   */
  static async getCustomersWithOutstandingBalance(limit = 100) {
    try {
      const customers = await Customer.find({
        outstandingBalance: { $gt: 0 },
      })
        .select(
          'firstname lastname email phone outstandingBalance accountStatus'
        )
        .sort({ outstandingBalance: -1 })
        .limit(limit)
        .lean();

      const totalDebt = await Customer.aggregate([
        { $match: { outstandingBalance: { $gt: 0 } } },
        {
          $group: {
            _id: null,
            totalDebt: { $sum: '$outstandingBalance' },
            customerCount: { $sum: 1 },
          },
        },
      ]);

      return {
        customers,
        summary: {
          totalCustomers: totalDebt[0]?.customerCount || 0,
          totalOutstanding: (totalDebt[0]?.totalDebt || 0) / 100,
        },
      };
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error fetching customers with outstanding balance',
        error.message
      );
    }
  }

  /**
   * Get drivers with outstanding balances (for admin reporting)
   */
  static async getDriversWithOutstandingBalance(limit = 100) {
    try {
      const drivers = await Driver.find({
        $or: [
          { outstandingBalance: { $gt: 0 } },
          { commissionOwed: { $gt: 0 } },
        ],
      })
        .select(
          'firstname lastname email phone outstandingBalance commissionOwed'
        )
        .sort({ outstandingBalance: -1, commissionOwed: -1 })
        .limit(limit)
        .lean();

      const totalDebt = await Driver.aggregate([
        {
          $match: {
            $or: [
              { outstandingBalance: { $gt: 0 } },
              { commissionOwed: { $gt: 0 } },
            ],
          },
        },
        {
          $group: {
            _id: null,
            totalOutstandingBalance: { $sum: '$outstandingBalance' },
            totalCommissionOwed: { $sum: '$commissionOwed' },
            driverCount: { $sum: 1 },
          },
        },
      ]);

      return {
        drivers,
        summary: {
          totalDrivers: totalDebt[0]?.driverCount || 0,
          totalOutstanding: (totalDebt[0]?.totalOutstandingBalance || 0) / 100,
          totalCommission: (totalDebt[0]?.totalCommissionOwed || 0) / 100,
          combinedTotal:
            ((totalDebt[0]?.totalOutstandingBalance || 0) +
              (totalDebt[0]?.totalCommissionOwed || 0)) /
            100,
        },
      };
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error fetching drivers with outstanding balance',
        error.message
      );
    }
  }

  /**
   * Manually charge a specific customer's outstanding balance (admin action)
   */
  static async chargeCustomerManually(customerId: string) {
    try {
      const customer = await Customer.findById(customerId).select(
        '_id email firstname lastname outstandingBalance savedCards accountStatus paymentPreferences'
      );

      if (!customer) {
        throw new ErrorResponse(404, 'Customer not found');
      }

      if (customer.outstandingBalance <= 0) {
        throw new ErrorResponse(400, 'Customer has no outstanding balance');
      }

      return await this.chargeCustomerOutstandingBalance(customer);
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error charging customer manually',
        error.message
      );
    }
  }

  /**
   * Manually charge a specific driver's outstanding balance (admin action)
   */
  static async chargeDriverManually(driverId: string) {
    try {
      const driver = await Driver.findById(driverId).select(
        '_id email firstname lastname outstandingBalance commissionOwed savedCards'
      );

      if (!driver) {
        throw new ErrorResponse(404, 'Driver not found');
      }

      const totalOwed =
        (driver.outstandingBalance || 0) + (driver.commissionOwed || 0);

      if (totalOwed <= 0) {
        throw new ErrorResponse(400, 'Driver has no outstanding balance');
      }

      return await this.chargeDriverOutstandingBalance(driver);
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error charging driver manually',
        error.message
      );
    }
  }
}

export default OutstandingBalanceService;
