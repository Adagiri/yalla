# Admin Panel Implementation Guide: Referral System Refactor

## OBJECTIVE
Update the admin panel to support modular, reusable constraint and reward definitions for referral campaigns.

---

## OVERVIEW OF CHANGES

The admin panel needs to be updated to:
1. **Campaign Creation/Edit Form** - Use dynamic constraint/reward selection instead of hardcoded fields
2. **Constraint Definition Management** - New page to manage constraint types
3. **Reward Definition Management** - New page to manage reward types
4. **Dynamic Form Validation** - Validate based on definition metadata (min/max values, units, etc.)

---

## GRAPHQL INTEGRATION

### Queries to Implement

```graphql
# List all active constraint definitions for campaign form dropdowns
query ListConstraintDefinitions($activeOnly: Boolean) {
  listConstraintDefinitions(activeOnly: $activeOnly) {
    id
    type
    name
    description
    valueType
    defaultValue
    appliesTo
    unit
    minValue
    maxValue
    isActive
    isSystemDefined
  }
}

# List all active reward definitions for campaign form dropdowns
query ListRewardDefinitions($activeOnly: Boolean) {
  listRewardDefinitions(activeOnly: $activeOnly) {
    id
    type
    name
    description
    valueType
    defaultValue
    unit
    minValue
    maxValue
    requiresMaxValue
    isActive
    isSystemDefined
  }
}

# Get specific constraint definition (for editing)
query GetConstraintDefinition($id: ID!) {
  getConstraintDefinition(id: $id) {
    id
    type
    name
    description
    valueType
    defaultValue
    appliesTo
    unit
    minValue
    maxValue
    isActive
    isSystemDefined
    createdBy
    lastModifiedBy
    createdAt
    updatedAt
  }
}

# Get specific reward definition (for editing)
query GetRewardDefinition($id: ID!) {
  getRewardDefinition(id: $id) {
    id
    type
    name
    description
    valueType
    defaultValue
    unit
    minValue
    maxValue
    requiresMaxValue
    isActive
    isSystemDefined
    createdBy
    lastModifiedBy
    createdAt
    updatedAt
  }
}
```

### Mutations to Implement

```graphql
# Create new constraint definition
mutation CreateConstraintDefinition($input: CreateConstraintDefinitionInput!) {
  createConstraintDefinition(input: $input) {
    id
    type
    name
    isActive
  }
}

# Update existing constraint definition
mutation UpdateConstraintDefinition($id: ID!, $input: CreateConstraintDefinitionInput!) {
  updateConstraintDefinition(id: $id, input: $input) {
    id
    type
    name
    isActive
  }
}

# Toggle constraint definition active status
mutation ToggleConstraintDefinition($id: ID!, $isActive: Boolean!) {
  toggleConstraintDefinition(id: $id, isActive: $isActive) {
    id
    isActive
  }
}

# Delete constraint definition (only non-system-defined)
mutation DeleteConstraintDefinition($id: ID!) {
  deleteConstraintDefinition(id: $id)
}

# Create new reward definition
mutation CreateRewardDefinition($input: CreateRewardDefinitionInput!) {
  createRewardDefinition(input: $input) {
    id
    type
    name
    isActive
  }
}

# Update existing reward definition
mutation UpdateRewardDefinition($id: ID!, $input: CreateRewardDefinitionInput!) {
  updateRewardDefinition(id: $id, input: $input) {
    id
    type
    name
    isActive
  }
}

# Toggle reward definition active status
mutation ToggleRewardDefinition($id: ID!, $isActive: Boolean!) {
  toggleRewardDefinition(id: $id, isActive: $isActive) {
    id
    isActive
  }
}

# Delete reward definition (only non-system-defined)
mutation DeleteRewardDefinition($id: ID!) {
  deleteRewardDefinition(id: $id)
}

# Seed initial definitions (one-time operation)
mutation SeedReferralDefinitions {
  seedReferralDefinitions
}

# Updated campaign creation (with new structure)
mutation CreateCampaign($input: CreateCampaignInput!) {
  createCampaign(input: $input) {
    id
    name
    constraints {
      constraintType
      appliesTo
      value
      userTypes
    }
    referrerRewards {
      rewardType
      value
      maxValue
    }
    refereeRewards {
      rewardType
      value
      maxValue
    }
    # ... other fields
  }
}
```

