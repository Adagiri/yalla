# Backend Implementation Guide: Referral System Refactor

## OBJECTIVE
Refactor the referral system backend to use modular, reusable constraint and reward definitions instead of hardcoded values in campaigns.

---

## CURRENT PROBLEM
- Constraints are hardcoded in campaign model (`minWalletBalance`)
- Rewards are hardcoded enums (`referrerRewardType`, `refereeRewardType`)
- Cannot add new constraint/reward types without code changes
- No way to select "NONE" for no constraint/reward

---

## NEW BACKEND ARCHITECTURE

### 1. Constraint Definition Model
**File:** `src/features/referral/constraint-definition.model.ts`

**Fields:**
```typescript
{
  type: String, // enum: NONE, MIN_WALLET_BALANCE, MIN_TRIP_COUNT, ACCOUNT_AGE_DAYS, VERIFIED_ACCOUNT, COMPLETED_PROFILE, FIRST_TRIP_COMPLETED, MIN_RATING
  name: String, // Display name (e.g., "Minimum Wallet Balance")
  description: String, // User-friendly explanation
  valueType: String, // enum: NUMBER, BOOLEAN, NONE
  defaultValue: Mixed, // Suggested default
  appliesTo: String, // enum: REFERRER, REFEREE, BOTH
  isActive: Boolean, // Can be used in campaigns
  isSystemDefined: Boolean, // Cannot be deleted (protect base constraints)
  unit: String, // "NGN", "trips", "days" (for UI display)
  minValue: Number, // Validation hint for admin UI
  maxValue: Number, // Validation hint for admin UI
  createdBy: String, // Admin ID
  lastModifiedBy: String, // Admin ID
  createdAt: Date,
  updatedAt: Date
}
```

**Example Document:**
```json
{
  "type": "MIN_WALLET_BALANCE",
  "name": "Minimum Wallet Balance",
  "description": "User must have at least this amount in their wallet",
  "valueType": "NUMBER",
  "defaultValue": 200000,
  "appliesTo": "BOTH",
  "unit": "NGN (kobo)",
  "minValue": 0,
  "isSystemDefined": true
}
```

### 2. Reward Definition Model
**File:** `src/features/referral/reward-definition.model.ts`

**Fields:**
```typescript
{
  type: String, // enum: NONE, FREE_RIDE, WALLET_CREDIT, DISCOUNT_PERCENTAGE, DISCOUNT_FIXED, SUBSCRIPTION_DISCOUNT, BONUS_POINTS
  name: String, // Display name (e.g., "Free Ride")
  description: String, // User-friendly explanation
  valueType: String, // enum: NUMBER, PERCENTAGE, NONE
  defaultValue: Number, // Suggested default
  isActive: Boolean, // Can be used in campaigns
  isSystemDefined: Boolean, // Cannot be deleted
  unit: String, // "rides", "NGN", "%" (for UI display)
  minValue: Number, // Validation hint
  maxValue: Number, // Validation hint
  requiresMaxValue: Boolean, // True for DISCOUNT_PERCENTAGE
  createdBy: String, // Admin ID
  lastModifiedBy: String, // Admin ID
  createdAt: Date,
  updatedAt: Date
}
```

**Example Document:**
```json
{
  "type": "FREE_RIDE",
  "name": "Free Ride",
  "description": "Award a number of free rides",
  "valueType": "NUMBER",
  "defaultValue": 1,
  "unit": "rides",
  "minValue": 1,
  "maxValue": 10,
  "isSystemDefined": true
}
```

### 3. Campaign Model Updates
**File:** `src/features/referral/referral-campaign.model.ts`

**REMOVE these fields:**
- `minWalletBalance`
- `referrerRewardType`
- `referrerRewardValue`
- `referrerRewardMaxValue`
- `refereeRewardType`
- `refereeRewardValue`
- `refereeRewardMaxValue`

