import SubscriptionService from '../features/subscription/subscription.service';
import { startOutstandingBalanceJob } from '../jobs/outstanding-balance.job';
import { startCommissionSettlementJob } from '../jobs/commission-settlement.job';

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

  // Start commission settlement cron job (every 10 minutes)
  const commissionJob = startCommissionSettlementJob();

  // Start outstanding balance charging cron job (daily at 2 AM)
  const outstandingBalanceJob = startOutstandingBalanceJob();

  // Graceful shutdown handler
  process.on('SIGTERM', () => {
    console.log('🛑 Stopping scheduled jobs...');
    clearInterval(autoRenewalInterval);
    commissionJob.stop();
    outstandingBalanceJob.stop();
  });

  process.on('SIGINT', () => {
    console.log('🛑 Stopping scheduled jobs...');
    clearInterval(autoRenewalInterval);
    commissionJob.stop();
    outstandingBalanceJob.stop();
  });

  console.log('✅ Scheduled jobs started');
}