---

## UI COMPONENTS

### 1. Campaign Creation/Edit Form

**File:** `src/pages/Referrals/CampaignForm.tsx` (or similar)

#### Constraints Section Component

```tsx
interface ConstraintFormData {
  constraintType: string;
  appliesTo: 'REFERRER' | 'REFEREE' | 'BOTH';
  value?: number | boolean;
  userTypes?: ('CUSTOMER' | 'DRIVER')[];
}

// Component structure
<Card title="Campaign Constraints">
  <Button onClick={addConstraint}>+ Add Constraint</Button>

  {constraints.map((constraint, index) => (
    <ConstraintRow key={index}>
      {/* Constraint Type Dropdown */}
      <Select
        label="Constraint Type"
        value={constraint.constraintType}
        onChange={(value) => updateConstraint(index, 'constraintType', value)}
        options={constraintDefinitions.map(def => ({
          value: def.type,
          label: def.name,
          description: def.description
        }))}
      />

      {/* Applies To Dropdown */}
      <Select
        label="Applies To"
        value={constraint.appliesTo}
        onChange={(value) => updateConstraint(index, 'appliesTo', value)}
        options={[
          { value: 'REFERRER', label: 'Referrer Only' },
          { value: 'REFEREE', label: 'Referee Only' },
          { value: 'BOTH', label: 'Both' }
        ]}
      />

      {/* Value Input (conditional based on valueType) */}
      {selectedDefinition.valueType === 'NUMBER' && (
        <NumberInput
          label={`Value (${selectedDefinition.unit})`}
          value={constraint.value}
          min={selectedDefinition.minValue}
          max={selectedDefinition.maxValue}
          onChange={(value) => updateConstraint(index, 'value', value)}
        />
      )}

      {selectedDefinition.valueType === 'BOOLEAN' && (
        <Switch
          label="Required"
          checked={constraint.value}
          onChange={(value) => updateConstraint(index, 'value', value)}
        />
      )}

      {/* User Types Multi-Select (optional) */}
      <MultiSelect
        label="User Types (optional)"
        value={constraint.userTypes || []}
        onChange={(value) => updateConstraint(index, 'userTypes', value)}
        options={[
          { value: 'CUSTOMER', label: 'Customer' },
          { value: 'DRIVER', label: 'Driver' }
        ]}
      />

      {/* Remove Button */}
      <Button
        variant="danger"
        onClick={() => removeConstraint(index)}
      >
        Remove
      </Button>
    </ConstraintRow>
  ))}
</Card>
```

#### UI Mockup - Constraints Section

```
┌─ Campaign Constraints ─────────────────────────────────────────────┐
│                                                                     │
│  [+ Add Constraint]                                                 │
│                                                                     │
│  ┌─ Constraint #1 ──────────────────────────────────────────────┐  │
│  │                                                               │  │
│  │  Constraint Type: [Minimum Wallet Balance      ▼]           │  │
│  │  Description: User must have at least this amount in wallet  │  │
│  │                                                               │  │
│  │  Applies To:      [Both                        ▼]           │  │
│  │  Value:           [2000] NGN (kobo)                         │  │
│  │  User Types:      [☑ Customer  ☐ Driver]                   │  │
│  │                                                               │  │
│  │  [Remove Constraint]                                          │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌─ Constraint #2 ──────────────────────────────────────────────┐  │
│  │                                                               │  │
│  │  Constraint Type: [Minimum Trip Count          ▼]           │  │
│  │  Description: User must have completed at least this many trips│
│  │                                                               │  │
│  │  Applies To:      [Referrer Only               ▼]           │  │
│  │  Value:           [5] trips                                 │  │
│  │  User Types:      [☑ Customer  ☑ Driver]                   │  │
│  │                                                               │  │
│  │  [Remove Constraint]                                          │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

#### Referrer Rewards Section Component

```tsx
interface RewardFormData {
  rewardType: string;
  value: number;
  maxValue?: number;
}