**ADD these fields:**
```typescript
{
  constraints: [
    {
      constraintType: String, // References ConstraintType enum
      appliesTo: String, // REFERRER, REFEREE, BOTH
      value: Mixed, // number or boolean
      userTypes: [String] // Optional: ['CUSTOMER', 'DRIVER']
    }
  ],

  referrerRewards: [
    {
      rewardType: String, // References RewardType enum
      value: Number,
      maxValue: Number // Optional: for DISCOUNT_PERCENTAGE
    }
  ],

  refereeRewards: [
    {
      rewardType: String,
      value: Number,
      maxValue: Number // Optional
    }
  ]
}
```

**Example Campaign Document:**
```json
{
  "name": "Holiday Special",
  "constraints": [
    {
      "constraintType": "MIN_WALLET_BALANCE",
      "appliesTo": "BOTH",
      "value": 500000,
      "userTypes": ["CUSTOMER"]
    },
    {
      "constraintType": "MIN_TRIP_COUNT",
      "appliesTo": "REFERRER",
      "value": 5
    }
  ],
  "referrerRewards": [
    {
      "rewardType": "FREE_RIDE",
      "value": 2
    },
    {
      "rewardType": "WALLET_CREDIT",
      "value": 100000
    }
  ],
  "refereeRewards": [
    {
      "rewardType": "DISCOUNT_PERCENTAGE",
      "value": 20,
      "maxValue": 200000
    }
  ]
}
```

---

## IMPLEMENTATION STEPS

### Step 1: Create New Models
1. Create `src/features/referral/constraint-definition.model.ts`
2. Create `src/features/referral/reward-definition.model.ts`
3. Both models should have proper TypeScript interfaces and Mongoose schemas
4. Add appropriate indexes for query performance
5. Add virtuals/transforms if needed

### Step 2: Update Campaign Model
1. **IMPORTANT:** Backup current `referral-campaign.model.ts`
2. Remove old hardcoded fields
3. Add `constraints`, `referrerRewards`, `refereeRewards` arrays
4. Update virtuals/transforms to handle new structure
5. Keep backward compatibility during migration (support both old and new structure temporarily)

### Step 3: Create Seeder Script
**File:** `src/features/referral/seed-referral-definitions.ts`

**Purpose:** Populate base constraint and reward definitions

**Constraints to seed:**
```typescript
[
  {
    type: 'NONE',
    name: 'No Constraint',
    description: 'No constraint required',
    valueType: 'NONE',
    appliesTo: 'BOTH',
    isSystemDefined: true
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
    isSystemDefined: true
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
    isSystemDefined: true
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
    isSystemDefined: true
  },
  {
    type: 'VERIFIED_ACCOUNT',
    name: 'Verified Account',
    description: 'Account must be verified (email/phone)',
    valueType: 'BOOLEAN',
    defaultValue: true,
    appliesTo: 'BOTH',
    isSystemDefined: true
  },
  {
    type: 'COMPLETED_PROFILE',
    name: 'Completed Profile',
    description: 'User must have a complete profile',
    valueType: 'BOOLEAN',
    defaultValue: true,
    appliesTo: 'BOTH',
    isSystemDefined: true
  },
  {
    type: 'FIRST_TRIP_COMPLETED',
    name: 'First Trip Completed',
    description: 'User must have completed their first trip',
    valueType: 'BOOLEAN',
    defaultValue: true,
    appliesTo: 'BOTH',
    isSystemDefined: true
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
    isSystemDefined: true
  }
]
```

**Rewards to seed:**
```typescript
[
  {
    type: 'NONE',
    name: 'No Reward',
    description: 'No reward given',
    valueType: 'NONE',
    isSystemDefined: true
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
    isSystemDefined: true
  },
  {
    type: 'WALLET_CREDIT',
    name: 'Wallet Credit',
    description: 'Add credit to wallet',
    valueType: 'NUMBER',
    defaultValue: 100000,
    unit: 'NGN (kobo)',
    minValue: 0,
    isSystemDefined: true
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
    isSystemDefined: true
  },
  {
    type: 'DISCOUNT_FIXED',
    name: 'Fixed Discount',
    description: 'Fixed amount off next ride',
    valueType: 'NUMBER',
    defaultValue: 50000,
    unit: 'NGN (kobo)',
    minValue: 0,
    isSystemDefined: true
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
    isSystemDefined: true
  },
  {
    type: 'BONUS_POINTS',
    name: 'Bonus Points',
    description: 'Award bonus loyalty points',
    valueType: 'NUMBER',
    defaultValue: 100,
    unit: 'points',
    minValue: 0,
    isSystemDefined: true
  }
]
```

