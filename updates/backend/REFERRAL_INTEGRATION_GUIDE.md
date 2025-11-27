# Backend Referral System Integration Guide

## 📦 Overview

This guide covers integrating the complete referral system into your backend. The system is production-ready and includes campaigns, transactions, rewards, and background processing.

## 📁 Files to Copy

All files are in `updates/backend/src/`:

### New Files (Copy as-is)
```
src/features/referral/
├── referral-admin.resolver.ts       # Admin GraphQL resolver
├── referral-admin.service.ts        # Admin business logic
├── referral-campaign.model.ts       # Campaign model
├── referral-code.model.ts           # Referral code model
├── referral-reward.model.ts         # Reward model
├── referral-transaction.model.ts    # Transaction model
├── referral.admin.gql               # Admin GraphQL schema
├── referral.resolver.ts             # User GraphQL resolver
├── referral.service.ts              # User business logic
└── referral.types.gql               # User GraphQL schema

src/jobs/
└── referral.job.ts                  # Background job for qualification checks
```

### Files to Merge (Have modifications)
```
src/features/customer/
├── customer.ops.gql                 # Added referralCode input
├── customer.service.ts              # Added referral code processing
└── customer.type.ts                 # Added referral code field

src/services/
└── scheduled-jobs.ts                # Added referral job scheduling
```

## 🚀 Integration Steps

### 1. Copy New Files

```bash
# Copy referral feature
cp -r updates/backend/src/features/referral /path/to/backend/src/features/

# Copy referral job
cp updates/backend/src/jobs/referral.job.ts /path/to/backend/src/jobs/
```

### 2. Merge Modified Files

#### A. Customer Registration (customer.ops.gql)

**Add to RegisterCustomerInput:**
```graphql
input RegisterCustomerInput {
  phone: PhoneInput!
  password: String!
  authChannel: AuthChannel!
  referralCode: String  # Add this line
}
```

#### B. Customer Service (customer.service.ts)

**Add referral code processing in registration:**

Find the `registerCustomer` method and add after wallet creation:

```typescript
// Apply referral code if provided
if (referralCode) {
  try {
    await ReferralService.applyReferralCode(
      customer._id,
      AccountType_.CUSTOMER,
      referralCode
    );
  } catch (error) {
    // Log but don't fail registration
    console.error('Failed to apply referral code:', error);
  }
}
```

**Add import:**
```typescript
import ReferralService from '../referral/referral.service';
```

#### C. Customer Type (customer.type.ts)

**Add referral code field:**
```typescript
export const registerCustomerType = Joi.object({
  // ... existing fields
  referralCode: Joi.string().optional(), // Add this line
});
```

#### D. Scheduled Jobs (scheduled-jobs.ts)

**Add referral job import:**
```typescript
import { processReferralQualifications } from '../jobs/referral.job';
```

**Add to scheduled jobs (in the setup function):**
```typescript
// Check pending referrals every 30 minutes
cron.schedule('*/30 * * * *', async () => {
  try {
    console.log('Running referral qualification check...');
    await processReferralQualifications();
  } catch (error) {
    console.error('Error in referral job:', error);
  }
});
```

### 3. Register GraphQL Schemas

In your GraphQL schema setup file:

```typescript
import { referralResolvers } from './features/referral/referral.resolver';
import { referralAdminResolvers } from './features/referral/referral-admin.resolver';

// Add to resolvers array
const resolvers = [
  // ... existing resolvers
  referralResolvers,
  referralAdminResolvers,
];

// Add to type definitions
const typeDefs = [
  // ... existing schemas
  fs.readFileSync('./src/features/referral/referral.types.gql', 'utf-8'),
  fs.readFileSync('./src/features/referral/referral.admin.gql', 'utf-8'),
];
```

### 4. Initialize Default Campaign (Optional)

Create a default signup campaign:

```typescript
import ReferralCampaign from './features/referral/referral-campaign.model';
import { CampaignType, CampaignStatus, RewardType } from './features/referral/referral-campaign.model';

// In your startup/seed script
async function createDefaultReferralCampaign() {
  const existingCampaign = await ReferralCampaign.findOne({ type: CampaignType.SIGNUP });

  if (!existingCampaign) {
    await ReferralCampaign.create({
      name: 'Standard Signup Referral',
      description: 'Refer friends and earn rewards when they sign up and make their first payment',
      type: CampaignType.SIGNUP,
      status: CampaignStatus.ACTIVE,
      isActive: true,
      startDate: new Date(),

      // Minimum wallet balance (₦2,000 in kobo)
      minWalletBalance: 200000,

      // Referrer gets 1 free ride
      referrerRewardType: RewardType.FREE_RIDE,
      referrerRewardValue: 1,

      // Referee gets 1 free ride
      refereeRewardType: RewardType.FREE_RIDE,
      refereeRewardValue: 1,

      // Settings
      eligibleUserTypes: ['CUSTOMER'],
      autoApplyReward: false,
      rewardExpiryDays: 30,

      // Admin info (use your admin ID)
      createdBy: 'ADMIN_ID',
      lastModifiedBy: 'ADMIN_ID',
    });

    console.log('✅ Default referral campaign created');
  }
}
```

## 📋 Feature Overview

### User-Facing Features

**GraphQL Queries:**
- `myReferralCode` - Get user's referral code
- `myReferralStats` - Get referral statistics (total, qualified, completed)
- `myAvailableRewards` - List all available rewards
- `validateReferralCode` - Check if a code is valid
- `getActiveCampaigns` - View active campaigns

**GraphQL Mutations:**
- `generateCustomReferralCode` - Create a custom referral code

### Admin Features

