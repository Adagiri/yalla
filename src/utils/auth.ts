import crypto from 'crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { ENV } from '../config/env';

const IV_LENGTH = 16; // AES block size for IV

export const hashPassword = async (password: string): Promise<string> => {
  const saltRounds = 10;
  return bcrypt.hash(password, saltRounds);
};

export const verifyPassword = async (
  password: string,
  hashedPassword: string
): Promise<boolean> => {
  return bcrypt.compare(password, hashedPassword);
};

export const generateAuthToken = (payload: any): string => {
  let expiresIn = '500d';

  payload.accountType === 'USER' && (expiresIn = '120d');
  return jwt.sign(payload, ENV.JWT_SECRET_KEY, { expiresIn: expiresIn });
};

export const generateAdminAuthToken = (payload: any): string => {
  return jwt.sign(payload, ENV.JWT_SECRET_KEY, { expiresIn: '1d' });
};

export const generateVerificationCode = (
  bytes: number,
  expiryInMins: number
): {
  token: string;
  encryptedToken: string;
  tokenExpiry: Date | null;
  code: string;
} => {
  const token = crypto.randomBytes(bytes).toString('hex');

  const tokenExpiry = expiryInMins
    ? new Date(Date.now() + expiryInMins * 60 * 1000)
    : null;

  const encryptedToken = crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');

  const code = generateRandomNumbers(4);

  return { token, encryptedToken, tokenExpiry, code };
};

export const getEncryptedToken = (token: string): string => {
  const encryptedToken = crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');

  return encryptedToken;
};

const generateRandomNumbers = (length: number): string => {
  return Array.from({ length })
    .map(() => Math.floor(Math.random() * 10))
    .join('');
};