// Component structure
<Card title="Referrer Rewards">
  <Button onClick={addReferrerReward}>+ Add Reward</Button>

  {referrerRewards.map((reward, index) => (
    <RewardRow key={index}>
      {/* Reward Type Dropdown */}
      <Select
        label="Reward Type"
        value={reward.rewardType}
        onChange={(value) => updateReferrerReward(index, 'rewardType', value)}
        options={rewardDefinitions.map(def => ({
          value: def.type,
          label: def.name,
          description: def.description
        }))}
      />

      {/* Value Input */}
      <NumberInput
        label={`Value (${selectedDefinition.unit})`}
        value={reward.value}
        min={selectedDefinition.minValue}
        max={selectedDefinition.maxValue}
        onChange={(value) => updateReferrerReward(index, 'value', value)}
      />

      {/* Max Value Input (conditional for DISCOUNT_PERCENTAGE) */}
      {selectedDefinition.requiresMaxValue && (
        <NumberInput
          label="Max Value (NGN kobo)"
          value={reward.maxValue}
          onChange={(value) => updateReferrerReward(index, 'maxValue', value)}
          helperText="Maximum discount amount cap"
        />
      )}

      {/* Remove Button */}
      <Button
        variant="danger"
        onClick={() => removeReferrerReward(index)}
      >
        Remove
      </Button>
    </RewardRow>
  ))}
</Card>
```

#### UI Mockup - Referrer Rewards Section

```
┌─ Referrer Rewards ──────────────────────────────────────────────────┐
│                                                                      │
│  [+ Add Reward]                                                      │
│                                                                      │
│  ┌─ Reward #1 ─────────────────────────────────────────────────┐   │
│  │                                                              │   │
│  │  Reward Type:  [Free Ride                 ▼]                │   │
│  │  Description:  Award free rides                             │   │
│  │                                                              │   │
│  │  Value:        [2] rides                                    │   │
│  │                                                              │   │
│  │  [Remove Reward]                                             │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌─ Reward #2 ─────────────────────────────────────────────────┐   │
│  │                                                              │   │
│  │  Reward Type:  [Wallet Credit             ▼]                │   │
│  │  Description:  Add credit to wallet                         │   │
│  │                                                              │   │
│  │  Value:        [1000] NGN (kobo)                            │   │
│  │                                                              │   │
│  │  [Remove Reward]                                             │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

#### Referee Rewards Section Component

```tsx
// Similar structure to Referrer Rewards
<Card title="Referee Rewards">
  <Button onClick={addRefereeReward}>+ Add Reward</Button>

  {refereeRewards.map((reward, index) => (
    <RewardRow key={index}>
      {/* Same as referrer rewards */}
      {/* ... */}
    </RewardRow>
  ))}
</Card>
```

#### UI Mockup - Referee Rewards Section

