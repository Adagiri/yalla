import cron from 'node-cron';
import referralService from '../features/referral/referral.service';

/**
 * Cron job to check pending referrals and issue rewards
 * Runs every hour to check if users have met wallet balance requirements
 * Cron expression: 0 * * * * = Every hour at minute 0
 */
export const startReferralCheckJob = () => {
  // Run every hour
  const job = cron.schedule('0 * * * *', async () => {
    console.log('⏰ Running referral qualification check job...');

    try {
      await referralService.checkPendingReferrals();
      console.log('✅ Referral check job completed');
    } catch (error: any) {
      console.error('❌ Referral check job failed:', error);
    }
  });

  console.log('🚀 Referral check cron job started (runs hourly)');

  return job;
};

/**
 * Cron job to expire old rewards
 * Runs once daily at 3 AM
 * Cron expression: 0 3 * * * = Every day at 3:00 AM
 */
export const startRewardExpiryJob = () => {
  // Run daily at 3 AM
  const job = cron.schedule('0 3 * * *', async () => {
    console.log('⏰ Running reward expiry job...');

    try {
      await referralService.expireOldRewards();
      console.log('✅ Reward expiry job completed');
    } catch (error: any) {
      console.error('❌ Reward expiry job failed:', error);
    }
  });

  console.log('🚀 Reward expiry cron job started (runs daily at 3 AM)');

  return job;
};

// Optional: Manual trigger for testing
export const triggerReferralCheck = async () => {
  console.log('🔧 Manually triggering referral qualification check...');
  await referralService.checkPendingReferrals();
};

export const triggerRewardExpiry = async () => {
  console.log('🔧 Manually triggering reward expiry...');
  await referralService.expireOldRewards();
};
