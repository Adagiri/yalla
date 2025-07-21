import express from 'express';
import WalletService from './services/wallet.service';
import NotificationService from './services/notification.services';
import { createWebhookHash } from './utils/general';
import { ENV } from './config/env';
import { connectDB } from './config/db-connection';
import { startApolloServer } from './graphql/server';
import {
  DriverSubscription,
  SubscriptionPlan,
} from './features/subscription/subscription.model';
import SubscriptionService from './features/subscription/subscription.service';

const app = express();
app.use(express.json());

declare global {
  namespace Express {
    interface Request {
      sessionID?: string;
      session?: any;
    }
  }
}

connectDB().then(() => {
  startApolloServer(app).then((httpServer) => {
    const PORT = ENV.PORT || 8000;
    httpServer.listen(PORT, () => {
      console.log(`🚀 Server ready at http://localhost:${PORT}/graphql`);
    });
  });
});

const handlePaystackWebhook: any = async (
  req: express.Request,
  res: express.Response
) => {
  const hash = createWebhookHash(ENV.PAYSTACK_SECRET_KEY, req.body);
  const headers: any = req.headers;

  if (hash === headers['x-paystack-signature']) {
    try {
      const { event, data }: any = req.body;

      console.log('Paystack webhook received:', event, data.reference);

      switch (event) {
        case 'charge.success':
          await handleSuccessfulPayment(data);
          break;

        case 'charge.failed':
          await handleFailedPayment(data);
          break;

        case 'transfer.success':
          await handleSuccessfulTransfer(data);
          break;

        case 'transfer.failed':
          await handleFailedTransfer(data);
          break;

        case 'transfer.reversed':
          await handleReversedTransfer(data);
          break;

        default:
          console.log(`Unhandled webhook event: ${event}`);
      }

      return res.sendStatus(200);
    } catch (error: any) {
      console.error('Error processing Paystack webhook:', error);
      return res.sendStatus(500);
    }
  } else {
    console.error('Unauthorized webhook event');
    return res.status(403).send('Unauthorized');
  }
};

/**
 * Handle successful payment
 */
async function handleSuccessfulPayment(data: any) {
  try {
    const { reference, amount, metadata } = data;

    console.log('Processing successful payment:', reference);

    if (metadata?.purpose === 'driver_subscription') {
      // Handle driver subscription payment
      await handleSubscriptionPayment(data);
    } else if (metadata?.purpose === 'wallet_topup') {
      // Handle wallet top-up
      const result = await WalletService.processSuccessfulPayment(data);

      // Send notification using the new sendNotification method
      await NotificationService.sendNotification({
        userId: metadata.userId,
        userType: result.wallet.userType,
        type: 'wallet_topup_success',
        title: '💰 Wallet Top-up Successful!',
        message: `Your wallet has been credited with ₦${amount / 100}`,
        data: {
          amount: amount / 100,
          reference,
          newBalance: result.wallet.balance / 100,
        },
        sendSMS: true,
      });
    } else {
      // Handle regular trip payments
      console.log(`Payment processed for reference: ${reference}`);
    }
  } catch (error: any) {
    console.error('Error handling successful payment:', error);
  }
}

/**
 * Handle subscription payment success
 */
async function handleSubscriptionPayment(data: any) {
  try {
    const { reference, metadata } = data;
    const { driverId, subscriptionId } = metadata;

    // Activate the subscription
    const subscription = await DriverSubscription.findByIdAndUpdate(
      subscriptionId,
      {
        status: 'active',
        paymentReference: reference,
      },
      { new: true }
    );

    if (subscription) {
      const plan = await SubscriptionPlan.findById(subscription.planId);

      if (plan) {
        // Credit driver's wallet (subscription payment goes to wallet first)
        await WalletService.creditWallet({
          userId: driverId,
          amount: plan.price,
          type: 'credit',
          purpose: 'subscription_payment',
          description: `Subscription payment received: ${plan.name}`,
          paymentMethod: 'card',
          // paymentReference: reference,
        });

        // Send subscription activated notification
        await NotificationService.sendNotification({
          userId: driverId,
          userType: 'driver',
          type: 'subscription_activated',
          title: '✅ Subscription Activated!',
          message: `Your ${plan.name} subscription is now active. You can start accepting rides!`,
          data: {
            planName: plan.name,
            subscriptionId: subscription._id,
            expiresAt: subscription.endDate,
          },
          sendSMS: true,
          sendEmail: true,
        });

        console.log(`Subscription activated for driver ${driverId}`);
      }
    }
  } catch (error: any) {
    console.error('Error handling subscription payment:', error);
  }
}

/**
 * Handle failed payment
 */
