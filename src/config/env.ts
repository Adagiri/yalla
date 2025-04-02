import dotenv from 'dotenv';
dotenv.config();

export const ENV = {
  PORT: process.env.PORT || 8000,
  MONGO_URI: process.env.MONGO_URI || '',
  JWT_SECRET_KEY: process.env.JWT_SECRET_KEY || '',
  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY || '',
  INVOICE_WEBHOOK_KEY: process.env.INVOICE_WEBHOOK_KEY || '',
  YALLA_APP_HOSTNAME: process.env.YALLA_APP_HOSTNAME || '',

  // AWS SES Configuration
  AWS_REGION: process.env.AWS_REGION || '',
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID || '',
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY || '',
  AWS_S3_ASSET_UPLOAD_BUCKET: process.env.AWS_S3_ASSET_UPLOAD_BUCKET || '',
  AWS_ASSET_HOSTNAME: process.env.AWS_ASSET_HOSTNAME || '',
  SES_FROM_EMAIL: process.env.SES_FROM_EMAIL || '',

  // Twilio Configuration
  TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID || '',
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN || '',
  TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER || '',
  TWILIO_NOTIFY_SERVICE_SID: process.env.TWILIO_NOTIFY_SERVICE_SID || '',

  // Paystack Configuration
  PAYSTACK_PUBLIC_KEY: process.env.PAYSTACK_PUBLIC_KEY || '',
  PAYSTACK_SECRET_KEY: process.env.PAYSTACK_SECRET_KEY || '',
  PAYSTACK_BASE_URL: process.env.PAYSTACK_BASE_URL || 'https://api.paystack.co',
  PAYSTACK_BANK_TRANSFER_PAYMENT_METHOD:
    process.env.PAYSTACK_BANK_TRANSFER_PAYMENT_METHOD || 'bank_transfer',
  PAYSTACK_CARD_PAYMENT_METHOD:
    process.env.PAYSTACK_CARD_PAYMENT_METHOD || 'card',
  PAYSTACK_AUTH_CODE_ENCRYPTION_KEY:
    process.env.PAYSTACK_AUTH_CODE_ENCRYPTION_KEY || 'asdflkjhg',

  GOOGLE_API_KEY: process.env.GOOGLE_API_KEY || '',

  // TERMII
  TERMII_BASE_URL: process.env.TERMII_BASE_URL || '',
  TERMII_SENDER_ID: process.env.TERMII_SENDER_ID || '',
  TERMII_API_KEY: process.env.TERMII_API_KEY || '',
};