### Step 4: Update GraphQL Schemas

**File:** `src/features/referral/referral.admin.gql`

**Add new types:**
```graphql
# Constraint Definition Types
type ConstraintDefinition {
  id: ID!
  type: String!
  name: String!
  description: String!
  valueType: String!
  defaultValue: JSON
  appliesTo: String!
  isActive: Boolean!
  isSystemDefined: Boolean!
  unit: String
  minValue: Float
  maxValue: Float
  createdBy: String!
  lastModifiedBy: String!
  createdAt: DateTime!
  updatedAt: DateTime!
}

# Reward Definition Types
type RewardDefinition {
  id: ID!
  type: String!
  name: String!
  description: String!
  valueType: String!
  defaultValue: Float
  isActive: Boolean!
  isSystemDefined: Boolean!
  unit: String
  minValue: Float
  maxValue: Float
  requiresMaxValue: Boolean!
  createdBy: String!
  lastModifiedBy: String!
  createdAt: DateTime!
  updatedAt: DateTime!
}

# Campaign Constraint Instance
type CampaignConstraint {
  constraintType: String!
  appliesTo: String!
  value: JSON
  userTypes: [String!]
}

# Campaign Reward Instance
type CampaignReward {
  rewardType: String!
  value: Float!
  maxValue: Float
}

# Input Types
input CampaignConstraintInput {
  constraintType: String!
  appliesTo: String!
  value: JSON
  userTypes: [String!]
}

input CampaignRewardInput {
  rewardType: String!
  value: Float!
  maxValue: Float
}

input CreateConstraintDefinitionInput {
  type: String!
  name: String!
  description: String!
  valueType: String!
  defaultValue: JSON
  appliesTo: String!
  unit: String
  minValue: Float
  maxValue: Float
}

input CreateRewardDefinitionInput {
  type: String!
  name: String!
  description: String!
  valueType: String!
  defaultValue: Float
  unit: String
  minValue: Float
  maxValue: Float
  requiresMaxValue: Boolean
}
```

**Update ReferralCampaign type:**
```graphql
type ReferralCampaign {
  id: ID!
  name: String!
  description: String
  type: String!
  status: String!
  startDate: DateTime!
  endDate: DateTime
  isActive: Boolean!

  # NEW: Arrays instead of hardcoded fields
  constraints: [CampaignConstraint!]!
  referrerRewards: [CampaignReward!]!
  refereeRewards: [CampaignReward!]!

  # Rest of existing fields...
}
```

**Update CreateCampaignInput:**
```graphql
input CreateCampaignInput {
  name: String!
  description: String
  type: String!
  startDate: DateTime!
  endDate: DateTime

  # NEW: Arrays of constraints and rewards
  constraints: [CampaignConstraintInput!]!
  referrerRewards: [CampaignRewardInput!]!
  refereeRewards: [CampaignRewardInput!]!

  # Rest of existing fields...
}
```

**Add new queries:**
```graphql
extend type Query {
  # List all constraint definitions
  listConstraintDefinitions(activeOnly: Boolean): [ConstraintDefinition!]!

  # List all reward definitions
  listRewardDefinitions(activeOnly: Boolean): [RewardDefinition!]!

  # Get specific definitions
  getConstraintDefinition(id: ID!): ConstraintDefinition!
  getRewardDefinition(id: ID!): RewardDefinition!
}
```

