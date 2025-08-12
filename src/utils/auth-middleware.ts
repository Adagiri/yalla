import jwt from 'jsonwebtoken';
import { ErrorResponse } from './responses';
import Admin from '../features/admin/admin.model';
import Driver from '../features/driver/driver.model';
import Customer from '../features/customer/customer.model';
import { skip } from 'graphql-resolvers';
import { AccountType } from '../constants/general';
import {
  ADMIN_PERMISSIONS,
  ROLE_PERMISSIONS,
} from '../constants/admin-permissions';

export const getUserInfo = (token: string) => {
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET_KEY as string);
    return payload || null;
  } catch {
    return null;
  }
};

// Enhanced admin protection with role-based access
export const protectAdmin = async (
  _: unknown,
  __: unknown,
  { user }: { user: any }
) => {
  if (!user) {
    throw new ErrorResponse(401, 'Please log in to continue');
  }

  const userRecord = await Admin.findById(user.id);
  if (!userRecord) {
    throw new ErrorResponse(404, 'Admin user does not exist.');
  }

  // Check if admin is active
  if (!userRecord.isActive) {
    throw new ErrorResponse(403, 'Admin account is deactivated.');
  }

  // Support both old AccountType system and new role system
  const isValidAdmin =
    userRecord.accountType === AccountType.ADMIN ||
    ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'SUPPORT', 'ANALYST'].includes(
      userRecord.role
    );

  if (!isValidAdmin) {
    throw new ErrorResponse(403, 'Not authorized as admin.');
  }

  // Update last active time
  userRecord.lastActiveAt = new Date();
  await userRecord.save();

  user = userRecord;
  return skip;
};

// Super admin only protection
export const protectSuperAdmin = async (
  _: unknown,
  __: unknown,
  { user }: { user: any }
) => {
  if (!user) {
    throw new ErrorResponse(401, 'Please log in to continue');
  }

  const userRecord = await Admin.findById(user.id);
  if (!userRecord) {
    throw new ErrorResponse(404, 'Admin user does not exist.');
  }

  if (!userRecord.isActive) {
    throw new ErrorResponse(403, 'Admin account is deactivated.');
  }

  if (userRecord.role !== 'SUPER_ADMIN') {
    throw new ErrorResponse(403, 'Super admin access required.');
  }

  // Update last active time
  userRecord.lastActiveAt = new Date();
  await userRecord.save();

  user = userRecord;
  return skip;
};

export const protectDriver = async (
  _: unknown,
  __: unknown,
  { user }: { user: any }
) => {
  if (!user) {
    throw new ErrorResponse(401, 'Please log in to continue');
  }

  const userRecord = await Driver.findById(user.id);
  if (!userRecord) {
    throw new ErrorResponse(404, 'User does not exist.');
  }

  if (userRecord.accountType !== AccountType.DRIVER) {
    throw new ErrorResponse(403, 'Not authorized as a driver.');
  }

  user = userRecord;
  return skip;
};

export const protectCustomer = async (
  _: unknown,
  __: unknown,
  { user }: { user: any }
) => {
  if (!user) {
    throw new ErrorResponse(401, 'Please log in to continue');
  }

  const userRecord = await Customer.findById(user.id);
  if (!userRecord) {
    throw new ErrorResponse(404, 'User does not exist.');
  }

  if (userRecord.accountType !== AccountType.CUSTOMER) {
    throw new ErrorResponse(403, 'Not authorized as a customer.');
  }

  user = userRecord;
  return skip;
};

