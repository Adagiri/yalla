import dotenv from 'dotenv';
dotenv.config();

export const ENV = {
  // Application Settings
  get PORT() {
    return parseInt(process.env.PORT || '8000');
  },

  get MONGO_URI() {
    return process.env.MONGO_URI || '';
  },

  get JWT_SECRET_KEY() {
    return process.env.JWT_SECRET_KEY || '';
  },

  get ENCRYPTION_KEY() {
    return process.env.ENCRYPTION_KEY || '';
  },

  get INVOICE_WEBHOOK_KEY() {
    return process.env.INVOICE_WEBHOOK_KEY || '';
  },

  get YALLA_APP_HOSTNAME() {
    return process.env.YALLA_APP_HOSTNAME || '';
  },

  // AWS Core Configuration
  get AWS_ACCESS_KEY_ID() {
    return process.env.AWS_ACCESS_KEY_ID || '';
  },

  get AWS_SECRET_ACCESS_KEY() {
    return process.env.AWS_SECRET_ACCESS_KEY || '';
  },

  // AWS SES Configuration
  get AWS_SES_REGION() {
    return process.env.AWS_SES_REGION || 'us-east-1';
  },

  get AWS_SES_FROM_EMAIL() {
    return process.env.AWS_SES_FROM_EMAIL || '';
  },

  // AWS S3 Configuration
  get AWS_S3_REGION() {
    return process.env.AWS_S3_REGION || 'us-east-1';
  },

  get AWS_S3_ASSET_BUCKET() {
    return process.env.AWS_S3_ASSET_BUCKET || '';
  },

  get AWS_S3_ASSET_HOSTNAME() {
    return process.env.AWS_S3_ASSET_HOSTNAME || '';
  },

  // AWS Location Services Configuration
  get AWS_LOCATION_REGION() {
    return process.env.AWS_LOCATION_REGION || 'us-east-1';
  },

  get AWS_LOCATION_MAP_NAME() {
    return process.env.AWS_LOCATION_MAP_NAME || '';
  },

  get AWS_LOCATION_PLACE_INDEX_NAME() {
    return process.env.AWS_LOCATION_PLACE_INDEX_NAME || '';
  },

  get AWS_LOCATION_ROUTE_CALCULATOR_NAME() {
    return process.env.AWS_LOCATION_ROUTE_CALCULATOR_NAME || '';
  },

  get AWS_LOCATION_GEOFENCE_COLLECTION_NAME() {
    return process.env.AWS_LOCATION_GEOFENCE_COLLECTION_NAME || '';
  },

  get AWS_LOCATION_TRACKER_NAME() {
    return process.env.AWS_LOCATION_TRACKER_NAME || '';
  },

  // Paystack Configuration
  get PAYSTACK_PUBLIC_KEY() {
    return process.env.PAYSTACK_PUBLIC_KEY || '';
  },

  get PAYSTACK_SECRET_KEY() {
    return process.env.PAYSTACK_SECRET_KEY || '';
  },

  get PAYSTACK_BASE_URL() {
    return process.env.PAYSTACK_BASE_URL || 'https://api.paystack.co';
  },

  get PAYSTACK_BANK_TRANSFER_PAYMENT_METHOD() {
    return process.env.PAYSTACK_BANK_TRANSFER_PAYMENT_METHOD || 'bank_transfer';
  },

  get PAYSTACK_CARD_PAYMENT_METHOD() {
    return process.env.PAYSTACK_CARD_PAYMENT_METHOD || 'card';
  },

  get PAYSTACK_AUTH_CODE_ENCRYPTION_KEY() {
    return process.env.PAYSTACK_AUTH_CODE_ENCRYPTION_KEY || 'asdflkjhg';
  },

  get GOOGLE_API_KEY() {
    return process.env.GOOGLE_API_KEY || '';
  },

  // TERMII
  get TERMII_BASE_URL() {
    return process.env.TERMII_BASE_URL || '';
  },

  get TERMII_SENDER_ID() {
    return process.env.TERMII_SENDER_ID || '';
  },

  get TERMII_API_KEY() {
    return process.env.TERMII_API_KEY || '';
  },

  // Redis Configuration
  get REDIS_HOST() {
    return process.env.REDIS_HOST || 'localhost';
  },

  get REDIS_PORT() {
    return process.env.REDIS_PORT || '6379';
  },

  get REDIS_PASSWORD() {
    return process.env.REDIS_PASSWORD || '';
  },

  // Firebase Configuration
  get FIREBASE_PROJECT_ID() {
    return process.env.FIREBASE_PROJECT_ID || '';
  },

  get FIREBASE_CLIENT_EMAIL() {
    return process.env.FIREBASE_CLIENT_EMAIL || '';
  },

  get FIREBASE_PRIVATE_KEY_IN_BASE_64() {
    return process.env.FIREBASE_PRIVATE_KEY_IN_BASE_64 || '';
  },

  // WebSocket Configuration
  get ALLOWED_ORIGINS() {
    return (
      process.env.ALLOWED_ORIGINS ||
      'http://localhost:3000,http://localhost:4000,https://admin-staging.yalla.ng'
    );
  },
};
