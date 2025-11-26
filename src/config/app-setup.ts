// src/config/app-setup.ts
import express from 'express';
import { handlePaystackWebhook } from '../services/webhook-handlers';
import { startScheduledJobs } from '../services/scheduled-jobs';
import healthRouter from '../routes/health';

/**
 * Setup application routes and services that depend on loaded secrets
 */
export function setupApp(app: express.Application) {
  console.log('🔧 Setting up application...');;

  // Setup webhook routes
  app.post('/webhook/paystack', handlePaystackWebhook);

  // Setup health routes
  app.use('/api', healthRouter);

  // Start scheduled jobs
  startScheduledJobs();

  console.log('✅ Application setup completed');
}