**Add new mutations:**
```graphql
extend type Mutation {
  # Constraint Definition Management
  createConstraintDefinition(input: CreateConstraintDefinitionInput!): ConstraintDefinition!
  updateConstraintDefinition(id: ID!, input: CreateConstraintDefinitionInput!): ConstraintDefinition!
  toggleConstraintDefinition(id: ID!, isActive: Boolean!): ConstraintDefinition!
  deleteConstraintDefinition(id: ID!): Boolean! # Only if not system-defined

  # Reward Definition Management
  createRewardDefinition(input: CreateRewardDefinitionInput!): RewardDefinition!
  updateRewardDefinition(id: ID!, input: CreateRewardDefinitionInput!): RewardDefinition!
  toggleRewardDefinition(id: ID!, isActive: Boolean!): RewardDefinition!
  deleteRewardDefinition(id: ID!): Boolean! # Only if not system-defined

  # Seed initial data
  seedReferralDefinitions: Boolean!
}
```

### Step 5: Update Services

**File:** `src/features/referral/referral-admin.service.ts`

**Add methods:**
```typescript
// Constraint Definition CRUD
async createConstraintDefinition(input, adminId) {
  // Validate input
  // Check for duplicate type
  // Create new definition with createdBy = adminId
  // Return created definition
}

async updateConstraintDefinition(id, input, adminId) {
  // Find definition
  // Check if system-defined (allow updates but protect certain fields)
  // Update with lastModifiedBy = adminId
  // Return updated definition
}

async toggleConstraintDefinition(id, isActive) {
  // Find definition
  // Update isActive field
  // Return updated definition
}

async deleteConstraintDefinition(id) {
  // Find definition
  // Check !isSystemDefined (throw error if system-defined)
  // Check not used in any active campaigns
  // Delete definition
  // Return true
}

async listConstraintDefinitions(activeOnly) {
  // Query with optional filter
  // Return sorted list (by name)
}

// Reward Definition CRUD
async createRewardDefinition(input, adminId) {
  // Similar to constraint creation
}

async updateRewardDefinition(id, input, adminId) {
  // Similar to constraint update
}

async toggleRewardDefinition(id, isActive) {
  // Similar to constraint toggle
}

async deleteRewardDefinition(id) {
  // Similar to constraint deletion
  // Check !isSystemDefined
  // Check not used in campaigns
}

async listRewardDefinitions(activeOnly) {
  // Query with optional filter
  // Return sorted list (by name)
}

// Seeder
async seedReferralDefinitions() {
  // Seed all base constraints (if not exists)
  // Seed all base rewards (if not exists)
  // Use upsert to avoid duplicates
  // Return true
}
```

**Update createCampaign method:**
```typescript
async createCampaign(input) {
  // Validate constraint types exist in ConstraintDefinition
  for (const constraint of input.constraints) {
    const definition = await ConstraintDefinition.findOne({
      type: constraint.constraintType,
      isActive: true
    });
    if (!definition) {
      throw new Error(`Invalid constraint type: ${constraint.constraintType}`);
    }
  }

  // Validate reward types exist in RewardDefinition
  for (const reward of input.referrerRewards) {
    const definition = await RewardDefinition.findOne({
      type: reward.rewardType,
      isActive: true
    });
    if (!definition) {
      throw new Error(`Invalid reward type: ${reward.rewardType}`);
    }
  }

  for (const reward of input.refereeRewards) {
    const definition = await RewardDefinition.findOne({
      type: reward.rewardType,
      isActive: true
    });
    if (!definition) {
      throw new Error(`Invalid reward type: ${reward.rewardType}`);
    }
  }

  // Convert monetary values to kobo if needed
  // Create campaign
  // Return created campaign
}
```

**File:** `src/features/referral/referral.service.ts`

**Update checkReferralQualification method:**
```typescript
async checkReferralQualification(campaign, referrer, referee) {
  // Loop through campaign.constraints
  for (const constraint of campaign.constraints) {
    const passes = await this.checkConstraint(constraint, referrer, referee);
    if (!passes) {
      return {
        qualified: false,
        reason: `Failed constraint: ${constraint.constraintType}`
      };
    }
  }

  return { qualified: true };
}
```

