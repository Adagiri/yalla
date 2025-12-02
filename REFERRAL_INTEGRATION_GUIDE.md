# 📋 Referral System Integration Guide

## Overview

This guide walks you through integrating the complete referral system into your backend. The referral system allows users to invite others with referral codes and earn rewards when both users meet wallet balance requirements.

---

## 🎯 What Gets Integrated

### New Files:
```
src/features/referral/
  ├── referral-code.model.ts           # User referral codes
  ├── referral-transaction.model.ts    # Referral relationships
  ├── referral-campaign.model.ts       # Campaign configurations
  ├── referral-reward.model.ts         # Issued rewards
  ├── referral.service.ts              # Core business logic
  ├── referral-admin.service.ts        # Admin operations
  ├── referral.resolver.ts             # Customer GraphQL resolvers
  ├── referral-admin.resolver.ts       # Admin GraphQL resolvers
  ├── referral.types.gql               # Customer GraphQL schema
  └── referral.admin.gql               # Admin GraphQL schema

src/jobs/
  └── referral.job.ts                  # Cron jobs for automation
```

### Modified Files:
```
src/features/customer/
  ├── customer.ops.gql                 # Added referralCode field
  ├── customer.service.ts              # Added referral integration
  └── customer.type.ts                 # Added referralCode interface

src/services/
  └── scheduled-jobs.ts                # Registered referral cron jobs
```

---

## 📦 Step 1: Copy New Files

### Copy Referral Feature
```bash
# Copy the entire referral feature directory
cp -r src/features/referral/ /path/to/your/backend/src/features/

# Copy the referral job
cp src/jobs/referral.job.ts /path/to/your/backend/src/jobs/
```

**Files copied:**
- ✅ 4 database models (code, transaction, campaign, reward)
- ✅ 2 service files (customer + admin operations)
- ✅ 2 resolver files (customer + admin APIs)
- ✅ 2 GraphQL schema files (.gql)
- ✅ 1 cron job file

---

## 🔧 Step 2: Merge Modified Files

### 2.1 Update Customer GraphQL Schema

**File:** `src/features/customer/customer.ops.gql`

**Change:** Add `referralCode` field to `RegisterCustomerInput`

```graphql
input RegisterCustomerInput {
  phone: PhoneInput!
  password: String!
  authChannel: AuthChannel!
  referralCode: String  # ← ADD THIS LINE
}
```

### 2.2 Update Customer TypeScript Interface

**File:** `src/features/customer/customer.type.ts`

**Change:** Add `referralCode` to interface

```typescript
export interface RegisterCustomerInput {
  phone: { countryCode: string; localNumber: string; fullPhone: string };
  password: string;
  authChannel: AuthChannel;
  referralCode?: string; // ← ADD THIS LINE
}
```

### 2.3 Update Customer Service

**File:** `src/features/customer/customer.service.ts`

**Find this section in `registerCustomer` method:**
```typescript
static async registerCustomer(input: RegisterCustomerInput) {
  try {
    const { phone, password } = input;  // ← CHANGE THIS LINE
```

**Replace with:**
```typescript
static async registerCustomer(input: RegisterCustomerInput) {
  try {
    const { phone, password, referralCode } = input;  // ← Extract referralCode
```

**Then ADD this validation block AFTER the existing customer check:**
```typescript
    if (existingCustomer) {
      throw new ErrorResponse(400, 'Phone number already registered');
    }

    // ← ADD THIS BLOCK
    // Validate referral code if provided
    if (referralCode) {
      const referralService = (await import('../referral/referral.service'))
        .default;
      const validation = await referralService.validateReferralCode(
        referralCode
      );

      if (!validation.isValid) {
        throw new ErrorResponse(400, validation.error || 'Invalid referral code');
      }
    }
    // ← END OF NEW BLOCK

    const hashedPassword = await hashPassword(password);
```

