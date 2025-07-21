import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Admin from './admin.model';
import { ErrorResponse } from '../../utils/responses';
import { ROLE_PERMISSIONS } from '../../constants/admin-permissions';

class AdminAuthService {
  /**
   * Authenticate admin user
   */
  static async authenticateAdmin(email: string, password: string) {
    try {
      // Find admin with password
      const admin = await Admin.findOne({ email, isActive: true }).select(
        '+password'
      );

      if (!admin) {
        throw new ErrorResponse(401, 'Invalid credentials');
      }

      // Check if account is locked
      if (admin.lockedUntil && admin.lockedUntil > new Date()) {
        throw new ErrorResponse(
          423,
          'Account temporarily locked due to too many failed attempts'
        );
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, admin.password);
      if (!isValidPassword) {
        await this.handleFailedLogin(admin);
        throw new ErrorResponse(401, 'Invalid credentials');
      }

      // Reset login attempts and update last login
      await Admin.findByIdAndUpdate(admin._id, {
        loginAttempts: 0,
        lockedUntil: undefined,
        lastLoginAt: new Date(),
        lastActiveAt: new Date(),
      });

      // Generate JWT token
      const token = this.generateAdminToken(admin);

      // Remove password from response
      const adminData = admin.toObject();
      delete adminData.password;

      return {
        admin: adminData,
        token,
        permissions: await this.getAdminPermissions(admin._id),
      };
    } catch (error: any) {
      throw new ErrorResponse(500, 'Authentication failed', error.message);
    }
  }

  /**
   * Handle failed login attempts
   */
  private static async handleFailedLogin(admin: any) {
    const maxAttempts = 5;
    const lockoutTime = 30 * 60 * 1000; // 30 minutes

    const updates: any = {
      loginAttempts: admin.loginAttempts + 1,
    };

    if (admin.loginAttempts + 1 >= maxAttempts) {
      updates.lockedUntil = new Date(Date.now() + lockoutTime);
    }

    await Admin.findByIdAndUpdate(admin._id, updates);
  }

  /**
   * Generate JWT token for admin
   */
  private static generateAdminToken(admin: any): string {
    const payload = {
      id: admin._id,
      email: admin.email,
      role: admin.role,
      accountType: admin.accountType,
      accessLevel: admin.accessLevel,
    };

    return jwt.sign(payload, process.env.JWT_SECRET_KEY as string, {
      expiresIn: `${admin.sessionTimeoutMinutes}m`,
    });
  }

  /**
   * Get admin permissions based on role and custom permissions
   */
  static async getAdminPermissions(adminId: string): Promise<string[]> {
    const admin = await Admin.findById(adminId);
    if (!admin) return [];

    // Get role-based permissions
    const rolePermissions = ROLE_PERMISSIONS[admin.role] || [];

    // Merge with custom permissions
    const allPermissions = [
      ...new Set([...rolePermissions, ...admin.permissions]),
    ];

    return allPermissions;
  }

  /**
   * Check if admin has specific permission
   */
  static async hasPermission(
    adminId: string,
    permission: string
  ): Promise<boolean> {
    const permissions = await this.getAdminPermissions(adminId);
    return permissions.includes(permission);
  }

  /**
   * Update admin last active time
   */
  static async updateLastActive(adminId: string) {
    await Admin.findByIdAndUpdate(adminId, {
      lastActiveAt: new Date(),
    });
  }

  /**
   * Create new admin user
   */
  static async createAdmin(
    adminData: {
      firstname: string;
      lastname: string;
      email: string;
      password: string;
      role: string;
      department?: string;
      permissions?: string[];
    },
    createdBy: string
  ) {
    try {
      // Hash password
      const hashedPassword = await bcrypt.hash(adminData.password, 12);

      // Create admin
      const admin = new Admin({
        ...adminData,
        password: hashedPassword,
        createdBy,
        permissions: adminData.permissions || [],
      });

      await admin.save();

      // Remove password from response
      const adminResponse = admin.toObject();
      delete adminResponse.password;

      return adminResponse;
    } catch (error: any) {
      if (error.code === 11000) {
        throw new ErrorResponse(400, 'Email already exists');
      }
      throw new ErrorResponse(500, 'Error creating admin', error.message);
    }
  }
}

export default AdminAuthService;
