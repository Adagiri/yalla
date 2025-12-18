# Yalla Ride Referral System Integration Guide

This directory contains all the necessary files to integrate the referral system into the Yalla Ride admin panel. The referral system has already been implemented on the backend and now needs to be integrated into the frontend.

## 📁 Directory Structure

```
updates/
├── admin-panel/          # Admin panel frontend integration files
│   ├── src/
│   │   ├── graphql/
│   │   │   └── referral.operations.ts    # GraphQL queries and mutations
│   │   ├── pages/
│   │   │   └── referrals/
│   │   │       ├── campaigns.tsx         # Campaign management page
│   │   │       ├── transactions.tsx      # Transaction listing page
│   │   │       ├── rewards.tsx           # Rewards listing page
│   │   │       ├── analytics.tsx         # Analytics dashboard
│   │   │       └── index.tsx             # Export file
│   │   └── types/
│   │       └── referral.types.ts         # TypeScript type definitions
│   └── APP_INTEGRATION_GUIDE.md         # Detailed App.tsx integration guide
└── README.md                             # This file
```

## 🚀 Quick Start

### For Admin Panel Integration

1. **Copy the files to your admin panel repository:**

   ```bash
   # From the yalla-ride root directory
   cp -r updates/admin-panel/src/* /path/to/yalla-ride-admin-panel/src/
   ```

2. **Install dependencies (if not already installed):**

   ```bash
   cd /path/to/yalla-ride-admin-panel
   npm install dayjs
   ```

3. **Update your App.tsx:**

   Follow the instructions in `updates/admin-panel/APP_INTEGRATION_GUIDE.md` to add the referral routes and resources to your App.tsx file.

4. **Start the development server:**

   ```bash
   npm run dev
   ```

5. **Verify the integration:**

   - Navigate to the admin panel
   - Look for the "Referrals" menu item in the sidebar
   - Test all four sub-pages: Campaigns, Transactions, Rewards, and Analytics

## 📋 Features Included

### 1. Campaign Management (`/referrals/campaigns`)

- **Create campaigns** with customizable rewards for both referrers and referees
- **Edit existing campaigns** with full control over all parameters
- **View campaign analytics** including total referrals, qualified, and completed
- **Toggle campaign status** (active/inactive)
- **Delete campaigns** with confirmation
- **Filter campaigns** by status (Draft, Active, Paused, Ended, Cancelled)

**Campaign Configuration Options:**
- Campaign name, description, and type (Signup, Special, Seasonal, Targeted)
- Start and end dates
- Minimum wallet balance requirement
- Referrer and referee reward types:
  - Free Ride
  - Wallet Credit
  - Discount Percentage
  - Fixed Discount
- Maximum redemption limits (total and per user)
- Eligible user types (Customer, Driver)
- Reward expiry settings
- Auto-apply reward option

### 2. Transaction Management (`/referrals/transactions`)

- **View all referral transactions** with detailed information
- **Filter transactions** by:
  - Status (Pending, Qualified, Completed, Expired, Cancelled)
  - Referrer ID
  - Referee ID
  - Date range
- **View transaction details** including:
  - Referrer and referee information
  - Wallet balances
  - Associated campaign details
  - Timeline of qualification and completion
  - Issued rewards
- **Cancel transactions** manually if needed

### 3. Reward Management (`/referrals/rewards`)

- **View all rewards** issued through the referral system
- **Filter rewards** by:
  - Status (Pending, Available, Redeemed, Expired, Cancelled)
  - Reward type (Free Ride, Wallet Credit, Discount %, Fixed Discount)
  - User ID
- **View reward statistics** at a glance:
  - Total rewards
  - Available rewards
  - Redeemed rewards
  - Expired rewards
  - Cancelled rewards
- **Cancel rewards** manually when necessary

### 4. Analytics Dashboard (`/referrals/analytics`)

- **Overall statistics:**
  - Total referrals
  - Qualified referrals
  - Completed referrals
  - Pending referrals
- **Conversion metrics:**
  - Overall conversion rate
  - Qualification rate
  - Completion rate
- **Reward statistics:**
  - Total rewards issued
  - Rewards redeemed
  - Redemption rate
- **Average time to qualification**
- **Date range filtering** for custom analytics periods
- **Admin actions:**
  - Manually trigger pending referral checks
  - Manually expire old rewards

## 🔧 Technical Details

### GraphQL Operations

All GraphQL operations are centralized in `src/graphql/referral.operations.ts`:

**Queries:**
- `LIST_REFERRAL_CAMPAIGNS` - List all campaigns with optional filtering
- `GET_REFERRAL_CAMPAIGN` - Get detailed information about a specific campaign
- `LIST_REFERRAL_TRANSACTIONS` - List all transactions with filtering
- `GET_REFERRAL_TRANSACTION` - Get detailed transaction information
- `LIST_REFERRAL_REWARDS` - List all rewards with filtering
- `GET_REFERRAL_ANALYTICS` - Get system-wide analytics
- `GET_CAMPAIGN_ANALYTICS` - Get analytics for a specific campaign
- `GET_ACTIVE_CAMPAIGNS` - Get all currently active campaigns

