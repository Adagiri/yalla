import cron from 'node-cron';
import OutstandingBalanceService from '../services/outstanding-balance.service';

/**
 * Cron job to charge outstanding balances from customers
 * Runs once daily at 2 AM to retry failed payments
 * Cron expression: 0 2 * * * = Every day at 2:00 AM
 */
export const startOutstandingBalanceJob = () => {
  // Run daily at 2 AM (when server load is typically lower)
  const job = cron.schedule('0 2 * * *', async () => {
    console.log('⏰ Running outstanding balance charging job...');

    try {
      const result =
        await OutstandingBalanceService.processOutstandingBalances();
      console.log('✅ Outstanding balance job completed:', result);
    } catch (error: any) {
      console.error('❌ Outstanding balance job failed:', error);
    }
  });

  console.log('🚀 Outstanding balance cron job started (runs daily at 2 AM)');

  return job;
};

// Optional: Manual trigger for testing
export const triggerOutstandingBalanceCollection = async () => {
  console.log('🔧 Manually triggering outstanding balance collection...');
  return await OutstandingBalanceService.processOutstandingBalances();
};
