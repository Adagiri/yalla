import express, { NextFunction, RequestHandler } from 'express';
import { startApolloServer } from './graphql/server';
import { connectDB } from './config/db-connection';
import { ENV } from './config/env';
import { createWebhookHash } from './utils/general';
import PaystackService from './services/paystack.services';
import InvoiceService from './features/invoice/invoice.service';

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
      await PaystackService.handleWebhookEvent(req.body);
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

const handleInvoiceWebhook: any = async (
  req: Request,
  res: any
): Promise<void> => {
  const headers: any = req.headers;
  const invoiceWebhookKey:string = headers['x-webhook-key'];
  if (invoiceWebhookKey !== ENV.INVOICE_WEBHOOK_KEY) {
    return res.status(401).json({ error: 'Unauthorized: Invalid webhook key' });
  } else {
    try {
      await InvoiceService.generateInvoicesByHook();
      return res.status(200).json({
        message: 'Webhook processed successfully',
      });
    } catch (error: any) {
      console.error('Error processing Invoice webhook:', error);
      return res.sendStatus(500);
    }
  }
};

app.post('/api/paystack/transaction-completion-webhook', handlePaystackWebhook);
app.post('/api/invoices/generate-invoices', handleInvoiceWebhook);

// (async () => {
//   try {
//     await InvoiceService.generateInvoicesByHook();
//     console.log('completed invoice generation');
//   } catch (error: any) {
//     console.error('Error processing Invoice webhook:', error);
//   }
// })();