**Then ADD this transaction creation block AFTER customer creation:**
```typescript
    // Create the customer record
    const customer = await Customer.create(customerData);

    // ← ADD THIS BLOCK
    // Create referral transaction if referral code was provided
    if (referralCode) {
      try {
        const referralService = (await import('../referral/referral.service'))
          .default;
        await referralService.createReferralTransaction(
          referralCode,
          customer._id,
          customer.accountType,
          {
            signupDevice: 'mobile', // You can enhance this with actual device info
          }
        );
      } catch (error: any) {
        // Log error but don't fail registration
        console.error('Failed to create referral transaction:', error);
      }
    }
    // ← END OF NEW BLOCK

    // Send phone verification SMS
    await NotificationService.sendSMS({
```

### 2.4 Update Scheduled Jobs

**File:** `src/services/scheduled-jobs.ts`

**At the top, add import:**
```typescript
import { startReferralCheckJob, startRewardExpiryJob } from '../jobs/referral.job';
```

**In the `startScheduledJobs()` function, add these jobs:**
```typescript
  // NEW: Referral check job (every hour)
  const referralCheckJob = startReferralCheckJob();

  // NEW: Reward expiry job (daily at 3 AM)
  const rewardExpiryJob = startRewardExpiryJob();
```

**Update the shutdown handlers to stop referral jobs:**
```typescript
  process.on('SIGTERM', () => {
    console.log('🛑 Stopping scheduled jobs...');
    clearInterval(autoRenewalInterval);
    commissionJob.stop();
    walletClearanceJob.stop();
    cardChargingJob.stop();
    referralCheckJob.stop();      // ← ADD THIS
    rewardExpiryJob.stop();       // ← ADD THIS
  });

  process.on('SIGINT', () => {
    console.log('🛑 Stopping scheduled jobs...');
    clearInterval(autoRenewalInterval);
    commissionJob.stop();
    walletClearanceJob.stop();
    cardChargingJob.stop();
    referralCheckJob.stop();      // ← ADD THIS
    rewardExpiryJob.stop();       // ← ADD THIS
  });
```

---

## 🔌 Step 3: GraphQL Schema Registration

**Good news:** If you're using `@graphql-tools/load-files` (like in `src/graphql/schema.ts`), the new `.gql` and `.resolver.ts` files are **automatically discovered**!

**Verify your schema loader looks like this:**

**File:** `src/graphql/schema.ts`
```typescript
import path from 'path';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { loadFilesSync } from '@graphql-tools/load-files';

const typesArray = loadFilesSync(path.join(__dirname, '..', '**/*.gql'));
const resolversArray = loadFilesSync(
  path.join(__dirname, '..', '**/*.resolver.{js,ts}')
);

const schema = makeExecutableSchema({
  typeDefs: typesArray,
  resolvers: resolversArray,
});

export default schema;
```

If using manual schema registration, add:
```typescript
import referralResolvers from '../features/referral/referral.resolver';
import referralAdminResolvers from '../features/referral/referral-admin.resolver';
import referralTypes from '../features/referral/referral.types.gql';
import referralAdminTypes from '../features/referral/referral.admin.gql';

// Include in your schema
```

---

## 🏗️ Step 4: Build and Test

### Build the Application
```bash
npm run build
```

**Expected output:**
```
✓ Compiled successfully
✓ Copied .gql files
```

**If you see errors**, check:
- All imports are correct
- MongoDB models are properly exported
- TypeScript paths are configured

---

## 🎮 Step 5: Initialize System (First Time Only)

### 5.1 Set Minimum Wallet Balance

After deployment, configure the default wallet balance requirement:

```graphql
mutation {
  updateReferralSystemConfig(minWalletBalance: 2000) {
    id
    value
    description
  }
}
```

**This sets:** Both referrer and referee need ₦2,000 in wallet to qualify.

### 5.2 Create Default Campaign

Create a standard signup referral campaign:

