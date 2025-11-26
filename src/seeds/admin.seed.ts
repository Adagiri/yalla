import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import Admin from '../features/admin/admin.model';
import { ENV } from '../config/env';

export const seedInitialAdmin = async () => {
  try {
    // Check if any super admin exists
    const existingSuperAdmin = await Admin.findOne({
      role: 'SUPER_ADMIN',
      isActive: true,
    });

    if (existingSuperAdmin) {
      console.log('Super admin already exists. Skipping seed.');
      return;
    }

    // Create initial super admin
    const hashedPassword = await bcrypt.hash('SuperAdmin123!', 12);

    const superAdmin = new Admin({
      firstname: 'Super',
      lastname: 'Admin',
      email: 'admin@yalla.ng', // Change this to your email
      password: hashedPassword,
      role: 'SUPER_ADMIN',
      department: 'IT',
      employeeId: 'SA001',
      isEmailVerified: true,
      isActive: true,
      permissions: [], // Super admin has all permissions by default
      timezone: 'UTC',
      language: 'en',
    });

    await superAdmin.save();
    console.log('Initial super admin created successfully!');
    console.log('Email: admin@yourdomain.com');
    console.log('Password: SuperAdmin123!');
    console.log('Please change these credentials after first login.');
  } catch (error) {
    console.error('Error seeding initial admin:', error);
  }
};
