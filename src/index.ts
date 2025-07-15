import express from 'express';
import PaymentService from './services/payment.service';
import WalletService from './services/wallet.service';
import NotificationService from './services/notification.services';
import { createWebhookHash } from './utils/general';
import { ENV } from './config/env';
import { connectDB } from './config/db-connection';
import { startApolloServer } from './graphql/server';

const app = express();
app.use(express.json());

connectDB().then(() => {
  startApolloServer(app).then((httpServer) => {
    const PORT = ENV.PORT || 8000;
    httpServer.listen(PORT, () => {
      console.log(`🚀 Server ready at http://localhost:${PORT}/graphql`);
    });
  });
});

const handlePaystackWebhook: any = async (
  req: Request,
  res: any
): Promise<void> => {
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

    if (metadata?.purpose === 'wallet_topup') {
      // Handle wallet top-up
      const result = await WalletService.processSuccessfulPayment(data);

      // Send notification to user
      // await NotificationService.sendNotification({
      //   userId: metadata.userId,
      //   userType: result.wallet.userType,
      //   type: 'wallet_topup_success',
      //   title: '💰 Wallet Top-up Successful!',
      //   message: `Your wallet has been credited with ₦${(amount / 100).toLocaleString()}`,
      //   data: {
      //     amount: amount / 100,
      //     newBalance: result.wallet.balance / 100,
      //     reference,
      //   },
      // });

      console.log(
        `Wallet top-up completed for user ${metadata.userId}: ₦${amount / 100}`
      );
    } else if (metadata?.purpose === 'trip_payment') {
      // Handle trip payment

      const result = await PaymentService.processSuccessfulCardPayment(data);

      // Send notifications to customer and driver
      const trip = result.trip;

      if (trip) {
        // Notify customer
        await NotificationService.sendTripNotification(
          trip.customerId,
          'customer',
          'payment_successful',
          {
            ...trip.toObject(),
            amount: amount / 100,
            reference,
          }
        );

        // Notify driver about earnings
        if (trip.driverId) {
          await NotificationService.sendTripNotification(
            trip.driverId,
            'driver',
            'earnings_received',
            {
              ...trip.toObject(),
              earnings: result.amounts.driverEarnings,
              reference,
            }
          );
        }

        console.log(
          `Trip payment completed for trip ${trip.tripNumber}: ₦${amount / 100}`
        );
      }
    } else {
      console.log(`Unknown payment purpose: ${metadata?.purpose}`);
    }
  } catch (error: any) {
    console.error('Error handling successful payment:', error);
    throw error;
  }
}

/**
 * Handle failed payment
 */
async function handleFailedPayment(data: any) {
  try {
    const { reference, metadata } = data;

    console.log('Processing failed payment:', reference);

    // Find the pending transaction and mark as failed
    const Transaction = require('./models/transaction.model').default;
    const transaction = await Transaction.findOneAndUpdate(
      { paymentReference: reference, status: 'pending' },
      {
        status: 'failed',
        metadata: { ...metadata, failureReason: data.gateway_response },
      },
      { new: true }
    );

    if (transaction) {
      // Send failure notification
      // await NotificationService.sendNotification({
      //   userId: transaction.userId,
      //   userType: transaction.userType,
      //   type: 'payment_failed',
      //   title: '❌ Payment Failed',
      //   message: `Your payment of ₦${transaction.amount / 100} could not be processed`,
      //   data: {
      //     amount: transaction.amount / 100,
      //     reference,
      //     reason: data.gateway_response,
      //   },
      // });

      console.log(
        `Payment failed for user ${transaction.userId}: ${data.gateway_response}`
      );
    }
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
    const Transaction = require('./models/transaction.model').default;
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
      // Send success notification
      // await NotificationService.sendNotification({
      //   userId: transaction.userId,
      //   userType: 'driver',
      //   type: 'cashout_successful',
      //   title: '💸 Cashout Successful!',
      //   message: `₦${(amount / 100).toLocaleString()} has been sent to your bank account`,
      //   data: {
      //     amount: amount / 100,
      //     reference,
      //     accountDetails: transaction.metadata.accountName,
      //   },
      // });

      console.log(
        `Cashout completed for driver ${transaction.userId}: ₦${amount / 100}`
      );
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

    // Find and update transaction
    const Transaction = require('./models/transaction.model').default;
    const transaction = await Transaction.findOne({
      'metadata.transferReference': reference,
      purpose: 'cashout',
    });

    if (transaction) {
      // Reverse the wallet debit
      await WalletService.creditWallet({
        userId: transaction.userId,
        amount: transaction.amount / 100,
        type: 'credit',
        purpose: 'adjustment',
        description: `Cashout reversal: ${transaction.description}`,
        paymentMethod: 'system',
        metadata: {
          originalTransactionId: transaction._id,
          reversalReason: 'Transfer failed',
          originalReference: reference,
        },
      });

      // Update original transaction
      await Transaction.findByIdAndUpdate(transaction._id, {
        status: 'failed',
        metadata: {
          ...transaction.metadata,
          failureReason: data.gateway_response,
        },
      });

      // Send notification
      // await NotificationService.sendNotification({
      //   userId: transaction.userId,
      //   userType: 'driver',
      //   type: 'cashout_failed',
      //   title: '❌ Cashout Failed',
      //   message: `Your cashout of ₦${(amount / 100).toLocaleString()} failed. Amount has been returned to your wallet.`,
      //   data: {
      //     amount: amount / 100,
      //     reference,
      //     reason: data.gateway_response,
      //   },
      // });

      console.log(
        `Cashout failed and reversed for driver ${transaction.userId}: ₦${amount / 100}`
      );
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

    // Similar to failed transfer - reverse the transaction
    await handleFailedTransfer(data);
  } catch (error: any) {
    console.error('Error handling reversed transfer:', error);
  }
}

// app.post('/api/invoices/generate-invoices', handleInvoiceWebhook);

app.post('/api/paystack/transaction-completion-webhook', handlePaystackWebhook);