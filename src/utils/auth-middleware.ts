import jwt from 'jsonwebtoken';
import { ErrorResponse } from './responses';
import Admin from '../features/admin/admin.model';
import Driver from '../features/driver/driver.model';
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

  if (userRecord.accountType !== 'admin') {
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
    throw new ErrorResponse(403, 'Not authorized as a user.');
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
    if (requiredEntities.includes('ADMIN')) {
      userRecord = await Admin.findById(user.id);
    }
    if (!userRecord && requiredEntities.includes('DRIVER')) {
      userRecord = await Driver.findById(user.id);
    }

    if (!userRecord) {
      throw new ErrorResponse(404, 'User record not found.');
    }

    if (!requiredEntities.includes(userRecord.accountType)) {
      throw new ErrorResponse(
        403,
        `User is not authorized as ${userRecord.accountType}.`
      );
    }
    context.user = userRecord;
    return skip;
  };
};
