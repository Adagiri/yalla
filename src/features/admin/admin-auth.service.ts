// src/features/admin/admin-auth.service.ts
import Admin from './admin.model';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { ErrorResponse } from '../../utils/responses';
import AuditLogService from './audit-log.service';
import { generateAdminAuthToken, generateAuthToken } from '../../utils/auth';

interface AdminCreateInput {
  firstname: string;
  lastname: string;
  email: string;
  password: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'SUPPORT' | 'ANALYST';
  department: string;
  employeeId?: string;
  phone?: string;
  permissions?: string[];
}

interface AdminUpdateInput {
  firstname?: string;
  lastname?: string;
  email?: string;
  role?: string;
  department?: string;
  employeeId?: string;
  phone?: string;
  permissions?: string[];
  timezone?: string;
  language?: string;
  profilePhoto?: string;
}

class AdminAuthService {
  /**
   * Admin login
   */
  static async login(email: string, password: string) {
    try {
      // Find admin by email
      const admin = await Admin.findOne({
        email: email.toLowerCase(),
        isActive: true,
      }).select('+password');

      if (!admin) {
        throw new ErrorResponse(401, 'Invalid credentials');
      }

      console.log(admin);

      // Check password
      const isPasswordValid = await bcrypt.compare(password, admin.password);
      if (!isPasswordValid) {
        throw new ErrorResponse(401, 'Invalid credentials');
      }

      // Update last login
      admin.lastLoginAt = new Date();
      admin.lastActiveAt = new Date();
      admin.totalLogins += 1;
      await admin.save();

      // Generate JWT token
      const token = generateAdminAuthToken({
        id: admin._id,
        role: admin.role,
        permissions: admin.permissions,
        email: admin.email,
      });

      // Log login
      await AuditLogService.logAction({
        adminId: admin._id,
        adminEmail: admin.email,
        adminRole: admin.role,
        action: 'login',
        resource: 'auth',
        success: true,
      });

      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      return {
        token,
        admin: admin.toSafeObject(),
        expiresAt,
      };
    } catch (error: any) {
      // Log failed login attempt
      await AuditLogService.logAction({
        adminId: null,
        adminEmail: email,
        adminRole: null,
        action: 'login_failed',
        resource: 'auth',
        success: false,
        errorMessage: error.message,
      });

      throw error;
    }
  }

  /**
   * Admin logout
   */
  static async logout(adminId: string) {
    try {
      const admin = await Admin.findById(adminId);
      if (!admin) {
        throw new ErrorResponse(404, 'Admin not found');
      }

      // Update last active time
      admin.lastActiveAt = new Date();
      await admin.save();

      // Log logout
      await AuditLogService.logAction({
        adminId: admin._id,
        adminEmail: admin.email,
        adminRole: admin.role,
        action: 'logout',
        resource: 'auth',
        success: true,
      });

      return {
        success: true,
        message: 'Logged out successfully',
      };
    } catch (error: any) {
      throw new ErrorResponse(500, 'Error during logout', error.message);
    }
  }

  /**
   * Get current admin
   */
  static async getCurrentAdmin(adminId: string) {
    try {
      const admin = await Admin.findById(adminId).select('-password');

      if (!admin) {
        throw new ErrorResponse(404, 'Admin not found');
      }

      if (!admin.isActive) {
        throw new ErrorResponse(403, 'Admin account is deactivated');
      }

      // Update last active time
      admin.lastActiveAt = new Date();
      await admin.save();

      return admin.toSafeObject();
    } catch (error: any) {
      throw new ErrorResponse(500, 'Error fetching admin', error.message);
    }
  }

  /**
   * Get all admins with pagination
   */
  static async getAllAdmins(
    options: { page?: number; limit?: number; includeInactive?: boolean } = {}
  ) {
    try {
      const { page = 1, limit = 20, includeInactive = false } = options;

      const query = includeInactive ? {} : { isActive: true };
      const skip = (page - 1) * limit;

      const [admins, total] = await Promise.all([
        Admin.find(query)
          .select('-password')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        Admin.countDocuments(query),
      ]);

      return {
        admins: admins.map((admin) => ({
          ...admin,
          id: admin._id,
        })),
        total,
        page,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPreviousPage: page > 1,
      };
    } catch (error: any) {
      throw new ErrorResponse(500, 'Error fetching admins', error.message);
    }
  }