// Enhanced protectEntities with better admin role support
export const protectEntities = (requiredEntities: string[]) => {
  return async (_: unknown, __: unknown, context: { user: any }) => {
    const user = context.user;
    if (!user) {
      throw new ErrorResponse(401, 'Please log in to continue');
    }

    let userRecord: any;

    // Check Admin (with enhanced role checking)
    if (
      requiredEntities.includes('ADMIN') ||
      requiredEntities.includes('SUPER_ADMIN')
    ) {
      userRecord = await Admin.findById(user.id);
      if (userRecord) {
        // Check if admin is active
        if (!userRecord.isActive) {
          throw new ErrorResponse(403, 'Admin account is deactivated.');
        }

        // Support both old AccountType system and new role system
        const isValidAdmin =
          userRecord.accountType === AccountType.ADMIN ||
          ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'SUPPORT', 'ANALYST'].includes(
            userRecord.role
          );

        if (isValidAdmin) {
          // If SUPER_ADMIN is specifically required, check role
          if (
            requiredEntities.includes('SUPER_ADMIN') &&
            userRecord.role !== 'SUPER_ADMIN'
          ) {
            throw new ErrorResponse(403, 'Super admin access required.');
          }

          // Update last active time
          userRecord.lastActiveAt = new Date();
          await userRecord.save();

          context.user = userRecord;
          return skip;
        }
      }
    }
      console.log(user);

    // Check Driver
    if (requiredEntities.includes('DRIVER')) {
      userRecord = await Driver.findById(user.id);
      if (userRecord && userRecord.accountType === AccountType.DRIVER) {
        context.user = userRecord;
        return skip;
      }
    }

    // Check Customer
    if (requiredEntities.includes('CUSTOMER')) {
      userRecord = await Customer.findById(user.id);
      if (userRecord && userRecord.accountType === AccountType.CUSTOMER) {
        context.user = userRecord;
        return skip;
      }
    }

    if (!userRecord) {
      throw new ErrorResponse(404, 'User record not found.');
    }

    throw new ErrorResponse(
      403,
      `User is not authorized. Required roles: ${requiredEntities.join(', ')}`
    );
  };
};

// New permission-based protection
export const requirePermission = (permission: string) => {
  return async (_: unknown, __: unknown, context: { user: any }) => {
    const user = context.user;

    if (!user) {
      throw new ErrorResponse(401, 'Authentication required');
    }

    // Get admin record to check permissions
    const adminRecord = await Admin.findById(user.id);
    if (!adminRecord) {
      throw new ErrorResponse(404, 'Admin user not found');
    }

    if (!adminRecord.isActive) {
      throw new ErrorResponse(403, 'Admin account is deactivated.');
    }

    // Check if user has specific permission
    const userPermissions = adminRecord.permissions || [];
    const rolePermissions =
      ROLE_PERMISSIONS[adminRecord.role as keyof typeof ROLE_PERMISSIONS] || [];

    const hasPermission =
      userPermissions.includes(permission) ||
      rolePermissions.includes(permission) ||
      adminRecord.role === 'SUPER_ADMIN'; // Super admin has all permissions

    if (!hasPermission) {
      throw new ErrorResponse(403, `Permission required: ${permission}`);
    }

    // Update last active time
    adminRecord.lastActiveAt = new Date();
    await adminRecord.save();

    context.user = adminRecord;
    return skip;
  };
};

// Multiple permissions (user must have ALL)
export const requireAllPermissions = (permissions: string[]) => {
  return async (_: unknown, __: unknown, context: { user: any }) => {
    const user = context.user;

    if (!user) {
      throw new ErrorResponse(401, 'Authentication required');
    }

    const adminRecord = await Admin.findById(user.id);
    if (!adminRecord) {
      throw new ErrorResponse(404, 'Admin user not found');
    }

    if (!adminRecord.isActive) {
      throw new ErrorResponse(403, 'Admin account is deactivated.');
    }

    // Super admin has all permissions
    if (adminRecord.role === 'SUPER_ADMIN') {
      context.user = adminRecord;
      return skip;
    }

    const userPermissions = adminRecord.permissions || [];
    const rolePermissions =
      ROLE_PERMISSIONS[adminRecord.role as keyof typeof ROLE_PERMISSIONS] || [];
    const allUserPermissions = [...userPermissions, ...rolePermissions];

    const hasAllPermissions = permissions.every((permission) =>
      allUserPermissions.includes(permission)
    );

    if (!hasAllPermissions) {
      const missingPermissions = permissions.filter(
        (permission) => !allUserPermissions.includes(permission)
      );
      throw new ErrorResponse(
        403,
        `Missing required permissions: ${missingPermissions.join(', ')}`
      );
    }

    // Update last active time
    adminRecord.lastActiveAt = new Date();
    await adminRecord.save();

    context.user = adminRecord;
    return skip;
  };
};