```
┌─ Referee Rewards ───────────────────────────────────────────────────┐
│                                                                      │
│  [+ Add Reward]                                                      │
│                                                                      │
│  ┌─ Reward #1 ─────────────────────────────────────────────────┐   │
│  │                                                              │   │
│  │  Reward Type:  [Percentage Discount       ▼]                │   │
│  │  Description:  Percentage off next ride(s)                  │   │
│  │                                                              │   │
│  │  Value:        [20] %                                       │   │
│  │  Max Value:    [2000] NGN (kobo)                            │   │
│  │                (Maximum discount amount cap)                │   │
│  │                                                              │   │
│  │  [Remove Reward]                                             │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

### 2. Constraint Definition Management Page

**Route:** `/admin/referrals/constraints`

**File:** `src/pages/Referrals/ConstraintDefinitions.tsx`

#### Features
- List all constraint definitions
- Filter by active/inactive
- Create new constraint types
- Edit existing constraint types (with protection for system-defined)
- Toggle active/inactive
- Delete (only non-system-defined)

#### UI Mockup

```
┌─ Constraint Definitions ────────────────────────────────────────────┐
│                                                                      │
│  [+ Create New Constraint]          [Show: All ▼]   [Search...]    │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ Name                  │ Type                │ Active │ Actions │ │
│  ├────────────────────────────────────────────────────────────────┤ │
│  │ No Constraint         │ NONE                │   ✓    │ 🔒     │ │
│  │ (System)              │                     │        │        │ │
│  ├────────────────────────────────────────────────────────────────┤ │
│  │ Minimum Wallet        │ MIN_WALLET_BALANCE  │   ✓    │ 🔒     │ │
│  │ Balance (System)      │                     │        │        │ │
│  ├────────────────────────────────────────────────────────────────┤ │
│  │ Minimum Trip Count    │ MIN_TRIP_COUNT      │   ✓    │ 🔒     │ │
│  │ (System)              │                     │        │        │ │
│  ├────────────────────────────────────────────────────────────────┤ │
│  │ Account Age           │ ACCOUNT_AGE_DAYS    │   ✓    │ 🔒     │ │
│  │ (System)              │                     │        │        │ │
│  ├────────────────────────────────────────────────────────────────┤ │
│  │ Verified Account      │ VERIFIED_ACCOUNT    │   ✓    │ 🔒     │ │
│  │ (System)              │                     │        │        │ │
│  ├────────────────────────────────────────────────────────────────┤ │
│  │ Custom: Has Referral  │ HAS_REFERRAL_CODE   │   ✓    │ ✏️ 🗑️  │ │
│  │ Code                  │                     │        │        │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘

Legend:
🔒 = System-defined (cannot edit/delete)
✏️ = Edit
🗑️ = Delete
```

#### Create/Edit Constraint Modal

```
┌─ Create Constraint Definition ──────────────────────────────────────┐
│                                                                      │
│  Type (Unique ID):     [HAS_REFERRAL_CODE]                          │
│                        Uppercase, underscores only                  │
│                                                                      │
│  Name:                 [Has Referral Code]                          │
│                        Display name for UI                          │
│                                                                      │
│  Description:          [User must have a referral code set]         │
│                                                                      │
│  Value Type:           [Boolean              ▼]                     │
│                        NUMBER, BOOLEAN, NONE                        │
│                                                                      │
│  Default Value:        [☑ True]                                     │
│                                                                      │
│  Applies To:           [Both                 ▼]                     │
│                        REFERRER, REFEREE, BOTH                      │
│                                                                      │
│  Unit:                 []                                           │
│                        (Optional: NGN, trips, days, etc.)           │
│                                                                      │
│  Min Value:            []                                           │
│                        (Optional: for NUMBER type)                  │
│                                                                      │
│  Max Value:            []                                           │
│                        (Optional: for NUMBER type)                  │
│                                                                      │
│  Active:               [☑ Yes]                                      │
│                                                                      │
│                                   [Cancel]  [Create Constraint]     │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

### 3. Reward Definition Management Page

**Route:** `/admin/referrals/rewards`

**File:** `src/pages/Referrals/RewardDefinitions.tsx`

#### Features
- List all reward definitions
- Filter by active/inactive
- Create new reward types
- Edit existing reward types (with protection for system-defined)
- Toggle active/inactive
- Delete (only non-system-defined)

#### UI Mockup