```graphql
mutation {
  createReferralCampaign(input: {
    name: "Default Signup Referral"
    description: "Standard referral program for new users"
    type: SIGNUP
    startDate: "2025-01-01T00:00:00Z"
    endDate: null

    minWalletBalance: 2000

    referrerRewardType: FREE_RIDE
    referrerRewardValue: 1

    refereeRewardType: FREE_RIDE
    refereeRewardValue: 1

    eligibleUserTypes: ["CUSTOMER"]
    rewardExpiryDays: 90
    autoApplyReward: false
  }) {
    id
    name
    status
  }
}
```

### 5.3 Activate the Campaign

```graphql
mutation {
  changeCampaignStatus(
    id: "YOUR_CAMPAIGN_ID"
    status: ACTIVE
  ) {
    id
    status
    isCurrentlyActive
  }
}
```

---

## ✅ Step 6: Verify Integration

### Test 1: Generate Referral Code

```graphql
query {
  myReferralCode {
    id
    code
    timesUsed
    isUsable
  }
}
```

**Expected:** Returns a unique code like `JOHN1234`

### Test 2: Validate Code

```graphql
query {
  validateReferralCode(code: "JOHN1234") {
    isValid
    error
    campaign {
      name
    }
  }
}
```

**Expected:** `isValid: true` with campaign details

### Test 3: Register with Referral Code

```graphql
mutation {
  registerCustomer(input: {
    phone: {
      countryCode: "+234"
      localNumber: "8012345678"
      fullPhone: "+2348012345678"
    }
    password: "TestPassword123!"
    authChannel: SMS
    referralCode: "JOHN1234"
  }) {
    token
    entity {
      id
    }
  }
}
```

**Expected:**
- User created successfully
- Referral transaction created with PENDING status

### Test 4: Check Referral Stats

```graphql
query {
  myReferralStats {
    referralCode
    totalReferrals
    pendingReferrals
    availableRewards
  }
}
```

**Expected:** Shows 1 pending referral

### Test 5: Verify Cron Jobs

Check server logs for:
```
🚀 Referral check cron job started (runs hourly)
🚀 Reward expiry cron job started (runs daily at 3 AM)
```

### Test 6: Manual Qualification Check

```graphql
mutation {
  checkPendingReferrals
}
```

**Expected:** Returns count of newly completed referrals

---

## 🔍 Troubleshooting

### Issue: GraphQL schema not loading

**Symptoms:** `Unknown type "ReferralCampaign"` or similar errors

**Solution:**
```bash
# Rebuild to copy .gql files
npm run build

# Check dist folder
ls dist/features/referral/*.gql
```

### Issue: Cron jobs not running

**Symptoms:** Pending referrals not qualifying automatically

**Check:**
1. `startScheduledJobs()` is called in `src/config/app-setup.ts`
2. Logs show job initialization
3. Jobs are added to shutdown handlers

**Manual trigger:**
```graphql
mutation {
  checkPendingReferrals
}
```

### Issue: Referral code not generated

**Symptoms:** `myReferralCode` query fails

**Check:**
1. User is authenticated (JWT token in headers)
2. MongoDB connection is active
3. User has `firstname` field (fallback to random code if not)

### Issue: TypeScript build errors

**Common errors:**

**Error:** `Cannot find module '../referral/referral.service'`
**Fix:** Ensure `src/features/referral/` exists with all files

**Error:** `Property 'cancellationReason' does not exist`
**Fix:** Already fixed with `as any` casting in admin service

**Error:** `Type 'null' is not assignable to type 'ReferralCodeDocument'`
**Fix:** Already fixed with proper return flow

---

## 📊 Database Collections

After integration, these MongoDB collections will be created:

```
referralcodes          # User referral codes
referraltransactions   # Who referred whom
referralcampaigns      # Campaign configurations
referralrewards        # Issued rewards
systemconfigs          # System configuration (already exists)
```