  /**
   * Get admin by ID
   */
  static async getAdminById(adminId: string) {
    try {
      const admin = await Admin.findById(adminId).select('-password');

      if (!admin) {
        throw new ErrorResponse(404, 'Admin not found');
      }

      return admin.toSafeObject();
    } catch (error: any) {
      throw new ErrorResponse(500, 'Error fetching admin', error.message);
    }
  }

  /**
   * Create new admin
   */
  static async createAdmin(input: AdminCreateInput, createdBy: string) {
    try {
      // Check if email already exists
      const existingAdmin = await Admin.findOne({
        email: input.email.toLowerCase(),
      });

      if (existingAdmin) {
        throw new ErrorResponse(400, 'Admin with this email already exists');
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(input.password, 12);

      // Create admin
      const admin = new Admin({
        firstname: input.firstname,
        lastname: input.lastname,
        email: input.email.toLowerCase(),
        password: hashedPassword,
        role: input.role,
        department: input.department,
        employeeId: input.employeeId,
        phone: input.phone,
        permissions: input.permissions || [],
        isActive: true,
        isEmailVerified: true, // Auto-verify for created admins
        createdBy,
      });

      await admin.save();

      return admin.toSafeObject();
    } catch (error: any) {
      console.log(error);
      throw new ErrorResponse(500, 'Error creating admin', error.message);
    }
  }

  /**
   * Update admin
   */
  static async updateAdmin(
    adminId: string,
    input: AdminUpdateInput,
    updatedBy: string
  ) {
    try {
      const admin = await Admin.findById(adminId);

      if (!admin) {
        throw new ErrorResponse(404, 'Admin not found');
      }

      // Check if email is being changed and if it's unique
      if (input.email && input.email.toLowerCase() !== admin.email) {
        const existingAdmin = await Admin.findOne({
          email: input.email.toLowerCase(),
          _id: { $ne: adminId },
        });

        if (existingAdmin) {
          throw new ErrorResponse(400, 'Admin with this email already exists');
        }
      }

      // Update fields
      const updateData: any = {};
      if (input.firstname) updateData.firstname = input.firstname;
      if (input.lastname) updateData.lastname = input.lastname;
      if (input.email) updateData.email = input.email.toLowerCase();
      if (input.role) updateData.role = input.role;
      if (input.department) updateData.department = input.department;
      if (input.employeeId) updateData.employeeId = input.employeeId;
      if (input.phone) updateData.phone = input.phone;
      if (input.permissions) updateData.permissions = input.permissions;
      if (input.timezone) updateData.timezone = input.timezone;
      if (input.language) updateData.language = input.language;
      if (input.profilePhoto) updateData.profilePhoto = input.profilePhoto;

      updateData.updatedAt = new Date();

      const updatedAdmin = await Admin.findByIdAndUpdate(adminId, updateData, {
        new: true,
      }).select('-password');

      return updatedAdmin!.toSafeObject();
    } catch (error: any) {
      throw new ErrorResponse(500, 'Error updating admin', error.message);
    }
  }

  /**
   * Activate admin
   */
  static async activateAdmin(adminId: string, activatedBy: string) {
    try {
      const admin = await Admin.findById(adminId);

      if (!admin) {
        throw new ErrorResponse(404, 'Admin not found');
      }

      if (admin.isActive) {
        throw new ErrorResponse(400, 'Admin is already active');
      }

      admin.isActive = true;
      admin.updatedAt = new Date();
      await admin.save();

      return admin.toSafeObject();
    } catch (error: any) {
      throw new ErrorResponse(500, 'Error activating admin', error.message);
    }
  }

  /**
   * Deactivate admin
   */
  static async deactivateAdmin(adminId: string, deactivatedBy: string) {
    try {
      const admin = await Admin.findById(adminId);

      if (!admin) {
        throw new ErrorResponse(404, 'Admin not found');
      }

      if (!admin.isActive) {
        throw new ErrorResponse(400, 'Admin is already inactive');
      }

      // Don't allow deactivating the last super admin
      if (admin.role === 'SUPER_ADMIN') {
        const activeAdminCount = await Admin.countDocuments({
          role: 'SUPER_ADMIN',
          isActive: true,
          _id: { $ne: adminId },
        });

        if (activeAdminCount === 0) {
          throw new ErrorResponse(
            400,
            'Cannot deactivate the last super admin'
          );
        }
      }

      admin.isActive = false;
      admin.updatedAt = new Date();
      await admin.save();

      return admin.toSafeObject();
    } catch (error: any) {
      throw new ErrorResponse(500, 'Error deactivating admin', error.message);
    }
  }

  /**
   * Delete admin (soft delete)
   */
  static async deleteAdmin(adminId: string, deletedBy: string) {
    try {
      const admin = await Admin.findById(adminId);

      if (!admin) {
        throw new ErrorResponse(404, 'Admin not found');
      }

      // Don't allow deleting the last super admin
      if (admin.role === 'SUPER_ADMIN') {
        const activeAdminCount = await Admin.countDocuments({
          role: 'SUPER_ADMIN',
          isActive: true,
          _id: { $ne: adminId },
        });

        if (activeAdminCount === 0) {
          throw new ErrorResponse(400, 'Cannot delete the last super admin');
        }
      }

      // Soft delete by deactivating and marking as deleted
      admin.isActive = false;
      admin.email = `deleted_${Date.now()}_${admin.email}`;
      admin.updatedAt = new Date();
      await admin.save();

      return {
        success: true,
        message: 'Admin deleted successfully',
      };
    } catch (error: any) {
      throw new ErrorResponse(500, 'Error deleting admin', error.message);
    }
  }

  /**
   * Change admin password
   */
  static async changePassword(
    adminId: string,
    currentPassword: string,
    newPassword: string
  ) {
    try {
      const admin = await Admin.findById(adminId);

      if (!admin) {
        throw new ErrorResponse(404, 'Admin not found');
      }

      // Verify current password
      const isCurrentPasswordValid = await bcrypt.compare(
        currentPassword,
        admin.password
      );
      if (!isCurrentPasswordValid) {
        throw new ErrorResponse(400, 'Current password is incorrect');
      }

      // Hash new password
      const hashedNewPassword = await bcrypt.hash(newPassword, 12);

      // Update password
      admin.password = hashedNewPassword;
      admin.updatedAt = new Date();
      await admin.save();

      // Log password change
      await AuditLogService.logAction({
        adminId: admin._id,
        adminEmail: admin.email,
        adminRole: admin.role,
        action: 'change_password',
        resource: 'auth',
        success: true,
      });

      return {
        success: true,
        message: 'Password changed successfully',
      };
    } catch (error: any) {
      throw new ErrorResponse(500, 'Error changing password', error.message);
    }
  }

  /**
   * Update admin permissions
   */
  static async updatePermissions(
    adminId: string,
    permissions: string[],
    updatedBy: string
  ) {
    try {
      const admin = await Admin.findById(adminId);

      if (!admin) {
        throw new ErrorResponse(404, 'Admin not found');
      }

      const oldPermissions = [...admin.permissions];
      admin.permissions = permissions;
      admin.updatedAt = new Date();
      await admin.save();

      // Log permission change
      await AuditLogService.logAction({
        adminId: updatedBy,
        adminEmail: '', // Will be filled by audit service
        adminRole: '', // Will be filled by audit service
        action: 'update_permissions',
        resource: 'admin',
        resourceId: adminId,
        changes: {
          before: { permissions: oldPermissions },
          after: { permissions },
          fieldsChanged: ['permissions'],
        },
        success: true,
      });

      return admin.toSafeObject();
    } catch (error: any) {
      throw new ErrorResponse(500, 'Error updating permissions', error.message);
    }
  }

  /**
   * Get admin activity summary
   */
  static async getAdminActivity(adminId: string, days: number = 30) {
    try {
      const admin = await Admin.findById(adminId).select('-password');

      if (!admin) {
        throw new ErrorResponse(404, 'Admin not found');
      }

      // Get audit logs for the admin
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const activity = await AuditLogService.getAuditLogs({
        adminId,
        startDate,
        page: 1,
        limit: 100,
      });

      return {
        admin: admin.toSafeObject(),
        activitySummary: {
          totalActions: activity.total,
          recentActions: activity.logs,
          lastActive: admin.lastActiveAt,
          totalLogins: admin.totalLogins,
        },
      };
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error fetching admin activity',
        error.message
      );
    }
  }
}

export default AdminAuthService;