**Add constraint checking logic:**
```typescript
async checkConstraint(
  constraint: CampaignConstraint,
  referrer: User,
  referee: User
): Promise<boolean> {
  // Skip NONE constraint
  if (constraint.constraintType === 'NONE') {
    return true;
  }

  // Determine which users to check
  const usersToCheck =
    constraint.appliesTo === 'REFERRER' ? [referrer] :
    constraint.appliesTo === 'REFEREE' ? [referee] :
    [referrer, referee];

  for (const user of usersToCheck) {
    // User type filter
    if (constraint.userTypes?.length &&
        !constraint.userTypes.includes(user.accountType)) {
      continue;
    }

    // Check based on constraintType
    switch (constraint.constraintType) {
      case 'MIN_WALLET_BALANCE':
        const wallet = await Wallet.findOne({ userId: user._id });
        if (!wallet || wallet.balance < constraint.value) {
          return false;
        }
        break;

      case 'MIN_TRIP_COUNT':
        const tripCount = await Trip.countDocuments({
          [user.accountType === 'DRIVER' ? 'driverId' : 'customerId']: user._id,
          status: 'COMPLETED'
        });
        if (tripCount < constraint.value) {
          return false;
        }
        break;

      case 'ACCOUNT_AGE_DAYS':
        const accountAge = (Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24);
        if (accountAge < constraint.value) {
          return false;
        }
        break;

      case 'VERIFIED_ACCOUNT':
        if (!user.isEmailVerified && !user.isPhoneVerified) {
          return false;
        }
        break;

      case 'COMPLETED_PROFILE':
        // Check if user has completed all required profile fields
        if (!this.isProfileComplete(user)) {
          return false;
        }
        break;

      case 'FIRST_TRIP_COMPLETED':
        const hasCompletedTrip = await Trip.exists({
          [user.accountType === 'DRIVER' ? 'driverId' : 'customerId']: user._id,
          status: 'COMPLETED'
        });
        if (!hasCompletedTrip) {
          return false;
        }
        break;

      case 'MIN_RATING':
        if (!user.rating || user.rating < constraint.value) {
          return false;
        }
        break;

      default:
        throw new Error(`Unknown constraint type: ${constraint.constraintType}`);
    }
  }

  return true;
}
```

**Update issueRewards method:**
```typescript
async issueRewards(campaign, referrer, referee) {
  const rewardsIssued = [];

  // Issue referrer rewards
  for (const rewardConfig of campaign.referrerRewards) {
    if (rewardConfig.rewardType === 'NONE') {
      continue;
    }

    const reward = await this.issueReward(
      referrer,
      rewardConfig,
      campaign,
      'REFERRER'
    );
    rewardsIssued.push(reward);
  }

  // Issue referee rewards
  for (const rewardConfig of campaign.refereeRewards) {
    if (rewardConfig.rewardType === 'NONE') {
      continue;
    }

    const reward = await this.issueReward(
      referee,
      rewardConfig,
      campaign,
      'REFEREE'
    );
    rewardsIssued.push(reward);
  }

  return rewardsIssued;
}

async issueReward(user, rewardConfig, campaign, recipientType) {
  // Create ReferralReward document
  // Handle different reward types
  switch (rewardConfig.rewardType) {
    case 'FREE_RIDE':
      // Add free rides to user account
      break;
    case 'WALLET_CREDIT':
      // Add credit to wallet
      break;
    case 'DISCOUNT_PERCENTAGE':
      // Create discount coupon
      break;
    case 'DISCOUNT_FIXED':
      // Create fixed discount coupon
      break;
    // ... handle other types
  }

  return reward;
}
```

### Step 6: Create Admin Resolvers

**File:** `src/features/referral/referral-admin.resolver.ts`