```
┌─ Reward Definitions ─────────────────────────────────────────────────┐
│                                                                       │
│  [+ Create New Reward]             [Show: All ▼]   [Search...]      │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │ Name                  │ Type                │ Active │ Actions  │ │
│  ├─────────────────────────────────────────────────────────────────┤ │
│  │ No Reward             │ NONE                │   ✓    │ 🔒      │ │
│  │ (System)              │                     │        │         │ │
│  ├─────────────────────────────────────────────────────────────────┤ │
│  │ Free Ride             │ FREE_RIDE           │   ✓    │ 🔒      │ │
│  │ (System)              │                     │        │         │ │
│  ├─────────────────────────────────────────────────────────────────┤ │
│  │ Wallet Credit         │ WALLET_CREDIT       │   ✓    │ 🔒      │ │
│  │ (System)              │                     │        │         │ │
│  ├─────────────────────────────────────────────────────────────────┤ │
│  │ Percentage Discount   │ DISCOUNT_PERCENTAGE │   ✓    │ 🔒      │ │
│  │ (System)              │                     │        │         │ │
│  ├─────────────────────────────────────────────────────────────────┤ │
│  │ Fixed Discount        │ DISCOUNT_FIXED      │   ✓    │ 🔒      │ │
│  │ (System)              │                     │        │         │ │
│  ├─────────────────────────────────────────────────────────────────┤ │
│  │ Custom: VIP Upgrade   │ VIP_UPGRADE         │   ✓    │ ✏️ 🗑️   │ │
│  │                       │                     │        │         │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

#### Create/Edit Reward Modal

```
┌─ Create Reward Definition ───────────────────────────────────────────┐
│                                                                       │
│  Type (Unique ID):     [VIP_UPGRADE]                                 │
│                        Uppercase, underscores only                   │
│                                                                       │
│  Name:                 [VIP Upgrade]                                 │
│                        Display name for UI                           │
│                                                                       │
│  Description:          [Upgrade user to VIP tier for 30 days]        │
│                                                                       │
│  Value Type:           [Number               ▼]                      │
│                        NUMBER, PERCENTAGE, NONE                      │
│                                                                       │
│  Default Value:        [30]                                          │
│                                                                       │
│  Unit:                 [days]                                        │
│                        (Optional: NGN, rides, %, etc.)               │
│                                                                       │
│  Min Value:            [1]                                           │
│                        (Optional: for NUMBER/PERCENTAGE type)        │
│                                                                       │
│  Max Value:            [90]                                          │
│                        (Optional: for NUMBER/PERCENTAGE type)        │
│                                                                       │
│  Requires Max Value:   [☐ Yes]                                       │
│                        Check for rewards like DISCOUNT_PERCENTAGE    │
│                                                                       │
│  Active:               [☑ Yes]                                       │
│                                                                       │
│                                   [Cancel]  [Create Reward]          │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

---

## STATE MANAGEMENT

### Campaign Form State

```tsx
interface CampaignFormState {
  name: string;
  description: string;
  type: string;
  startDate: Date;
  endDate?: Date;

  // NEW: Arrays instead of single values
  constraints: ConstraintFormData[];
  referrerRewards: RewardFormData[];
  refereeRewards: RewardFormData[];

  // Other existing fields...
}

// Initial state
const initialState: CampaignFormState = {
  name: '',
  description: '',
  type: '',
  startDate: new Date(),
  constraints: [],
  referrerRewards: [],
  refereeRewards: [],
};
```

### Constraint/Reward Definitions State

```tsx
// Fetched from backend
const [constraintDefinitions, setConstraintDefinitions] = useState<ConstraintDefinition[]>([]);
const [rewardDefinitions, setRewardDefinitions] = useState<RewardDefinition[]>([]);

// Fetch on component mount
useEffect(() => {
  async function fetchDefinitions() {
    const constraints = await apolloClient.query({
      query: LIST_CONSTRAINT_DEFINITIONS,
      variables: { activeOnly: true }
    });
    setConstraintDefinitions(constraints.data.listConstraintDefinitions);

    const rewards = await apolloClient.query({
      query: LIST_REWARD_DEFINITIONS,
      variables: { activeOnly: true }
    });
    setRewardDefinitions(rewards.data.listRewardDefinitions);
  }

  fetchDefinitions();
}, []);
```

---

## FORM VALIDATION

### Constraint Validation

```tsx
function validateConstraint(constraint: ConstraintFormData, definition: ConstraintDefinition): string[] {
  const errors: string[] = [];

  // Check value type
  if (definition.valueType === 'NUMBER') {
    if (typeof constraint.value !== 'number') {
      errors.push('Value must be a number');
    }

    // Check min/max bounds
    if (definition.minValue !== undefined && constraint.value < definition.minValue) {
      errors.push(`Value must be at least ${definition.minValue}`);
    }
    if (definition.maxValue !== undefined && constraint.value > definition.maxValue) {
      errors.push(`Value must be at most ${definition.maxValue}`);
    }
  }

  if (definition.valueType === 'BOOLEAN') {
    if (typeof constraint.value !== 'boolean') {
      errors.push('Value must be true or false');
    }
  }

  return errors;
}
```

