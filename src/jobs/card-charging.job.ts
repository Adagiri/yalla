import cron from 'node-cron';
import OutstandingBalanceService from '../services/outstanding-balance.service';


// Cron job to charge outstanding balances from customer cards
// Runs every 3 days at 2 AM
// Cron expression: 0 2 */3 * * = Every 3 days at 2:00 AM

export const startCardChargingJob = () => {
  const job = cron.schedule('0 2 */3 * *', async () => {
    console.log('⏰ Running card charging job (every 3 days)...');

    try {
      const result =
        await OutstandingBalanceService.processOutstandingBalances();
      console.log('✅ Card charging job completed:', result);
    } catch (error: any) {
      console.error('❌ Card charging job failed:', error);
    }
  });

  console.log('🚀 Card charging cron job started (runs every 3 days at 2 AM)');

  return job;
};

// Manual trigger for testing
export const triggerCardCharging = async () => {
  console.log('🔧 Manually triggering card charging...');
  return await OutstandingBalanceService.processOutstandingBalances();
};