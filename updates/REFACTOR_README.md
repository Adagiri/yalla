# Referral System Refactor - Implementation Updates

This directory now contains comprehensive implementation guides for refactoring the referral system to use modular, reusable constraint and reward definitions.

## New Structure for Refactoring

```
updates/
├── README.md                           # Original integration guide
├── REFACTOR_README.md                  # This file - Refactor guide
├── backend/
│   └── IMPLEMENTATION_GUIDE.md         # Backend refactoring guide
└── admin-panel/
    └── IMPLEMENTATION_GUIDE.md         # Admin panel refactoring guide
```

## Overview

The referral system is being refactored to:
- Replace hardcoded constraints with modular `ConstraintDefinition` system
- Replace hardcoded rewards with modular `RewardDefinition` system
- Support multiple constraints per campaign
- Support multiple rewards per campaign (per referrer/referee)
- Allow admins to create custom constraint/reward types without code changes

## For Backend Developers

See: [`backend/IMPLEMENTATION_GUIDE.md`](./backend/IMPLEMENTATION_GUIDE.md)

**Key Changes:**
- New models: `ConstraintDefinition`, `RewardDefinition`
- Updated `ReferralCampaign` model with arrays of constraints/rewards
- New GraphQL types, queries, and mutations
- Updated service logic for constraint checking and reward issuance
- Seeder script for base definitions
- Migration script for existing campaigns

**Start Here:**
1. Review the implementation guide
2. Create the new models
3. Run the seeder script
4. Update the campaign model
5. Update service logic
6. Create migration script
7. Test thoroughly

## For Admin Panel Developers

See: [`admin-panel/IMPLEMENTATION_GUIDE.md`](./admin-panel/IMPLEMENTATION_GUIDE.md)

**Key Changes:**
- Updated Campaign Form with dynamic constraint/reward selection
- New Constraint Definitions management page
- New Reward Definitions management page
- GraphQL queries/mutations for definitions
- Dynamic form validation based on definition metadata

**Start Here:**
1. Review the implementation guide
2. Set up GraphQL queries/mutations
3. Create definition management pages
4. Update campaign form components
5. Add form validation
6. Update routing and navigation
7. Test thoroughly

## Implementation Order

### Phase 1: Backend Foundation
1. Backend creates models and seeder
2. Backend runs seeder to populate definitions
3. Backend updates GraphQL schema
4. Backend creates resolvers

### Phase 2: Backend Migration
1. Backend updates service logic
2. Backend creates migration script
3. Backend runs migration on existing campaigns
4. Backend testing

### Phase 3: Admin Panel
1. Admin panel sets up GraphQL integration
2. Admin panel creates definition management pages
3. Admin panel updates campaign form
4. Admin panel testing

### Phase 4: Integration Testing
1. End-to-end testing
2. User acceptance testing
3. Production deployment

## Key Principles

1. **Backward Compatibility** - Keep old campaigns working during migration
2. **Validation** - Always validate constraint/reward types exist before campaign creation
3. **System Protection** - Cannot delete base constraint/reward types
4. **Extensibility** - Easy to add new types without code changes
5. **Clear Documentation** - Both guides include detailed examples and mockups

## Questions?

- Backend questions: See [backend/IMPLEMENTATION_GUIDE.md](./backend/IMPLEMENTATION_GUIDE.md)
- Admin panel questions: See [admin-panel/IMPLEMENTATION_GUIDE.md](./admin-panel/IMPLEMENTATION_GUIDE.md)
- Architecture questions: See main [REFERRAL_REFACTOR_INSTRUCTIONS.md](../REFERRAL_REFACTOR_INSTRUCTIONS.md)

## Next Steps

1. **Backend Team**: Review `backend/IMPLEMENTATION_GUIDE.md` and begin implementation
2. **Admin Panel Team**: Review `admin-panel/IMPLEMENTATION_GUIDE.md` and begin implementation
3. **Coordinate**: Backend should complete Phase 1 before Admin Panel starts Phase 3

---

Last Updated: 2025-12-06