### Reward Validation

```tsx
function validateReward(reward: RewardFormData, definition: RewardDefinition): string[] {
  const errors: string[] = [];

  // Check value bounds
  if (definition.minValue !== undefined && reward.value < definition.minValue) {
    errors.push(`Value must be at least ${definition.minValue}`);
  }
  if (definition.maxValue !== undefined && reward.value > definition.maxValue) {
    errors.push(`Value must be at most ${definition.maxValue}`);
  }

  // Check if maxValue is required
  if (definition.requiresMaxValue && !reward.maxValue) {
    errors.push('Max value is required for this reward type');
  }

  return errors;
}
```

---

## DATA TRANSFORMATION

### Form to GraphQL Input

```tsx
function transformCampaignFormToInput(formData: CampaignFormState): CreateCampaignInput {
  return {
    name: formData.name,
    description: formData.description,
    type: formData.type,
    startDate: formData.startDate,
    endDate: formData.endDate,

    // Transform constraints
    constraints: formData.constraints.map(c => ({
      constraintType: c.constraintType,
      appliesTo: c.appliesTo,
      value: c.value,
      userTypes: c.userTypes
    })),

    // Transform referrer rewards
    referrerRewards: formData.referrerRewards.map(r => ({
      rewardType: r.rewardType,
      value: r.value,
      maxValue: r.maxValue
    })),

    // Transform referee rewards
    refereeRewards: formData.refereeRewards.map(r => ({
      rewardType: r.rewardType,
      value: r.value,
      maxValue: r.maxValue
    })),

    // Other fields...
  };
}
```

### GraphQL Response to Form Data (for editing)

```tsx
function transformCampaignToFormData(campaign: ReferralCampaign): CampaignFormState {
  return {
    name: campaign.name,
    description: campaign.description,
    type: campaign.type,
    startDate: new Date(campaign.startDate),
    endDate: campaign.endDate ? new Date(campaign.endDate) : undefined,

    constraints: campaign.constraints.map(c => ({
      constraintType: c.constraintType,
      appliesTo: c.appliesTo,
      value: c.value,
      userTypes: c.userTypes
    })),

    referrerRewards: campaign.referrerRewards.map(r => ({
      rewardType: r.rewardType,
      value: r.value,
      maxValue: r.maxValue
    })),

    refereeRewards: campaign.refereeRewards.map(r => ({
      rewardType: r.rewardType,
      value: r.value,
      maxValue: r.maxValue
    })),

    // Other fields...
  };
}
```

---

## ROUTING

### New Routes to Add

```tsx
// In your routing configuration
{
  path: '/admin/referrals',
  children: [
    {
      path: 'campaigns',
      element: <CampaignList />
    },
    {
      path: 'campaigns/create',
      element: <CampaignForm />
    },
    {
      path: 'campaigns/:id/edit',
      element: <CampaignForm />
    },
    {
      path: 'constraints', // NEW
      element: <ConstraintDefinitions />
    },
    {
      path: 'rewards', // NEW
      element: <RewardDefinitions />
    }
  ]
}
```

### Navigation Menu Updates

```tsx
// Add to sidebar/navigation menu
<NavSection title="Referral System">
  <NavItem to="/admin/referrals/campaigns">Campaigns</NavItem>
  <NavItem to="/admin/referrals/constraints">Constraint Types</NavItem> {/* NEW */}
  <NavItem to="/admin/referrals/rewards">Reward Types</NavItem> {/* NEW */}
</NavSection>
```

---

## TESTING CHECKLIST