**Mutations:**
- `CREATE_REFERRAL_CAMPAIGN` - Create a new campaign
- `UPDATE_REFERRAL_CAMPAIGN` - Update an existing campaign
- `DELETE_REFERRAL_CAMPAIGN` - Delete a campaign
- `TOGGLE_CAMPAIGN_STATUS` - Activate or deactivate a campaign
- `CHANGE_CAMPAIGN_STATUS` - Change campaign status (Draft, Active, Paused, Ended, Cancelled)
- `CHECK_PENDING_REFERRALS` - Manually trigger pending referral qualification checks
- `EXPIRE_OLD_REWARDS` - Manually expire old rewards
- `CANCEL_REFERRAL_TRANSACTION` - Cancel a referral transaction
- `CANCEL_REWARD` - Cancel a reward

### TypeScript Types

All TypeScript types are defined in `src/types/referral.types.ts`:

**Enums:**
- `ReferralStatus` - Status of referral transactions
- `RewardStatus` - Status of rewards
- `RewardType` - Types of rewards (Free Ride, Wallet Credit, etc.)
- `CampaignType` - Types of campaigns (Signup, Special, Seasonal, Targeted)
- `CampaignStatus` - Status of campaigns (Draft, Active, Paused, Ended, Cancelled)
- `UserType` - User types (Customer, Driver)

**Interfaces:**
- `ReferralCode` - User referral code
- `ReferralTransaction` - Referral transaction details
- `ReferralReward` - Reward details
- `ReferralCampaign` - Campaign configuration
- `ReferralAnalytics` - System analytics
- `CampaignAnalytics` - Campaign-specific analytics
- Input types for mutations

### Component Architecture

All pages are built using:
- **Ant Design** components for UI
- **Refine** hooks for data management
- **urql** GraphQL client for API communication
- **dayjs** for date formatting
- **TypeScript** for type safety

## 🎨 UI Features

- **Responsive design** - Works on desktop, tablet, and mobile
- **Real-time updates** - Refresh buttons to reload data
- **Detailed views** - Drawers and modals for detailed information
- **Confirmation dialogs** - Prevent accidental deletions and cancellations
- **Visual feedback** - Loading states, success/error messages
- **Color-coded tags** - Easy visual identification of statuses
- **Progress indicators** - Visual representation of conversion rates
- **Statistics cards** - Quick overview of key metrics

## 🔐 Backend Integration Points

The backend already has the following implemented:

### Models
- `ReferralCode` - Stores user referral codes
- `ReferralTransaction` - Tracks referral transactions
- `ReferralReward` - Manages rewards
- `ReferralCampaign` - Campaign configuration

### GraphQL Resolvers
- User-facing resolvers for customers/drivers
- Admin-only resolvers for campaign management
- Analytics resolvers for reporting

### Background Jobs
- Automatic checking of pending referrals
- Automatic expiration of old rewards
- Wallet balance monitoring

### Features
- Referral code generation (automatic and custom)
- Wallet balance-based qualification
- Multiple reward types support
- Campaign-based referral system
- Flexible eligibility rules

## 📝 User Workflows

### Admin Creating a Campaign

1. Navigate to "Referrals" > "Campaigns"
2. Click "Create Campaign"
3. Fill in campaign details:
   - Name and description
   - Type and timing
   - Reward configuration for both referrer and referee
   - Limits and eligibility
4. Click "OK" to create
5. Campaign appears in the list with "DRAFT" status
6. Activate the campaign when ready

### Admin Monitoring Referrals

1. Navigate to "Referrals" > "Analytics" for overview
2. View key metrics and conversion rates
3. Navigate to "Transactions" for detailed view
4. Filter by status, dates, or users
5. Click on transactions for detailed information
6. Monitor reward issuance and redemption

### Admin Managing Rewards

1. Navigate to "Referrals" > "Rewards"
2. View all issued rewards
3. Filter by status or type
4. Cancel rewards if necessary
5. Monitor redemption rates

## 🐛 Troubleshooting

### GraphQL Errors

If you encounter GraphQL errors:
1. Verify that the backend is running and accessible
2. Check that the GraphQL endpoint is correctly configured in `App.tsx`
3. Ensure authentication token is valid
4. Check browser console for detailed error messages

### TypeScript Errors

If you encounter TypeScript errors:
1. Ensure all files are in the correct directories
2. Run `npm install` to ensure all dependencies are installed
3. Check that import paths are correct
4. Verify that TypeScript version is compatible

### Routing Issues

If routes don't work:
1. Verify that routes are added to `App.tsx` correctly
2. Check that resource names match route paths
3. Ensure parent-child relationships are correct for nested routes

## 📞 Support

For issues or questions:
1. Check the backend GraphQL schema for available operations
2. Review the backend referral service implementation
3. Check the admin panel's existing patterns for consistency

## 🎯 Next Steps

After integrating the admin panel:

1. **Test all functionality:**
   - Create a test campaign
   - Monitor transactions
   - Check analytics

2. **Customize as needed:**
   - Adjust colors and styling
   - Add additional filters or features
   - Customize analytics dashboard

3. **Train admin users:**
   - Create documentation for admin workflows
   - Set up proper permissions if needed

## 📄 License

This integration is part of the Yalla Ride platform.
