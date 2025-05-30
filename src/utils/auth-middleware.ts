import jwt from 'jsonwebtoken';
import { ErrorResponse } from './responses';
import Admin from '../features/admin/admin.model';
import Driver from '../features/driver/driver.model';
import Customer from '../features/customer/customer.model';
import { skip } from 'graphql-resolvers';
import { AccountType } from '../constants/general';

export const getUserInfo = (token: string) => {
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET_KEY as string);
    return payload || null;
  } catch {
    return null;
  }
};

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
    throw new ErrorResponse(404, 'User does not exist.');
  }

  if (userRecord.accountType !== AccountType.ADMIN) {
    throw new ErrorResponse(403, 'Not authorized as admin.');
  }

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

export const protectEntities = (requiredEntities: string[]) => {
  return async (_: unknown, __: unknown, context: { user: any }) => {
    const user = context.user;
    if (!user) {
      throw new ErrorResponse(401, 'Please log in to continue');
    }

    let userRecord: any;

    // Check Admin
    if (requiredEntities.includes('ADMIN')) {
      userRecord = await Admin.findById(user.id);
      if (userRecord && userRecord.accountType === AccountType.ADMIN) {
        context.user = userRecord;
        return skip;
      }
    }

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
