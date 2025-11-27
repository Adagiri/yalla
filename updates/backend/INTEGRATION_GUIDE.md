# Backend Integration Guide - Device Tokens, Auth Token Cache & Unified Logout

## 🎯 Overview

This guide covers integrating three features:
1. **Device Token Management** - GraphQL mutations for registering/removing push notification tokens
2. **Auth Token Caching** - Redis-based token storage for easy invalidation
3. **Unified Logout** - Complete logout endpoint handling both auth tokens and device tokens

---

## 📱 Part 1: Device Token Management

### Files Created
- `src/features/device/device.types.gql` - GraphQL schema
- `src/features/device/device.resolver.ts` - GraphQL resolver
- `src/features/device/device.controller.ts` - Controller layer
- `src/features/device/device.service.ts` - Business logic layer

### Integration Steps

#### 1. Register the GraphQL Schema & Resolver

In your GraphQL server setup file (usually `src/graphql/schema.ts` or similar), add:

```typescript
import { deviceResolvers } from '../features/device/device.resolver';

// Add to your resolvers array
const resolvers = [
  // ... existing resolvers
  deviceResolvers,
];
```

And load the schema file:
```typescript
// In your type definitions array
const typeDefs = [
  // ... existing schemas
  fs.readFileSync('./src/features/device/device.types.gql', 'utf-8'),
];
```

#### 2. Frontend Usage

**On App Launch / User Login:**
```graphql
mutation RegisterDeviceToken($input: RegisterDeviceTokenInput!) {
  registerDeviceToken(input: $input) {
    success
    message
  }
}
```

Variables:
```json
{
  "input": {
    "token": "FCM_DEVICE_TOKEN_HERE"
  }
}
```

**On Logout:**
```graphql
mutation RemoveDeviceToken($input: RegisterDeviceTokenInput!) {
  removeDeviceToken(input: $input) {
    success
    message
  }
}
```

---

## 🔐 Part 2: Auth Token Cache with Redis

### File Created
- `src/services/auth-token-cache.service.ts` - Redis-based token management

### Integration Steps

#### 1. Update Auth Token Generation

In your auth service (e.g., `src/utils/auth.ts` or login handlers), modify token generation:

**Before:**
```typescript
import { generateAuthToken } from '../utils/auth';

const token = generateAuthToken({
  id: user._id,
  accountType: user.accountType,
});
```

**After:**
```typescript
import { generateAuthToken } from '../utils/auth';
import { authTokenCache } from '../services/auth-token-cache.service';

const token = generateAuthToken({
  id: user._id,
  accountType: user.accountType,
});

// Store in Redis for invalidation capability
await authTokenCache.storeToken(
  token,
  user._id,
  user.accountType,
  120 * 24 * 60 * 60 // 120 days in seconds
);
```

#### 2. Update Auth Middleware (Optional but Recommended)

In `src/middleware/auth-middleware.ts` or `src/utils/auth-middleware.ts`:

**Add token validation check:**
```typescript
import { authTokenCache } from '../services/auth-token-cache.service';

// In your auth middleware, after JWT verification:
const decoded = jwt.verify(token, ENV.JWT_SECRET_KEY);

// Check if token is still valid in Redis
const isValid = await authTokenCache.isTokenValid(token);
if (!isValid) {
  throw new Error('Token has been invalidated');
}

// Continue with normal flow...
```

#### 3. Implement Logout

**Create/Update logout mutation:**
```typescript
import { authTokenCache } from '../services/auth-token-cache.service';

async logout(_: any, __: any, context: any) {
  const token = context.token; // Get token from context

  if (token) {
    await authTokenCache.invalidateToken(token);
  }

  return {
    success: true,
    message: 'Logged out successfully',
  };
}
```

#### 4. Password Change / Security Events

When security-sensitive actions occur, invalidate all user tokens:

```typescript
import { authTokenCache } from '../services/auth-token-cache.service';

// After password change
await authTokenCache.invalidateAllUserTokens(userId);

// After account suspension
await authTokenCache.invalidateAllUserTokens(userId);
```

---

## 🚀 Usage Examples

### Token Cache Methods

```typescript
import { authTokenCache } from '../services/auth-token-cache.service';

// Store a token
await authTokenCache.storeToken(token, userId, 'CUSTOMER', 120 * 24 * 60 * 60);

// Check if token is valid
const isValid = await authTokenCache.isTokenValid(token);

// Invalidate single token (logout)
await authTokenCache.invalidateToken(token);

// Invalidate all user tokens (password change, security)
const count = await authTokenCache.invalidateAllUserTokens(userId);
console.log(`Invalidated ${count} tokens`);

// Get all active tokens for a user
const tokens = await authTokenCache.getUserTokens(userId);

// Get count of active sessions
const sessionCount = await authTokenCache.getUserTokenCount(userId);

// Extend token TTL (optional)
await authTokenCache.extendTokenTTL(token, 30 * 24 * 60 * 60);
```

