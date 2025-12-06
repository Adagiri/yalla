# Admin Panel Integration Guide for Referral System

This guide explains how to integrate the referral system pages into your admin panel's `App.tsx`.

## Step 1: Import the Referral Pages

Add the following import statement at the top of your `App.tsx` file, along with the other page imports:

```typescript
import {
  CampaignList,
  TransactionList,
  RewardList,
  ReferralAnalyticsDashboard,
} from './pages/referrals';
```

## Step 2: Import Additional Icons

Add these icons to your existing icon imports from `@ant-design/icons`:

```typescript
import {
  // ... existing icons
  GiftOutlined,
  ShareAltOutlined,
  BarChartOutlined,
} from '@ant-design/icons';
```

## Step 3: Add Referral Resources

In the `resources` array within the `<Refine>` component, add the following resource definitions. Place them after the existing resources (e.g., after "settings"):

```typescript
{
  name: 'referrals',
  meta: {
    label: 'Referrals',
    icon: <ShareAltOutlined />,
  },
},
{
  name: 'referrals/campaigns',
  list: '/referrals/campaigns',
  meta: {
    label: 'Campaigns',
    icon: <GiftOutlined />,
    parent: 'referrals',
  },
},
{
  name: 'referrals/transactions',
  list: '/referrals/transactions',
  meta: {
    label: 'Transactions',
    icon: <FileTextOutlined />,
    parent: 'referrals',
  },
},
{
  name: 'referrals/rewards',
  list: '/referrals/rewards',
  meta: {
    label: 'Rewards',
    icon: <GiftOutlined />,
    parent: 'referrals',
  },
},
{
  name: 'referrals/analytics',
  list: '/referrals/analytics',
  meta: {
    label: 'Analytics',
    icon: <BarChartOutlined />,
    parent: 'referrals',
  },
},
```

## Step 4: Add Referral Routes

In the protected routes section (within the `<Authenticated>` wrapper), add the following route definitions after the existing routes (e.g., after settings):

```typescript
{/* Referral routes */}
<Route path="/referrals">
  <Route path="campaigns" element={<CampaignList />} />
  <Route path="transactions" element={<TransactionList />} />
  <Route path="rewards" element={<RewardList />} />
  <Route path="analytics" element={<ReferralAnalyticsDashboard />} />
</Route>
```

## Complete Example

Here's what the complete section should look like in context:

```typescript
// Near the top of the file, with other imports
import {
  DashboardOutlined,
  CarOutlined,
  // ... other existing icons
  ShareAltOutlined,
  GiftOutlined,
  BarChartOutlined,
} from '@ant-design/icons';

import {
  CampaignList,
  TransactionList,
  RewardList,
  ReferralAnalyticsDashboard,
} from './pages/referrals';

// In the resources array
resources={[
  // ... existing resources
  {
    name: 'settings',
    list: '/settings',
    meta: {
      label: 'Settings',
      icon: <SettingOutlined />,
    },
  },
  // Add referrals resources here
  {
    name: 'referrals',
    meta: {
      label: 'Referrals',
      icon: <ShareAltOutlined />,
    },
  },
  {
    name: 'referrals/campaigns',
    list: '/referrals/campaigns',
    meta: {
      label: 'Campaigns',
      icon: <GiftOutlined />,
      parent: 'referrals',
    },
  },
  {
    name: 'referrals/transactions',
    list: '/referrals/transactions',
    meta: {
      label: 'Transactions',
      icon: <FileTextOutlined />,
      parent: 'referrals',
    },
  },
  {
    name: 'referrals/rewards',
    list: '/referrals/rewards',
    meta: {
      label: 'Rewards',
      icon: <GiftOutlined />,
      parent: 'referrals',
    },
  },
  {
    name: 'referrals/analytics',
    list: '/referrals/analytics',
    meta: {
      label: 'Analytics',
      icon: <BarChartOutlined />,
      parent: 'referrals',
    },
  },
]}

// In the routes section
<Route path="/settings" element={<SystemSettings />} />

{/* Add referral routes here */}
<Route path="/referrals">
  <Route path="campaigns" element={<CampaignList />} />
  <Route path="transactions" element={<TransactionList />} />
  <Route path="rewards" element={<RewardList />} />
  <Route path="analytics" element={<ReferralAnalyticsDashboard />} />
</Route>

{/* Catch all */}
<Route path="*" element={<ErrorComponent />} />
```

## Step 5: Install Dependencies (if needed)

Make sure you have `dayjs` installed for date formatting:

```bash
npm install dayjs
```

## Verification

After completing the integration:

1. Start your development server
2. Navigate to the admin panel
3. You should see a new "Referrals" menu item in the sidebar with four sub-items:
   - Campaigns
   - Transactions
   - Rewards
   - Analytics

## Troubleshooting

- If you see TypeScript errors, make sure all the files are in the correct directories
- If icons don't show up, verify that all icon imports are correct
- If routing doesn't work, check that the route paths match the resource definitions
