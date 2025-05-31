import dotenv from 'dotenv';
dotenv.config();

export const ENV = {
  PORT: process.env.PORT || 8000,
  MONGO_URI: process.env.MONGO_URI || '',
  JWT_SECRET_KEY: process.env.JWT_SECRET_KEY || '',
  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY || '',
  INVOICE_WEBHOOK_KEY: process.env.INVOICE_WEBHOOK_KEY || '',
  YALLA_APP_HOSTNAME: process.env.YALLA_APP_HOSTNAME || '',

  // AWS Core Configuration
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID || '',
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY || '',

  // AWS SES Configuration
  AWS_SES_REGION: process.env.AWS_SES_REGION || 'us-east-1',
  AWS_SES_FROM_EMAIL: process.env.AWS_SES_FROM_EMAIL || '',

  // AWS S3 Configuration
  AWS_S3_REGION: process.env.AWS_S3_REGION || 'us-east-1',
  AWS_S3_ASSET_BUCKET: process.env.AWS_S3_ASSET_BUCKET || '',
  AWS_S3_ASSET_HOSTNAME: process.env.AWS_S3_ASSET_HOSTNAME || '',

  // AWS Location Services Configuration
  AWS_LOCATION_REGION: process.env.AWS_LOCATION_REGION || 'us-east-1',
  AWS_LOCATION_MAP_NAME: process.env.AWS_LOCATION_MAP_NAME || '',
  AWS_LOCATION_PLACE_INDEX_NAME:
    process.env.AWS_LOCATION_PLACE_INDEX_NAME || '',
  AWS_LOCATION_ROUTE_CALCULATOR_NAME:
    process.env.AWS_LOCATION_ROUTE_CALCULATOR_NAME || '',
  AWS_LOCATION_GEOFENCE_COLLECTION_NAME:
    process.env.AWS_LOCATION_GEOFENCE_COLLECTION_NAME || '',
  AWS_LOCATION_TRACKER_NAME: process.env.AWS_LOCATION_TRACKER_NAME || '',

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

  // Redis Configuration
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  REDIS_HOST: process.env.REDIS_HOST || 'localhost',
  REDIS_PORT: process.env.REDIS_PORT || '6379',
  REDIS_PASSWORD: process.env.REDIS_PASSWORD || '',

  // Firebase Configuration
  FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || '',
  FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL || '',
  FIREBASE_PRIVATE_KEY_IN_BASE_64:
    process.env.FIREBASE_PRIVATE_KEY_IN_BASE_64 || '',

  // WebSocket Configuration
  ALLOWED_ORIGINS:
    process.env.ALLOWED_ORIGINS ||
    'http://localhost:3000,http://localhost:4000',
};
