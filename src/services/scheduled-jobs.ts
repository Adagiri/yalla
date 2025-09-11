import SubscriptionService from '../features/subscription/subscription.service';

/**
 * Start all scheduled jobs
 */
export function startScheduledJobs() {
  console.log('🕐 Starting scheduled jobs...');

  // Start auto-renewal job (run every hour)
  const autoRenewalInterval = setInterval(
    async () => {
      try {
        console.log('🔄 Running auto-renewal job...');
        await SubscriptionService.processAutoRenewals();
        console.log('✅ Auto-renewal job completed');
      } catch (error) {
        console.error('❌ Error in auto-renewal job:', error);
      }
    },
    60 * 60 * 1000 // Every hour
  );

  // Graceful shutdown handler
  process.on('SIGTERM', () => {
    console.log('🛑 Stopping scheduled jobs...');
    clearInterval(autoRenewalInterval);
  });

  process.on('SIGINT', () => {
    console.log('🛑 Stopping scheduled jobs...');
    clearInterval(autoRenewalInterval);
  });

  console.log('✅ Scheduled jobs started');
}
