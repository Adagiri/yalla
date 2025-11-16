import SubscriptionService from '../features/subscription/subscription.service';
import { startCommissionSettlementJob } from '../jobs/commission-settlement.job';
import { startWalletBalanceClearanceJob } from '../jobs/wallet-balance-clearance.job';
import { startCardChargingJob } from '../jobs/card-charging.job';

/**
 * Start all scheduled jobs
 */
export function startScheduledJobs() {
  console.log('🕐 Starting scheduled jobs...');

  // Start auto-renewal job (run every hour) - Keep existing setInterval for this
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

  // NEW: Wallet balance clearance job (every 1 minute)
  const walletClearanceJob = startWalletBalanceClearanceJob();

  // NEW: Card charging job (every 3 days at 2 AM)
  const cardChargingJob = startCardChargingJob();

  // Graceful shutdown handler
  process.on('SIGTERM', () => {
    console.log('🛑 Stopping scheduled jobs...');
    clearInterval(autoRenewalInterval);
    commissionJob.stop();
    walletClearanceJob.stop();
    cardChargingJob.stop();
  });

  process.on('SIGINT', () => {
    console.log('🛑 Stopping scheduled jobs...');
    clearInterval(autoRenewalInterval);
    commissionJob.stop();
    walletClearanceJob.stop();
    cardChargingJob.stop();
  });

  console.log('✅ Scheduled jobs started');
}