async function handleFailedPayment(data: any) {
  try {
    const { reference, metadata, gateway_response } = data;

    if (metadata?.purpose === 'driver_subscription') {
      // Handle failed subscription payment
      const { driverId, subscriptionId } = metadata;

      await DriverSubscription.findByIdAndUpdate(subscriptionId, {
        status: 'cancelled',
      });

      await NotificationService.sendNotification({
        userId: driverId,
        userType: 'driver',
        type: 'subscription_payment_failed',
        title: '❌ Subscription Payment Failed',
        message: `Your subscription payment could not be processed: ${gateway_response}`,
        data: {
          reference,
          reason: gateway_response,
        },
        sendSMS: true,
      });
    } else if (metadata?.purpose === 'wallet_topup') {
      // Handle failed wallet top-up
      await NotificationService.sendNotification({
        userId: metadata.userId,
        userType: metadata.payerType,
        type: 'wallet_topup_failed',
        title: '❌ Wallet Top-up Failed',
        message: `Your wallet top-up could not be processed: ${gateway_response}`,
        data: {
          amount: data.amount / 100,
          reference,
          reason: gateway_response,
        },
        sendSMS: true,
      });
    }

    console.log(
      `Payment failed for reference ${reference}: ${gateway_response}`
    );
  } catch (error: any) {
    console.error('Error handling failed payment:', error);
  }
}

/**
 * Handle successful transfer (cashout)
 */
async function handleSuccessfulTransfer(data: any) {
  try {
    const { reference, amount, recipient } = data;

    console.log('Processing successful transfer:', reference);

    // Update transaction status
    const Transaction =
      require('./features/transaction/transaction.model').default;
    const transaction = await Transaction.findOneAndUpdate(
      {
        'metadata.transferReference': reference,
        purpose: 'cashout',
        status: 'pending',
      },
      {
        status: 'completed',
        completedAt: new Date(),
      },
      { new: true }
    );

    if (transaction) {
      // Send success notification using the new sendNotification method
      await NotificationService.sendNotification({
        userId: transaction.userId,
        userType: 'driver',
        type: 'cashout_successful',
        title: '💸 Cashout Successful!',
        message: `₦${amount / 100} has been transferred to your bank account`,
        data: {
          amount: amount / 100,
          reference,
          recipientCode: recipient?.recipient_code,
        },
        sendSMS: true,
      });
    }
  } catch (error: any) {
    console.error('Error handling successful transfer:', error);
  }
}

/**
 * Handle failed transfer (cashout)
 */
async function handleFailedTransfer(data: any) {
  try {
    const { reference, amount } = data;

    console.log('Processing failed transfer:', reference);

    // Update transaction status and refund driver
    const Transaction =
      require('./features/transaction/transaction.model').default;
    const transaction = await Transaction.findOneAndUpdate(
      {
        'metadata.transferReference': reference,
        purpose: 'cashout',
        status: 'pending',
      },
      {
        status: 'failed',
        failureReason: data.gateway_response,
      },
      { new: true }
    );

    if (transaction) {
      // Refund the amount to driver's wallet
      await WalletService.creditWallet({
        userId: transaction.userId,
        amount: transaction.amount,
        type: 'credit',
        purpose: 'cashout_refund',
        description: `Cashout refund for failed transfer: ${reference}`,
        paymentMethod: 'system',
      });

      // Send failure notification
      await NotificationService.sendNotification({
        userId: transaction.userId,
        userType: 'driver',
        type: 'cashout_failed',
        title: '❌ Cashout Failed',
        message: `Your cashout of ₦${amount / 100} failed. Amount has been refunded to your wallet.`,
        data: {
          amount: amount / 100,
          reference,
          reason: data.gateway_response,
        },
        sendSMS: true,
      });
    }
  } catch (error: any) {
    console.error('Error handling failed transfer:', error);
  }
}

/**
 * Handle reversed transfer
 */
async function handleReversedTransfer(data: any) {
  try {
    const { reference, amount } = data;

    console.log('Processing reversed transfer:', reference);

    // Find and update the transaction
    const Transaction =
      require('./features/transaction/transaction.model').default;
    const transaction = await Transaction.findOneAndUpdate(
      {
        'metadata.transferReference': reference,
        purpose: 'cashout',
        status: 'completed',
      },
      {
        status: 'reversed',
      },
      { new: true }
    );

    if (transaction) {
      // Refund the amount to driver's wallet
      await WalletService.creditWallet({
        userId: transaction.userId,
        amount: transaction.amount,
        type: 'credit',
        purpose: 'cashout_reversal',
        description: `Cashout reversal for transfer: ${reference}`,
        paymentMethod: 'system',
      });

      // Send reversal notification
      await NotificationService.sendNotification({
        userId: transaction.userId,
        userType: 'driver',
        type: 'cashout_reversed',
        title: '🔄 Cashout Reversed',
        message: `Your cashout of ₦${amount / 100} has been reversed. Amount credited back to your wallet.`,
        data: {
          amount: amount / 100,
          reference,
        },
        sendSMS: true,
      });
    }
  } catch (error: any) {
    console.error('Error handling reversed transfer:', error);
  }
}

// Start auto-renewal job (run every hour)
setInterval(
  async () => {
    try {
      await SubscriptionService.processAutoRenewals();
    } catch (error) {
      console.error('Error in auto-renewal job:', error);
    }
  },
  60 * 60 * 1000
); // Every hour

// Paystack webhook handler
app.post('/webhook/paystack', handlePaystackWebhook);

export default app;