### Campaign Form Tests
- [ ] Load constraint definitions on mount
- [ ] Load reward definitions on mount
- [ ] Add new constraint to form
- [ ] Remove constraint from form
- [ ] Update constraint type (clears value)
- [ ] Update constraint value (validates min/max)
- [ ] Add new referrer reward
- [ ] Remove referrer reward
- [ ] Add new referee reward
- [ ] Remove referee reward
- [ ] Show maxValue field only for DISCOUNT_PERCENTAGE
- [ ] Validate form before submission
- [ ] Submit campaign with multiple constraints
- [ ] Submit campaign with multiple rewards
- [ ] Edit existing campaign (load data correctly)

### Constraint Definition Page Tests
- [ ] List all constraint definitions
- [ ] Filter by active only
- [ ] Search by name/type
- [ ] Create new constraint definition
- [ ] Edit non-system-defined constraint
- [ ] Cannot edit system-defined constraint type
- [ ] Toggle constraint active/inactive
- [ ] Delete non-system-defined constraint
- [ ] Cannot delete system-defined constraint
- [ ] Show confirmation before delete

### Reward Definition Page Tests
- [ ] List all reward definitions
- [ ] Filter by active only
- [ ] Search by name/type
- [ ] Create new reward definition
- [ ] Edit non-system-defined reward
- [ ] Cannot edit system-defined reward type
- [ ] Toggle reward active/inactive
- [ ] Delete non-system-defined reward
- [ ] Cannot delete system-defined reward
- [ ] Show confirmation before delete

### Integration Tests
- [ ] Create campaign with NONE constraint
- [ ] Create campaign with NONE reward
- [ ] Create campaign with multiple constraints
- [ ] Create campaign with multiple rewards per recipient
- [ ] Campaign list shows new structure correctly
- [ ] Campaign details view displays constraints/rewards

### Edge Cases
- [ ] No active constraint definitions available
- [ ] No active reward definitions available
- [ ] Constraint definition deactivated after being added to form
- [ ] Reward definition deactivated after being added to form
- [ ] Very long constraint/reward names
- [ ] Special characters in custom definition types

---

## COMPONENT FILE STRUCTURE

```
src/pages/Referrals/
├── CampaignList.tsx                    # Existing - list of campaigns
├── CampaignForm.tsx                    # MODIFIED - updated form
├── CampaignDetails.tsx                 # MODIFIED - show new structure
├── ConstraintDefinitions.tsx           # NEW - manage constraints
├── RewardDefinitions.tsx               # NEW - manage rewards

src/components/Referrals/
├── ConstraintRow.tsx                   # NEW - single constraint form row
├── RewardRow.tsx                       # NEW - single reward form row
├── ConstraintDefinitionModal.tsx       # NEW - create/edit constraint definition
├── RewardDefinitionModal.tsx           # NEW - create/edit reward definition
├── ConstraintDefinitionTable.tsx       # NEW - table of constraint definitions
├── RewardDefinitionTable.tsx           # NEW - table of reward definitions
```

---

## KEY PRINCIPLES

1. **Dynamic Forms:** Use definition metadata to drive form rendering (units, min/max, value types)
2. **Validation:** Validate based on definition constraints before submission
3. **System Protection:** Disable edit/delete for system-defined definitions
4. **User Experience:** Show helpful descriptions, units, and validation hints
5. **Error Handling:** Clear error messages for validation failures
6. **Confirmation Dialogs:** Confirm before deleting definitions
7. **Loading States:** Show loading indicators while fetching definitions

---

## IMPLEMENTATION ORDER

1. ✅ Set up GraphQL queries/mutations (use codegen if available)
2. ✅ Create ConstraintDefinitions page
3. ✅ Create RewardDefinitions page
4. ✅ Create definition modals (create/edit)
5. ✅ Update CampaignForm to use dynamic constraints
6. ✅ Update CampaignForm to use dynamic rewards
7. ✅ Add form validation logic
8. ✅ Update CampaignDetails view
9. ✅ Update CampaignList view (if needed)
10. ✅ Add routing and navigation
11. ✅ Test thoroughly
12. ✅ Remove old hardcoded form fields

---

END OF ADMIN PANEL IMPLEMENTATION GUIDE
