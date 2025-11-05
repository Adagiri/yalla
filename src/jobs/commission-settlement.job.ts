import cron from 'node-cron';
import CommissionSettlementService from '../services/commission-settlement.service';


//  * Cron job to settle driver commissions every 10 minutes
//  * Cron expression: */10 * * * * = Every 10 minutes

export const startCommissionSettlementJob = () => {
  // Run every 10 minutes
  const job = cron.schedule('*/10 * * * *', async () => {
    console.log('⏰ Running commission settlement job...');

    try {
      const result =
        await CommissionSettlementService.processAllCommissionSettlements();
      console.log('✅ Commission settlement job completed:', result);
    } catch (error: any) {
      console.error('❌ Commission settlement job failed:', error);
    }
  });

  console.log('🚀 Commission settlement cron job started (runs every 10 minutes)');

  return job;
};

// Optional: Manual trigger for testing
export const triggerCommissionSettlement = async () => {
  console.log('🔧 Manually triggering commission settlement...');
  return await CommissionSettlementService.processAllCommissionSettlements();
};