// Multiple permissions (user must have ANY)
export const requireAnyPermission = (permissions: string[]) => {
  return async (_: unknown, __: unknown, context: { user: any }) => {
    const user = context.user;

    if (!user) {
      throw new ErrorResponse(401, 'Authentication required');
    }

    const adminRecord = await Admin.findById(user.id);
    if (!adminRecord) {
      throw new ErrorResponse(404, 'Admin user not found');
    }

    if (!adminRecord.isActive) {
      throw new ErrorResponse(403, 'Admin account is deactivated.');
    }

    // Super admin has all permissions
    if (adminRecord.role === 'SUPER_ADMIN') {
      context.user = adminRecord;
      return skip;
    }

    const userPermissions = adminRecord.permissions || [];
    const rolePermissions =
      ROLE_PERMISSIONS[adminRecord.role as keyof typeof ROLE_PERMISSIONS] || [];
    const allUserPermissions = [...userPermissions, ...rolePermissions];

    const hasAnyPermission = permissions.some((permission) =>
      allUserPermissions.includes(permission)
    );

    if (!hasAnyPermission) {
      throw new ErrorResponse(
        403,
        `At least one of these permissions required: ${permissions.join(', ')}`
      );
    }

    // Update last active time
    adminRecord.lastActiveAt = new Date();
    await adminRecord.save();

    context.user = adminRecord;
    return skip;
  };
};

// Role-based protection
export const requireRole = (roles: string[]) => {
  return async (_: unknown, __: unknown, context: { user: any }) => {
    const user = context.user;

    if (!user) {
      throw new ErrorResponse(401, 'Authentication required');
    }

    const adminRecord = await Admin.findById(user.id);
    if (!adminRecord) {
      throw new ErrorResponse(404, 'Admin user not found');
    }

    if (!adminRecord.isActive) {
      throw new ErrorResponse(403, 'Admin account is deactivated.');
    }

    if (!roles.includes(adminRecord.role)) {
      throw new ErrorResponse(
        403,
        `Required role: ${roles.join(' or ')}. Current role: ${adminRecord.role}`
      );
    }

    // Update last active time
    adminRecord.lastActiveAt = new Date();
    await adminRecord.save();

    context.user = adminRecord;
    return skip;
  };
};

// Helper function to check if user has permission (for use in resolvers)
export const hasPermission = (user: any, permission: string): boolean => {
  if (!user) return false;

  // Super admin has all permissions
  if (user.role === 'SUPER_ADMIN') return true;

  const userPermissions = user.permissions || [];
  const rolePermissions =
    ROLE_PERMISSIONS[user.role as keyof typeof ROLE_PERMISSIONS] || [];

  return (
    userPermissions.includes(permission) || rolePermissions.includes(permission)
  );
};

// Helper function to check if user has role (for use in resolvers)
export const hasRole = (user: any, roles: string[]): boolean => {
  if (!user) return false;
  return roles.includes(user.role);
};

// Helper function to get user permissions (for use in resolvers)
export const getUserPermissions = (user: any): string[] => {
  if (!user) return [];

  const userPermissions = user.permissions || [];
  const rolePermissions =
    ROLE_PERMISSIONS[user.role as keyof typeof ROLE_PERMISSIONS] || [];

  // Remove duplicates and return
  return [...new Set([...userPermissions, ...rolePermissions])];
};

// Utility to extract user from token (for context setup)
export const extractUserFromToken = (token: string) => {
  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET_KEY as string
    ) as any;
    return decoded;
  } catch (error) {
    return null;
  }
};
