import Customer from '../features/customer/customer.model';
import Driver from '../features/driver/driver.model';
import ReferralCode from '../features/referral/referral-code.model';
import { AccountType_ } from '../constants/general';

/**
 * Migration Script: Generate Referral Codes for Existing Users
 *
 * Run this once after deploying the referral system to generate codes
 * for all existing customers and drivers.
 *
 * Usage:
 * - One-time: node dist/scripts/generate-existing-user-codes.js
 * - Or call from admin endpoint
 */

async function generateReferralCodeForUser(
  userId: string,
  userType: string,
  firstname?: string,
  lastname?: string
): Promise<string> {
  // Check if user already has a code
  const existingCode = await ReferralCode.findOne({
    userId,
    isActive: true,
    campaignId: { $exists: false }, // Only general codes, not campaign-specific
  });

  if (existingCode) {
    return existingCode.code;
  }

  // Generate code from user's name
  const namePart = (firstname || '')
    .substring(0, 4)
    .toUpperCase()
    .replace(/[^A-Z]/g, '');
  const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
  let code = namePart ? `${namePart}${randomPart}` : Math.random().toString(36).substring(2, 8).toUpperCase();

  // Ensure uniqueness
  let finalCode = code;
  let attempts = 0;
  while (attempts < 10) {
    const existing = await ReferralCode.findOne({ code: finalCode });
    if (!existing) break;

    finalCode = `${code}${Math.floor(Math.random() * 99)}`;
    attempts++;
  }

  if (attempts >= 10) {
    // Use UUID-based code as fallback
    finalCode = Math.random().toString(36).substring(2, 10).toUpperCase();
  }

  // Create referral code
  await ReferralCode.create({
    userId,
    userType,
    code: finalCode,
    isActive: true,
    timesUsed: 0,
  });

  return finalCode;
}

/**
 * Generate codes for all existing customers
 */
async function generateCustomerCodes(): Promise<{
  total: number;
  generated: number;
  skipped: number;
  errors: number;
}> {
  const stats = {
    total: 0,
    generated: 0,
    skipped: 0,
    errors: 0,
  };

  try {
    const customers = await Customer.find({}).select('_id firstname lastname');
    stats.total = customers.length;

    console.log(`Found ${customers.length} customers`);

    for (const customer of customers) {
      try {
        const code = await generateReferralCodeForUser(
          customer._id,
          AccountType_.CUSTOMER,
          customer.firstname,
          customer.lastname
        );

        console.log(`✅ Customer ${customer._id}: ${code}`);
        stats.generated++;
      } catch (error: any) {
        console.error(`❌ Error for customer ${customer._id}:`, error.message);
        stats.errors++;
      }
    }
  } catch (error) {
    console.error('Error fetching customers:', error);
    throw error;
  }

  return stats;
}

/**
 * Generate codes for all existing drivers
 */
async function generateDriverCodes(): Promise<{
  total: number;
  generated: number;
  skipped: number;
  errors: number;
}> {
  const stats = {
    total: 0,
    generated: 0,
    skipped: 0,
    errors: 0,
  };

  try {
    const drivers = await Driver.find({}).select('_id firstname lastname');
    stats.total = drivers.length;

    console.log(`Found ${drivers.length} drivers`);

    for (const driver of drivers) {
      try {
        const code = await generateReferralCodeForUser(
          driver._id,
          AccountType_.DRIVER,
          driver.firstname,
          driver.lastname
        );

        console.log(`✅ Driver ${driver._id}: ${code}`);
        stats.generated++;
      } catch (error: any) {
        console.error(`❌ Error for driver ${driver._id}:`, error.message);
        stats.errors++;
      }
    }
  } catch (error) {
    console.error('Error fetching drivers:', error);
    throw error;
  }

  return stats;
}

/**
 * Main migration function
 */
export async function generateExistingUserReferralCodes(): Promise<{
  customers: { total: number; generated: number; errors: number };
  drivers: { total: number; generated: number; errors: number };
  totalGenerated: number;
  totalErrors: number;
}> {
  console.log('🚀 Starting referral code generation for existing users...\n');

  const startTime = Date.now();

  // Generate for customers
  console.log('📱 Generating codes for customers...');
  const customerStats = await generateCustomerCodes();
  console.log(`✅ Customers done: ${customerStats.generated} generated, ${customerStats.errors} errors\n`);

  // Generate for drivers
  console.log('🚗 Generating codes for drivers...');
  const driverStats = await generateDriverCodes();
  console.log(`✅ Drivers done: ${driverStats.generated} generated, ${driverStats.errors} errors\n`);

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  const summary = {
    customers: {
      total: customerStats.total,
      generated: customerStats.generated,
      errors: customerStats.errors,
    },
    drivers: {
      total: driverStats.total,
      generated: driverStats.generated,
      errors: driverStats.errors,
    },
    totalGenerated: customerStats.generated + driverStats.generated,
    totalErrors: customerStats.errors + driverStats.errors,
  };

  console.log('📊 Summary:');
  console.log(`   Total users: ${customerStats.total + driverStats.total}`);
  console.log(`   ✅ Generated: ${summary.totalGenerated}`);
  console.log(`   ❌ Errors: ${summary.totalErrors}`);
  console.log(`   ⏱️  Duration: ${duration}s\n`);

  return summary;
}

// If run directly
if (require.main === module) {
  (async () => {
    try {
      // Import mongoose connection
      const mongoose = require('mongoose');
      const { ENV } = require('../config/env');

      // Connect to database
      await mongoose.connect(ENV.MONGO_URI);
      console.log('✅ Connected to database\n');

      // Run migration
      const result = await generateExistingUserReferralCodes();

      // Disconnect
      await mongoose.disconnect();
      console.log('✅ Disconnected from database');

      // Exit with appropriate code
      process.exit(result.totalErrors > 0 ? 1 : 0);
    } catch (error) {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    }
  })();
}

export default generateExistingUserReferralCodes;
