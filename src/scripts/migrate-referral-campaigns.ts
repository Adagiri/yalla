import mongoose from 'mongoose';
import ReferralCampaign from '../features/referral/referral-campaign.model';

async function migrateReferralCampaigns() {
  console.log('Starting referral campaign migration...');

  const campaigns = await ReferralCampaign.find({});
  let migratedCount = 0;

  for (const campaign of campaigns) {
    // Skip if already migrated (has constraints array with items)
    if (campaign.constraints && campaign.constraints.length > 0) {
      console.log(`Campaign ${campaign.name} already migrated, skipping...`);
      continue;
    }

    // Build new constraints array
    const newConstraints: any[] = [];
    if (campaign.minWalletBalance && campaign.minWalletBalance > 0) {
      newConstraints.push({
        constraintType: 'MIN_WALLET_BALANCE',
        appliesTo: 'BOTH',
        value: campaign.minWalletBalance,
      });
    }

    // Build new referrer rewards array
    const newReferrerRewards: any[] = [];
    if (campaign.referrerRewardType && campaign.referrerRewardType !== 'NONE') {
      newReferrerRewards.push({
        rewardType: campaign.referrerRewardType,
        value: campaign.referrerRewardValue || 0,
        maxValue: campaign.referrerRewardMaxValue,
      });
    }

    // Build new referee rewards array
    const newRefereeRewards: any[] = [];
    if (campaign.refereeRewardType && campaign.refereeRewardType !== 'NONE') {
      newRefereeRewards.push({
        rewardType: campaign.refereeRewardType,
        value: campaign.refereeRewardValue || 0,
        maxValue: campaign.refereeRewardMaxValue,
      });
    }

    // Update campaign
    await ReferralCampaign.updateOne(
      { _id: campaign._id },
      {
        $set: {
          constraints: newConstraints,
          referrerRewards: newReferrerRewards,
          refereeRewards: newRefereeRewards,
        },
        // Keep old fields for rollback safety (can remove later)
        // Uncomment the lines below to remove old fields after migration is confirmed successful
        // $unset: {
        //   minWalletBalance: 1,
        //   referrerRewardType: 1,
        //   referrerRewardValue: 1,
        //   referrerRewardMaxValue: 1,
        //   refereeRewardType: 1,
        //   refereeRewardValue: 1,
        //   refereeRewardMaxValue: 1,
        // }
      }
    );

    migratedCount++;
    console.log(`✓ Migrated campaign: ${campaign.name}`);
    console.log(`  - Constraints: ${newConstraints.length}`);
    console.log(`  - Referrer Rewards: ${newReferrerRewards.length}`);
    console.log(`  - Referee Rewards: ${newRefereeRewards.length}`);
  }

  console.log(`\nMigration complete. Migrated ${migratedCount} campaigns.`);
}

// Run migration
if (require.main === module) {
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/yalla';

  mongoose
    .connect(MONGODB_URI)
    .then(async () => {
      console.log('Connected to MongoDB');
      await migrateReferralCampaigns();
      await mongoose.disconnect();
      console.log('Disconnected from MongoDB');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

export default migrateReferralCampaigns;