**Verify collections:**
```javascript
// In MongoDB shell
show collections
db.referralcodes.find().limit(5)
db.referraltransactions.find().limit(5)
```

---

## 🎯 Expected Workflow

### User Flow:
1. **User A** queries `myReferralCode` → Gets "USERA123"
2. **User B** registers with `referralCode: "USERA123"`
3. System creates `ReferralTransaction` with status: PENDING
4. **Hourly cron** checks if both users have ₦2,000+ in wallet
5. If yes, status → QUALIFIED → COMPLETED
6. Both users get `ReferralReward` with status: AVAILABLE
7. Users can redeem rewards for free rides

### Admin Flow:
1. Create campaigns with custom rewards and dates
2. Monitor analytics and conversion rates
3. View all transactions and rewards
4. Cancel fraudulent referrals if needed
5. Adjust system configuration

---

## 📈 Performance Notes

### Indexes (Already Included)

All models have proper indexes:
- `referralcodes`: code (unique), userId, isActive
- `referraltransactions`: referrerId, refereeId (unique), status, campaignId
- `referralrewards`: userId + status, expiresAt, campaignId
- `referralcampaigns`: status + isActive, startDate + endDate

### Cron Job Impact

- **Hourly check:** Only queries PENDING transactions (minimal load)
- **Daily expiry:** Only queries AVAILABLE rewards with expiresAt

### Query Optimization

Use pagination for list queries:
```graphql
query {
  listReferralTransactions(
    pagination: { limit: 50, offset: 0 }
  ) { ... }
}
```

---

## 🔒 Security Considerations

### Admin Authentication

**IMPORTANT:** Admin resolver authentication is currently commented out:

```typescript
// TODO: Add admin authentication check
// if (!context.admin) {
//   throw new GraphQLError('Admin authentication required');
// }
```

**Before production:**
1. Uncomment authentication checks in all admin resolvers
2. Implement proper admin role verification
3. Add rate limiting to prevent abuse

### Fraud Prevention

Monitor for:
- Same IP/device creating multiple accounts
- Users topping up wallet just to qualify
- Unusual referral patterns

Add to `cancelReferralTransaction` with reason: "Fraudulent activity"

---

## 📞 Support

### Common Questions

**Q: Can I have multiple campaigns?**
A: Yes! Campaigns can run simultaneously. Each has its own rules.

**Q: Can I change the wallet balance requirement per campaign?**
A: Yes! Each campaign has `minWalletBalance` config.

**Q: What happens if campaign expires with pending referrals?**
A: They stay PENDING. Update campaign end date or they expire.

**Q: Can users have custom referral codes?**
A: Yes! Use `generateCustomReferralCode` mutation.

**Q: How do I disable referrals temporarily?**
A: Pause all campaigns with `toggleCampaignStatus(isActive: false)`.

---

## ✅ Integration Checklist

Before going live:

- [ ] All files copied to correct locations
- [ ] Customer service modified for referral integration
- [ ] GraphQL schemas registered
- [ ] Scheduled jobs added and running
- [ ] TypeScript builds without errors
- [ ] System config created (min wallet balance)
- [ ] Default campaign created and activated
- [ ] Test flow completed successfully
- [ ] Cron jobs verified in logs
- [ ] Admin authentication enabled
- [ ] Monitoring/alerts configured
- [ ] Documentation shared with team

---

## 🎉 You're Done!

The referral system is now fully integrated. Users can:
- Generate referral codes
- Invite friends
- Earn rewards automatically

Admins can:
- Create campaigns with dates and rules
- Monitor performance and analytics
- Manage transactions and rewards
- Configure system settings

**Next steps:**
1. Monitor first few referrals closely
2. Gather user feedback
3. Iterate on reward amounts if needed
4. Consider adding email/SMS notifications

---

**Need help?** Check the troubleshooting section or review the code comments in service files.