**Add resolvers:**
```typescript
Query: {
  listConstraintDefinitions: async (_, { activeOnly }, { user }) => {
    // Check admin auth
    const filter = activeOnly ? { isActive: true } : {};
    return ConstraintDefinition.find(filter).sort({ name: 1 });
  },

  listRewardDefinitions: async (_, { activeOnly }, { user }) => {
    // Check admin auth
    const filter = activeOnly ? { isActive: true } : {};
    return RewardDefinition.find(filter).sort({ name: 1 });
  },

  getConstraintDefinition: async (_, { id }, { user }) => {
    // Check admin auth
    return ConstraintDefinition.findById(id);
  },

  getRewardDefinition: async (_, { id }, { user }) => {
    // Check admin auth
    return RewardDefinition.findById(id);
  },
},

Mutation: {
  createConstraintDefinition: async (_, { input }, { user }) => {
    // Check admin auth
    return referralAdminService.createConstraintDefinition(input, user.id);
  },

  updateConstraintDefinition: async (_, { id, input }, { user }) => {
    // Check admin auth
    return referralAdminService.updateConstraintDefinition(id, input, user.id);
  },

  toggleConstraintDefinition: async (_, { id, isActive }, { user }) => {
    // Check admin auth
    return referralAdminService.toggleConstraintDefinition(id, isActive);
  },

  deleteConstraintDefinition: async (_, { id }, { user }) => {
    // Check admin auth
    return referralAdminService.deleteConstraintDefinition(id);
  },

  createRewardDefinition: async (_, { input }, { user }) => {
    // Check admin auth
    return referralAdminService.createRewardDefinition(input, user.id);
  },

  updateRewardDefinition: async (_, { id, input }, { user }) => {
    // Check admin auth
    return referralAdminService.updateRewardDefinition(id, input, user.id);
  },

  toggleRewardDefinition: async (_, { id, isActive }, { user }) => {
    // Check admin auth
    return referralAdminService.toggleRewardDefinition(id, isActive);
  },

  deleteRewardDefinition: async (_, { id }, { user }) => {
    // Check admin auth
    return referralAdminService.deleteRewardDefinition(id);
  },

  seedReferralDefinitions: async (_, __, { user }) => {
    // Check admin auth (super admin only)
    return referralAdminService.seedReferralDefinitions();
  },
}
```

### Step 7: Create Data Migration Script

**File:** `src/scripts/migrate-referral-campaigns.ts`

**Purpose:** Convert existing campaigns to new structure

```typescript
import { ReferralCampaign } from '../features/referral/referral-campaign.model';

async function migrateReferralCampaigns() {
  console.log('Starting referral campaign migration...');

  const campaigns = await ReferralCampaign.find({});
  let migratedCount = 0;

  for (const campaign of campaigns) {
    // Skip if already migrated (has constraints array)
    if (campaign.constraints) {
      console.log(`Campaign ${campaign.name} already migrated, skipping...`);
      continue;
    }

    // Build new constraints array
    const newConstraints = [];
    if (campaign.minWalletBalance) {
      newConstraints.push({
        constraintType: 'MIN_WALLET_BALANCE',
        appliesTo: 'BOTH',
        value: campaign.minWalletBalance
      });
    }

    // Build new referrer rewards array
    const newReferrerRewards = [];
    if (campaign.referrerRewardType && campaign.referrerRewardType !== 'NONE') {
      newReferrerRewards.push({
        rewardType: campaign.referrerRewardType,
        value: campaign.referrerRewardValue,
        maxValue: campaign.referrerRewardMaxValue
      });
    }

    // Build new referee rewards array
    const newRefereeRewards = [];
    if (campaign.refereeRewardType && campaign.refereeRewardType !== 'NONE') {
      newRefereeRewards.push({
        rewardType: campaign.refereeRewardType,
        value: campaign.refereeRewardValue,
        maxValue: campaign.refereeRewardMaxValue
      });
    }

    // Update campaign
    await ReferralCampaign.updateOne(
      { _id: campaign._id },
      {
        $set: {
          constraints: newConstraints,
          referrerRewards: newReferrerRewards,
          refereeRewards: newRefereeRewards
        },
        // Keep old fields for rollback safety (can remove later)
        // $unset: {
        //   minWalletBalance: 1,
        //   referrerRewardType: 1,
        //   referrerRewardValue: 1,
        //   referrerRewardMaxValue: 1,
        //   refereeRewardType: 1,
        //   refereeRewardValue: 1,
        //   refereeRewardMaxValue: 1
        // }
      }
    );

    migratedCount++;
    console.log(`Migrated campaign: ${campaign.name}`);
  }

  console.log(`Migration complete. Migrated ${migratedCount} campaigns.`);
}

// Run migration
migrateReferralCampaigns()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
```

