import mongoose from 'mongoose';
import ConstraintDefinition from './constraint-definition.model';
import RewardDefinition from './reward-definition.model';

const constraintSeeds = [
  {
    type: 'NONE',
    name: 'No Constraint',
    description: 'No constraint required',
    valueType: 'NONE',
    appliesTo: 'BOTH',
    isSystemDefined: true,
    isActive: true,
  },
  {
    type: 'MIN_WALLET_BALANCE',
    name: 'Minimum Wallet Balance',
    description: 'User must have at least this amount in wallet',
    valueType: 'NUMBER',
    defaultValue: 200000,
    appliesTo: 'BOTH',
    unit: 'NGN (kobo)',
    minValue: 0,
    isSystemDefined: true,
    isActive: true,
  },
  {
    type: 'MIN_TRIP_COUNT',
    name: 'Minimum Trip Count',
    description: 'User must have completed at least this many trips',
    valueType: 'NUMBER',
    defaultValue: 1,
    appliesTo: 'BOTH',
    unit: 'trips',
    minValue: 0,
    isSystemDefined: true,
    isActive: true,
  },
  {
    type: 'ACCOUNT_AGE_DAYS',
    name: 'Account Age (Days)',
    description: 'Account must be at least this many days old',
    valueType: 'NUMBER',
    defaultValue: 7,
    appliesTo: 'BOTH',
    unit: 'days',
    minValue: 0,
    isSystemDefined: true,
    isActive: true,
  },
  {
    type: 'VERIFIED_ACCOUNT',
    name: 'Verified Account',
    description: 'Account must be verified (email/phone)',
    valueType: 'BOOLEAN',
    defaultValue: true,
    appliesTo: 'BOTH',
    isSystemDefined: true,
    isActive: true,
  },
  {
    type: 'COMPLETED_PROFILE',
    name: 'Completed Profile',
    description: 'User must have a complete profile',
    valueType: 'BOOLEAN',
    defaultValue: true,
    appliesTo: 'BOTH',
    isSystemDefined: true,
    isActive: true,
  },
  {
    type: 'FIRST_TRIP_COMPLETED',
    name: 'First Trip Completed',
    description: 'User must have completed their first trip',
    valueType: 'BOOLEAN',
    defaultValue: true,
    appliesTo: 'BOTH',
    isSystemDefined: true,
    isActive: true,
  },
  {
    type: 'MIN_RATING',
    name: 'Minimum Rating',
    description: 'User must have a minimum rating',
    valueType: 'NUMBER',
    defaultValue: 4.0,
    appliesTo: 'BOTH',
    unit: 'stars',
    minValue: 1.0,
    maxValue: 5.0,
    isSystemDefined: true,
    isActive: true,
  },
];

const rewardSeeds = [
  {
    type: 'NONE',
    name: 'No Reward',
    description: 'No reward given',
    valueType: 'NONE',
    isSystemDefined: true,
    isActive: true,
  },
  {
    type: 'FREE_RIDE',
    name: 'Free Ride',
    description: 'Award free rides',
    valueType: 'NUMBER',
    defaultValue: 1,
    unit: 'rides',
    minValue: 1,
    maxValue: 10,
    isSystemDefined: true,
    isActive: true,
  },
  {
    type: 'WALLET_CREDIT',
    name: 'Wallet Credit',
    description: 'Add credit to wallet',
    valueType: 'NUMBER',
    defaultValue: 100000,
    unit: 'NGN (kobo)',
    minValue: 0,
    isSystemDefined: true,
    isActive: true,
  },
  {
    type: 'DISCOUNT_PERCENTAGE',
    name: 'Percentage Discount',
    description: 'Percentage off next ride(s)',
    valueType: 'PERCENTAGE',
    defaultValue: 10,
    unit: '%',
    minValue: 1,
    maxValue: 100,
    requiresMaxValue: true,
    isSystemDefined: true,
    isActive: true,
  },
  {
    type: 'DISCOUNT_FIXED',
    name: 'Fixed Discount',
    description: 'Fixed amount off next ride',
    valueType: 'NUMBER',
    defaultValue: 50000,
    unit: 'NGN (kobo)',
    minValue: 0,
    isSystemDefined: true,
    isActive: true,
  },
  {
    type: 'SUBSCRIPTION_DISCOUNT',
    name: 'Subscription Discount',
    description: 'Discount on subscription plans',
    valueType: 'PERCENTAGE',
    defaultValue: 20,
    unit: '%',
    minValue: 1,
    maxValue: 100,
    isSystemDefined: true,
    isActive: true,
  },
  {
    type: 'BONUS_POINTS',
    name: 'Bonus Points',
    description: 'Award bonus loyalty points',
    valueType: 'NUMBER',
    defaultValue: 100,
    unit: 'points',
    minValue: 0,
    isSystemDefined: true,
    isActive: true,
  },
];

export async function seedReferralDefinitions(): Promise<boolean> {
  try {
    console.log('Starting referral definitions seed...');

    // Seed constraint definitions
    console.log('Seeding constraint definitions...');
    for (const constraint of constraintSeeds) {
      await ConstraintDefinition.findOneAndUpdate(
        { type: constraint.type },
        constraint,
        { upsert: true, new: true }
      );
      console.log(`✓ Seeded constraint: ${constraint.name}`);
    }

    // Seed reward definitions
    console.log('Seeding reward definitions...');
    for (const reward of rewardSeeds) {
      await RewardDefinition.findOneAndUpdate(
        { type: reward.type },
        reward,
        { upsert: true, new: true }
      );
      console.log(`✓ Seeded reward: ${reward.name}`);
    }

    console.log('Referral definitions seed completed successfully!');
    return true;
  } catch (error) {
    console.error('Error seeding referral definitions:', error);
    throw error;
  }
}

// Allow running directly
if (require.main === module) {
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/yalla';

  mongoose
    .connect(MONGODB_URI)
    .then(async () => {
      console.log('Connected to MongoDB');
      await seedReferralDefinitions();
      await mongoose.disconnect();
      console.log('Disconnected from MongoDB');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Seed failed:', error);
      process.exit(1);
    });
}
