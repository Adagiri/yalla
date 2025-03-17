import { Request, Response } from 'express';
import User from '../features/user/user.model';
import { getUserInfo } from '../utils/auth-middleware';
import { ExpressContextFunctionArgument } from '@apollo/server/dist/esm/express4';

export const context = async ({ req, res }: ExpressContextFunctionArgument) => {
  const token = req.headers.authorization?.split(' ')[1];
  const user = token ? getUserInfo(token) : null;

  return {
    req,
    res,
    user,
    models: {
      User,
    },
  };
};
