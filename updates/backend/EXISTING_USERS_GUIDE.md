# Existing Users Referral Code Generation

## Problem

When you deploy the referral system, existing users won't automatically have referral codes. New users get codes when they register, but existing users need a one-time migration.

## Solution

We've created a migration script that generates referral codes for all existing customers and drivers.

## Quick Setup

### Option 1: Run as Script (Recommended)

```bash
# Build the project
npm run build

# Run the migration script
node dist/scripts/generate-existing-user-codes.js
```

**Output:**
```
🚀 Starting referral code generation for existing users...

📱 Generating codes for customers...
Found 1,247 customers
✅ Customer 507f1f77bcf86cd799439011: JOHN4A2F
✅ Customer 507f191e810c19729de860ea: SARAHB8K
...
✅ Customers done: 1,247 generated, 0 errors

🚗 Generating codes for drivers...
Found 523 drivers
✅ Driver 507f191e810c19729de860eb: MIKE7G9P
...
✅ Drivers done: 523 generated, 0 errors

📊 Summary:
   Total users: 1,770
   ✅ Generated: 1,770
   ❌ Errors: 0
   ⏱️  Duration: 12.34s
```

### Option 2: Add to Admin GraphQL (Better for production)

Add to your admin resolver:

```typescript
import { generateExistingUserReferralCodes } from '../../scripts/generate-existing-user-codes';

// In your admin mutations
generateReferralCodesForExistingUsers: adminOnly(async () => {
  try {
    const result = await generateExistingUserReferralCodes();

    return {
      success: true,
      message: `Generated ${result.totalGenerated} referral codes`,
      data: result,
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message,
    };
  }
}),
```

Then call from admin panel:
```graphql
mutation {
  generateReferralCodesForExistingUsers {
    success
    message
    data {
      totalGenerated
      totalErrors
      customers { total generated errors }
      drivers { total generated errors }
    }
  }
}
```

### Option 3: Automatic on First Campaign Creation

Add to your campaign creation logic:

```typescript
// After creating first campaign
const campaignCount = await ReferralCampaign.countDocuments();
if (campaignCount === 1) {
  // First campaign - generate codes for existing users
  console.log('First campaign created, generating codes for existing users...');

  // Run in background (don't block campaign creation)
  generateExistingUserReferralCodes()
    .then(result => {
      console.log(`✅ Generated ${result.totalGenerated} referral codes`);
    })
    .catch(error => {
      console.error('❌ Failed to generate referral codes:', error);
    });
}
```

## How It Works

1. **Fetches all existing users** (customers and drivers)
2. **Checks if they have a code** already (skips if yes)
3. **Generates unique code** based on:
   - User's first name (first 4 letters)
   - Random string (4 characters)
   - Example: `JOHN4A2F`, `SARAH8K1`
4. **Ensures uniqueness** by checking existing codes
5. **Creates ReferralCode record** with:
   - userId
   - userType (CUSTOMER/DRIVER)
   - code
   - isActive: true
   - timesUsed: 0

## Code Format

**Pattern:** `[NAME][RANDOM]`
- **NAME**: First 4 letters of firstname (uppercase, letters only)
- **RANDOM**: 4 random alphanumeric characters (uppercase)

**Examples:**
- John Smith → `JOHN4A2F`
- Sarah Lee → `SARA8K1P`
- No name → `XY7K9M2P` (fully random)

## Important Notes

### When to Run

✅ **Run once after deploying referral system**
- Best time: Right after creating your first campaign
- Or: Before announcing referral feature to users

❌ **Don't run multiple times**
- Script checks for existing codes and skips
- Safe to re-run, but unnecessary

### Performance

- **Speed**: ~0.01s per user (100 users/second)
- **1,000 users**: ~10 seconds
- **10,000 users**: ~100 seconds
- **Database load**: Minimal (simple inserts)

### Error Handling

The script:
- ✅ Continues on individual errors (doesn't crash)
- ✅ Logs each error with user ID
- ✅ Returns summary with error count
- ✅ Safe to retry (skips existing codes)

### Existing Codes

If a user already has a code:
- Script checks first
- Skips that user
- Logs as "skipped"
- No duplicate codes created

## Alternative: Lazy Generation

If you prefer not to run a migration, the system already handles lazy generation:

**When user queries `myReferralCode`:**
```graphql
query {
  myReferralCode {
    code
  }
}
```

The system automatically:
1. Checks if user has a code
2. If not, generates one
3. Returns the code

**Pros:**
- No migration needed
- Codes generated on-demand
- No upfront database load

**Cons:**
- Users need to open app/query to get code
- Can't pre-share codes
- No bulk analytics initially

## Recommendation

**Best Approach:**
1. Deploy referral system
2. Create first campaign (or default campaign)
3. Run migration script via admin GraphQL mutation
4. Announce feature to users (they all have codes ready)

This ensures:
- ✅ All users have codes immediately
- ✅ Can start referring right away
- ✅ Better user experience
- ✅ Accurate analytics from day 1

## Testing

Test the migration on staging first:

```bash
# Connect to staging database
MONGO_URI=mongodb://staging... node dist/scripts/generate-existing-user-codes.js

# Check results
mongo staging-db
> db.referralcodes.countDocuments()
> db.referralcodes.find().limit(10)
```

## Rollback

If needed, you can remove generated codes:

```javascript
// Only remove codes that haven't been used
db.referralcodes.deleteMany({
  timesUsed: 0,
  createdAt: { $gte: new Date('2024-01-01') } // Your migration date
});
```

## Monitoring

After migration, monitor:
- Total codes generated
- Any duplicate codes (should be 0)
- Users with multiple codes (should be 0 for general codes)
- Code usage over time

```javascript
// Check for issues
db.referralcodes.aggregate([
  { $group: { _id: '$userId', count: { $sum: 1 } } },
  { $match: { count: { $gt: 1 } } }
]);
```