---

## 🚪 Part 3: Unified Logout Endpoint

### Files Created
- `src/features/auth/auth.types.gql` - GraphQL schema for logout
- `src/features/auth/auth.resolver.ts` - GraphQL resolver with authentication
- `src/features/auth/auth.controller.ts` - Controller layer
- `src/features/auth/auth.service.ts` - Business logic orchestrating both auth and device token removal
- `src/utils/auth-middleware-enhanced.ts` - Enhanced middleware with optional Redis validation

### Architecture
This feature follows the proper layered architecture:
```
GraphQL Request → auth.resolver.ts → auth.controller.ts → auth.service.ts
                                                           ├─> authTokenCache.invalidateToken()
                                                           └─> DeviceTokenService.removeDeviceToken()
```

### Integration Steps

#### 1. Register the GraphQL Schema & Resolver

In your GraphQL server setup file:

```typescript
import { authResolvers } from '../features/auth/auth.resolver';

// Add to your resolvers array
const resolvers = [
  // ... existing resolvers
  authResolvers,
];

// Add to type definitions
const typeDefs = [
  // ... existing schemas
  fs.readFileSync('./src/features/auth/auth.types.gql', 'utf-8'),
];
```

#### 2. Optional: Upgrade to Enhanced Auth Middleware

The enhanced middleware adds optional Redis validation controlled by environment variable `USE_REDIS_AUTH_CACHE`.

**Replace your existing auth middleware** in `src/middleware/auth-guards.ts` or similar:

```typescript
// Before:
import { validateToken } from '../utils/auth-middleware';

// After:
import { validateToken } from '../utils/auth-middleware-enhanced';
```

Then in your `.env`:
```bash
# Enable Redis auth cache validation (optional - for gradual rollout)
USE_REDIS_AUTH_CACHE=true
```

**Benefits of Enhanced Middleware:**
- Backward compatible - works with or without Redis
- Gradual rollout via environment variable
- No breaking changes to existing code
- Validates both JWT signature AND Redis cache when enabled

#### 3. Frontend Usage

**Logout from Current Device:**
```graphql
mutation Logout($input: LogoutInput) {
  logout(input: $input) {
    success
    message
  }
}
```

Variables (logout from current device, optionally remove device token):
```json
{
  "input": {
    "deviceToken": "FCM_DEVICE_TOKEN_HERE"
  }
}
```

**Logout from All Devices:**
```json
{
  "input": {
    "allDevices": true
  }
}
```

**Simple Logout (no device token removal):**
```json
{
  "input": {}
}
```

### How It Works

The logout endpoint orchestrates two operations:

1. **Auth Token Invalidation:**
   - Single device: Invalidates current auth token from Redis
   - All devices: Invalidates ALL user's auth tokens from Redis

2. **Device Token Removal (Optional):**
   - If `deviceToken` provided: Removes specific device token
   - If `allDevices: true`: Removes ALL user's device tokens
   - If neither provided: Only auth token is invalidated (user still logged out)

### Use Cases

| Scenario | Input | Result |
|----------|-------|--------|
| Normal logout | `{ deviceToken: "xyz" }` | Invalidates current auth token, removes specified device token |
| Logout without push | `{}` | Invalidates current auth token only |
| Logout all devices | `{ allDevices: true }` | Invalidates all auth tokens, removes all device tokens |
| Security event | `{ allDevices: true }` | Same as above - useful for password change, account compromise |

---

## 📋 Implementation Checklist

### Device Tokens
- [ ] Copy device files to `src/features/device/`
- [ ] Register GraphQL schema and resolver
- [ ] Test `registerDeviceToken` mutation
- [ ] Test `removeDeviceToken` mutation
- [ ] Update mobile app to call mutations on login/logout

### Auth Token Cache
- [ ] Copy `auth-token-cache.service.ts` to `src/services/`
- [ ] Update login handlers to store tokens in Redis
- [ ] Optional: Upgrade to enhanced middleware for Redis validation
- [ ] Test Redis token storage

