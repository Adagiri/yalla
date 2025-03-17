import crypto from 'crypto';
import { ENV } from '../config/env';
const algorithm = 'aes-256-cbc';

/**
 * Generates a random alphanumeric string of specified length.
 * @param length - The length of the string to generate.
 * @returns A random alphanumeric string.
 */
export const generateRandomString = (length: number): string => {
  const characters = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let randomString = '';

  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    randomString += characters.charAt(randomIndex);
  }

  return randomString;
};

/**
 * Generates a random numeric string of specified length.
 * @param length - The length of the numeric string to generate.
 * @returns A random numeric string.
 */
export const generateRandomNumbers = (length: number): string => {
  let code = '';
  while (code.length < length) {
    code += Math.floor(Math.random() * 9) + 1; // Random number between 1 and 9
  }

  return code;
};

export function filterNullAndUndefined<T>(obj: Partial<T>): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(
      ([_, value]) => value !== null && value !== undefined
    )
  ) as Partial<T>;
}

export const createWebhookHash = (secretKey: string, payload: any) => {
  return crypto
    .createHmac('sha512', secretKey)
    .update(JSON.stringify(payload))
    .digest('hex');
};

export const createMaskedPan = (brand: string, bin: string, last4: string) => {
  let totalLength = 16;
  if (
    brand.toLowerCase().includes('american express') ||
    brand.toLowerCase().includes('amex')
  ) {
    totalLength = 15;
  }

  const middleLength = totalLength - (bin.length + last4.length);

  if (middleLength < 0) {
    throw new Error(
      'Invalid input lengths for bin and last4 based on expected card length.'
    );
  }

  const maskedMiddle = '*'.repeat(middleLength);
  return `${bin}${maskedMiddle}${last4}`;
};

/**
 * Encrypts a text using a given key.
 * @param text The plain text to encrypt.
 * @param encryptionKey The secret key used for encryption.
 * @returns The IV and encrypted text concatenated with a colon.
 */
export function encrypt(text: string): string {
  const encryptionKey = ENV.PAYSTACK_AUTH_CODE_ENCRYPTION_KEY;
  // Ensure the key is 32 bytes using SHA-256 hash.
  const key = crypto.createHash('sha256').update(encryptionKey).digest();
  // Generate a random Initialization Vector (IV) of 16 bytes.
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(text, 'utf8'),
    cipher.final(),
  ]);
  // Prepend the IV to the encrypted data. Here we use hexadecimal encoding.
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

/**
 * Decrypts an encrypted text using the same key used for encryption.
 * @param data The encrypted text (IV:encryptedPayload).
 * @param encryptionKey The secret key used for encryption.
 * @returns The decrypted plain text.
 */
export function decrypt(data: string): string {
  const encryptionKey = ENV.PAYSTACK_AUTH_CODE_ENCRYPTION_KEY;
  const [ivHex, encryptedHex] = data.split(':');
  if (!ivHex || !encryptedHex) {
    throw new Error('Invalid encrypted data format');
  }
  const iv = Buffer.from(ivHex, 'hex');
  const encryptedText = Buffer.from(encryptedHex, 'hex');
  const key = crypto.createHash('sha256').update(encryptionKey).digest();
  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  const decrypted = Buffer.concat([
    decipher.update(encryptedText),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}


/**
 * Formats a number with thousand separators and two decimal places.
 *
 * @param amount - The number to format.
 * @param locale - The locale to use for formatting (default is 'en-US').
 * @returns The formatted number string.
 */
export function formatNumber(
  amount: number,
  locale: string = 'en-US'
): string {
  return new Intl.NumberFormat(locale, {
    style: 'decimal',
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(amount);
}