**GraphQL Queries:**
- `listReferralCampaigns` - List all campaigns with filtering
- `getReferralCampaign` - Get specific campaign details
- `listReferralTransactions` - List all transactions with filtering
- `getReferralTransaction` - Get specific transaction
- `listReferralRewards` - List all rewards with filtering
- `getReferralAnalytics` - Get system-wide analytics
- `getCampaignAnalytics` - Get campaign-specific analytics

**GraphQL Mutations:**
- `createReferralCampaign` - Create new campaign
- `updateReferralCampaign` - Update existing campaign
- `deleteReferralCampaign` - Delete campaign
- `toggleCampaignStatus` - Activate/deactivate campaign
- `changeCampaignStatus` - Change campaign status
- `checkPendingReferrals` - Manually trigger qualification check
- `expireOldRewards` - Manually expire old rewards
- `cancelReferralTransaction` - Cancel a transaction
- `cancelReward` - Cancel a reward

## 🔄 How It Works

### 1. User Registration with Referral Code
```
Customer signs up → Enters referral code → System validates code →
Creates referral transaction (PENDING) → Generates referral codes for both users
```

### 2. Qualification Process
```
Background job runs every 30 mins → Checks pending referrals →
Monitors wallet balances → If balance ≥ minimum → Mark as QUALIFIED →
Issue rewards
```

### 3. Reward Redemption
```
User gets reward → Status: AVAILABLE → User uses reward on trip →
Status: REDEEMED → Trip applies discount/credit
```

## 🎯 Campaign Configuration

### Campaign Types
- **SIGNUP** - Standard signup referrals
- **SPECIAL** - Special promotional campaigns
- **SEASONAL** - Holiday/event campaigns (e.g., Christmas, Ramadan)
- **TARGETED** - Specific user segments

### Reward Types
- **FREE_RIDE** - Number of free rides
- **WALLET_CREDIT** - Direct wallet credit (in kobo)
- **DISCOUNT_PERCENTAGE** - Percentage discount with optional max
- **DISCOUNT_FIXED** - Fixed amount discount (in kobo)

### Campaign Settings
- Start/end dates
- Minimum wallet balance requirement
- Max total redemptions
- Max redemptions per user
- Eligible user types (CUSTOMER, DRIVER)
- Reward expiry days
- Auto-apply reward option
- Terms and conditions

## 🔧 Configuration

### Environment Variables (if needed)
```env
# Default minimum wallet balance for referrals (in kobo)
REFERRAL_MIN_WALLET_BALANCE=200000  # ₦2,000

# Default reward expiry days
REFERRAL_REWARD_EXPIRY_DAYS=30
```

## 🧪 Testing

### Test Referral Flow

1. **Create a test campaign** (via GraphQL):
```graphql
mutation {
  createReferralCampaign(input: {
    name: "Test Campaign"
    type: SIGNUP
    startDate: "2024-01-01"
    minWalletBalance: 200000
    referrerRewardType: FREE_RIDE
    referrerRewardValue: 1
    refereeRewardType: FREE_RIDE
    refereeRewardValue: 1
    eligibleUserTypes: ["CUSTOMER"]
    autoApplyReward: false
  }) {
    id
    name
  }
}
```

2. **Register with referral code**:
```graphql
mutation {
  registerCustomer(input: {
    phone: { countryCode: "234", localNumber: "8012345678" }
    password: "Test123!"
    authChannel: PHONE
    referralCode: "EXISTING_USER_CODE"
  }) {
    token
    user { id }
  }
}
```

3. **Check referral transaction**:
```graphql
query {
  listReferralTransactions(filter: { refereeId: "NEW_USER_ID" }) {
    id
    status
    referralCode
  }
}
```

4. **Top up wallet** (simulate payment):
```
# Add ₦2,000+ to referee's wallet
```

5. **Run qualification job**:
```graphql
mutation {
  checkPendingReferrals
}
```

6. **Check rewards**:
```graphql
query {
  myAvailableRewards {
    id
    rewardType
    rewardValue
    status
    description
  }
}
```

## ⚠️ Important Notes

1. **Wallet Balance**: Referrals are qualified based on wallet balance, not first trip
2. **Background Job**: Runs every 30 minutes to check pending referrals
3. **Reward Expiry**: Configure expiry days per campaign (optional)
4. **Auto-Apply**: Can be configured per campaign
5. **User Limits**: Max 10 device tokens per user for notifications

## 🐛 Troubleshooting

**Referral not qualifying?**
- Check if wallet balance meets minimum requirement
- Verify background job is running
- Check transaction status in database

**Rewards not appearing?**
- Check if referral transaction is COMPLETED
- Verify rewards were created in database
- Check reward status and expiry date

**Code not working?**
- Verify code exists and is active
- Check if code has reached max usage limit
- Verify campaign is active

## 📊 Monitoring

Track these metrics:
- Total referrals created
- Qualification rate (qualified/total)
- Conversion rate (completed/qualified)
- Reward redemption rate
- Average time to qualification
- Active campaigns performance

## 🔒 Security

- Referral codes are unique and indexed
- Wallet balance checks prevent fraud
- Admin-only mutations are protected
- Transaction lifecycle prevents double-rewards
- Reward status tracking prevents multiple redemptions

## ✅ Integration Checklist

- [ ] Copy all referral files to src/features/referral/
- [ ] Copy referral job to src/jobs/
- [ ] Update customer registration to accept referralCode
- [ ] Add referral code processing in customer service
- [ ] Update customer validation schema
- [ ] Add referral job to scheduled jobs
- [ ] Register GraphQL schemas and resolvers
- [ ] Create default campaign (optional)
- [ ] Test complete referral flow
- [ ] Monitor background job logs
- [ ] Verify rewards are issued correctly

---

**Ready to integrate!** The system is production-ready and has been tested. Just follow the steps above and you'll have a complete referral system running.