### Unified Logout
- [ ] Copy auth feature files to `src/features/auth/`
- [ ] Copy enhanced middleware to `src/utils/`
- [ ] Register auth GraphQL schema and resolver
- [ ] Optional: Enable `USE_REDIS_AUTH_CACHE=true` in .env
- [ ] Test logout from single device
- [ ] Test logout from all devices
- [ ] Test logout without device token removal
- [ ] Integrate logout into mobile app

---

## 🔍 Testing

### Test Device Tokens

1. **Register a token:**
```bash
curl -X POST http://localhost:8000/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "query": "mutation { registerDeviceToken(input: { token: \"test_fcm_token_123\" }) { success message } }"
  }'
```

2. **Check database:**
```javascript
// In MongoDB
db.customers.findOne({ _id: "USER_ID" }, { deviceTokens: 1 })
```

### Test Auth Token Cache

1. **Login and check Redis:**
```bash
# Login to get a token
# Then check Redis
redis-cli
> GET auth:token:YOUR_JWT_TOKEN
> SMEMBERS auth:user:USER_ID
```

2. **Test invalidation:**
```bash
# Logout or change password
# Then try to use the old token - should fail
```

### Test Unified Logout

1. **Test logout from current device:**
```bash
curl -X POST http://localhost:8000/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "query": "mutation { logout(input: { deviceToken: \"test_token_123\" }) { success message } }"
  }'
```

2. **Verify token invalidation:**
```bash
# Try to use the same token again - should fail with "Token has been invalidated"
curl -X POST http://localhost:8000/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "query": "query { myProfile { id } }"
  }'
```

3. **Test logout from all devices:**
```bash
# Login from multiple sessions to get multiple tokens
# Then logout from all devices
curl -X POST http://localhost:8000/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN_1" \
  -d '{
    "query": "mutation { logout(input: { allDevices: true }) { success message } }"
  }'

# Check Redis - all tokens should be removed
redis-cli
> SMEMBERS auth:user:USER_ID
# Should return empty set
```

4. **Verify device tokens removed:**
```bash
# Check MongoDB
db.customers.findOne({ _id: "USER_ID" }, { deviceTokens: 1 })
# deviceTokens array should be empty (if allDevices: true) or missing the specific token
```

---

## 🎯 Benefits

### Device Tokens
- ✅ Push notifications work reliably
- ✅ Automatic cleanup of old tokens (max 10 per user)
- ✅ Easy to remove tokens on logout
- ✅ Proper layered architecture (resolver → controller → service)

### Auth Token Cache
- ✅ Instant token invalidation (no need to wait for JWT expiry)
- ✅ Can logout user from all devices
- ✅ Security: Revoke access immediately on password change
- ✅ Track active sessions per user
- ✅ Optional: Implement session limits

### Unified Logout
- ✅ Single endpoint handles both auth token and device token cleanup
- ✅ Flexible options: logout from current device or all devices
- ✅ Optional device token removal (backward compatible)
- ✅ Proper error handling and logging
- ✅ Clean separation of concerns (auth vs device management)
- ✅ Consistent with existing architecture patterns

---

## 🛡️ Security Considerations

1. **Redis Security:**
   - Ensure Redis has password authentication enabled
   - Use different Redis DB for auth tokens (db 1) vs cache (db 0)
   - Consider Redis AUTH ACLs for production

2. **Token Storage:**
   - Tokens are stored as-is (not hashed) in Redis for quick lookup
   - This is acceptable since Redis is internal and password-protected
   - Ensure Redis is not exposed to public internet

3. **TTL Management:**
   - Token TTL in Redis should match JWT expiry
   - Redis will auto-delete expired tokens
   - Consider periodic cleanup jobs for orphaned entries

---

## 📊 Monitoring

Add monitoring for:
- Token cache hit rate
- Number of active sessions per user
- Token invalidation events
- Failed token validation attempts

Example monitoring code:
```typescript
// In a cron job or monitoring service
const stats = {
  totalUsers: await User.countDocuments(),
  averageSessionsPerUser: await calculateAverageSessions(),
  tokensInvalidatedToday: await getInvalidationCount(),
};
```

---

## 🔧 Troubleshooting

**Device tokens not saving:**
- Check that GraphQL resolver is registered
- Verify authentication is working
- Check MongoDB for `deviceTokens` array

**Token cache not working:**
- Verify Redis connection in logs
- Check Redis is running: `redis-cli ping`
- Verify ENV variables are set correctly
- Check Redis DB number (should be 1 for auth tokens)

**Tokens not invalidating:**
- Ensure auth middleware checks Redis
- Verify `invalidateToken` is called on logout
- Check Redis TTL: `redis-cli TTL auth:token:YOUR_TOKEN`