---

## FILE STRUCTURE SUMMARY

```
src/features/referral/
├── constraint-definition.model.ts      # NEW - Constraint definition model
├── reward-definition.model.ts          # NEW - Reward definition model
├── referral-campaign.model.ts          # MODIFIED - Updated campaign model
├── referral.service.ts                 # MODIFIED - Updated constraint checking & reward issuance
├── referral-admin.service.ts           # MODIFIED - Added definition CRUD methods
├── referral-admin.resolver.ts          # MODIFIED - Added definition resolvers
├── referral.admin.gql                  # MODIFIED - Added new types, queries, mutations
├── seed-referral-definitions.ts        # NEW - Seeder script

src/scripts/
├── migrate-referral-campaigns.ts       # NEW - Migration script for existing campaigns
```

---

## TESTING CHECKLIST

### Unit Tests
- [ ] Test ConstraintDefinition model validation
- [ ] Test RewardDefinition model validation
- [ ] Test updated Campaign model validation
- [ ] Test constraint checking logic for each type
- [ ] Test reward issuance logic for each type
- [ ] Test definition CRUD operations
- [ ] Test system-defined protection (cannot delete)

### Integration Tests
- [ ] Seed initial definitions successfully
- [ ] Create campaign with multiple constraints
- [ ] Create campaign with NONE constraint
- [ ] Create campaign with multiple rewards per recipient
- [ ] Create campaign with NONE reward
- [ ] Test qualification logic with combined constraints
- [ ] Test reward issuance with multiple rewards
- [ ] Run migration script on existing campaigns
- [ ] Verify migrated campaigns work correctly
- [ ] Test creating custom constraint/reward definitions
- [ ] Test deleting non-system-defined definitions
- [ ] Test GraphQL queries and mutations

### Edge Cases
- [ ] Empty constraints array (should default to NONE)
- [ ] Empty rewards array (should default to NONE)
- [ ] Constraint applies to CUSTOMER only, referrer is DRIVER
- [ ] Multiple constraints on same user (all must pass)
- [ ] Percentage discount with maxValue capping
- [ ] Invalid constraint/reward type references

---

## KEY PRINCIPLES

1. **Backward Compatibility:** Keep old campaigns working during migration period
2. **Validation:** Always validate constraint/reward types exist and are active before campaign creation
3. **System-Defined Protection:** Cannot delete base constraint/reward types
4. **Extensibility:** Easy to add new types via admin panel without code changes
5. **Performance:** Add appropriate indexes for queries
6. **Atomic Operations:** Use transactions where appropriate
7. **Error Handling:** Clear error messages for validation failures

---

## IMPLEMENTATION ORDER

1. ✅ Create ConstraintDefinition model
2. ✅ Create RewardDefinition model
3. ✅ Create seeder script
4. ✅ Update Campaign model (add new fields, keep old for migration)
5. ✅ Update GraphQL schemas
6. ✅ Update admin service (definition CRUD)
7. ✅ Update referral service (constraint checking, reward issuance)
8. ✅ Create admin resolvers
9. ✅ Run seeder to populate definitions
10. ✅ Create and run migration script for existing campaigns
11. ✅ Test thoroughly
12. ✅ Remove old fields from Campaign model (after successful migration)

---

END OF BACKEND IMPLEMENTATION GUIDE
