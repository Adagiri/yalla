// src/features/admin/admin-auth.service.ts - COMPLETE FILE
import Admin from './admin.model';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { ErrorResponse } from '../../utils/responses';
import AuditLogService from './audit-log.service';
import {
  generateAdminAuthToken,
  generateVerificationCode,
  getEncryptedToken,
  hashPassword,
} from '../../utils/auth';
import NotificationService from '../../services/notification.services';
import { EmailTemplate } from '../../constants/general';

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

interface AdminResetPasswordInput {
  email: string;
  code: string;
  token: string;
  newPassword: string;
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
        accountType: 'ADMIN', // For compatibility
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
   * Get current admin profile
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
        isEmailVerified: true, // Auto-verify for admin accounts
        createdBy,
      });

      await admin.save();

      // Log admin creation
      await AuditLogService.logAction({
        adminId: createdBy,
        adminEmail: '', // Will be filled by audit service
        adminRole: '', // Will be filled by audit service
        action: 'create_admin',
        resource: 'admin',
        resourceId: admin._id,
        success: true,
      });

      return admin.toSafeObject();
    } catch (error: any) {
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

      // Check if email is being changed and if it already exists
      if (input.email && input.email.toLowerCase() !== admin.email) {
        const existingAdmin = await Admin.findOne({
          email: input.email.toLowerCase(),
          _id: { $ne: adminId },
        });

        if (existingAdmin) {
          throw new ErrorResponse(400, 'Email already exists');
        }
      }

      // Store old values for audit
      const oldValues = {
        firstname: admin.firstname,
        lastname: admin.lastname,
        email: admin.email,
        role: admin.role,
        department: admin.department,
        employeeId: admin.employeeId,
        phone: admin.phone,
        permissions: [...admin.permissions],
        timezone: admin.timezone,
        language: admin.language,
        profilePhoto: admin.profilePhoto,
      };

      // Update fields
      Object.keys(input).forEach((key) => {
        if (input[key as keyof AdminUpdateInput] !== undefined) {
          if (key === 'email') {
            admin[key] = input[key]!.toLowerCase();
          } else {
            admin[key as keyof AdminUpdateInput] =
              input[key as keyof AdminUpdateInput];
          }
        }
      });

      admin.updatedAt = new Date();
      await admin.save();

      // Log admin update
      const changedFields = Object.keys(input).filter(
        (key) => input[key as keyof AdminUpdateInput] !== undefined
      );

      await AuditLogService.logAction({
        adminId: updatedBy,
        adminEmail: '', // Will be filled by audit service
        adminRole: '', // Will be filled by audit service
        action: 'update_admin',
        resource: 'admin',
        resourceId: adminId,
        changes: {
          before: oldValues,
          after: input,
          fieldsChanged: changedFields,
        },
        success: true,
      });

      return admin.toSafeObject();
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

      // Log activation
      await AuditLogService.logAction({
        adminId: activatedBy,
        adminEmail: '', // Will be filled by audit service
        adminRole: '', // Will be filled by audit service
        action: 'activate_admin',
        resource: 'admin',
        resourceId: adminId,
        success: true,
      });

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

      // Log deactivation
      await AuditLogService.logAction({
        adminId: deactivatedBy,
        adminEmail: '', // Will be filled by audit service
        adminRole: '', // Will be filled by audit service
        action: 'deactivate_admin',
        resource: 'admin',
        resourceId: adminId,
        success: true,
      });

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

      // Log deletion
      await AuditLogService.logAction({
        adminId: deletedBy,
        adminEmail: '', // Will be filled by audit service
        adminRole: '', // Will be filled by audit service
        action: 'delete_admin',
        resource: 'admin',
        resourceId: adminId,
        success: true,
      });

      return {
        success: true,
        message: 'Admin deleted successfully',
      };
    } catch (error: any) {
      throw new ErrorResponse(500, 'Error deleting admin', error.message);
    }
  }

  /**
   * Change admin password (when logged in)
   */
  static async changePassword(
    adminId: string,
    currentPassword: string,
    newPassword: string
  ) {
    try {
      const admin = await Admin.findById(adminId).select('+password');

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
        action: 'password_changed',
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
   * Request password reset for admin
   */
  static async requestPasswordReset(email: string) {
    try {
      const admin = await Admin.findOne({
        email: email.toLowerCase(),
        isActive: true,
      });

      if (!admin) {
        // Don't reveal if email exists, but still respond with success
        return {
          success: true,
          message: 'If the email exists, a reset code has been sent.',
          token: 'dummy-token', // Return dummy token for non-existent emails
        };
      }

      // Generate verification code
      const { code, encryptedToken, token, tokenExpiry } =
        generateVerificationCode(32, 10);

      // Store reset code and token in admin record
      admin.resetPasswordCode = code;
      if (tokenExpiry) {
        admin.resetPasswordExpiry = tokenExpiry;
      }

      admin.resetPasswordToken = encryptedToken;
      await admin.save();

      // Send reset email
      await NotificationService.sendEmail({
        to: admin.email,
        template: EmailTemplate.RESET_PASSWORD_REQUEST,
        data: {
          name: `${admin.firstname} ${admin.lastname}`,
          c: code[0],
          o: code[1],
          d: code[2],
          e: code[3],
        },
      });

      // Log password reset request
      await AuditLogService.logAction({
        adminId: admin._id,
        adminEmail: admin.email,
        adminRole: admin.role,
        action: 'password_reset_requested',
        resource: 'auth',
        success: true,
      });

      return {
        success: true,
        message: 'Reset code sent to your email',
        token, // Return token for verification step
      };
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error processing password reset request',
        error.message
      );
    }
  }

  /**
   * Verify reset code (optional step for better UX)
   */
  static async verifyResetCode(email: string, code: string, token: string) {
    try {
      const encryptedToken = getEncryptedToken(token);

      const admin = await Admin.findOne({
        email: email.toLowerCase(),
        resetPasswordToken: encryptedToken,
        isActive: true,
      });

      if (!admin) {
        throw new ErrorResponse(404, 'Invalid token');
      }

      if (
        admin.resetPasswordCode !== code ||
        !admin.resetPasswordExpiry ||
        admin.resetPasswordExpiry < new Date()
      ) {
        throw new ErrorResponse(400, 'Invalid or expired reset code');
      }

      return {
        success: true,
        message: 'Code verified successfully',
      };
    } catch (error: any) {
      throw new ErrorResponse(500, 'Error verifying code', error.message);
    }
  }

  /**
   * Reset admin password with code
   */
  static async resetPassword({
    email,
    code,
    token,
    newPassword,
  }: AdminResetPasswordInput) {
    try {
      const encryptedToken = getEncryptedToken(token);

      const admin = await Admin.findOne({
        email: email.toLowerCase(),
        resetPasswordToken: encryptedToken,
        isActive: true,
      });

      if (!admin) {
        throw new ErrorResponse(404, 'Invalid or expired reset token');
      }

      // Check if code matches and hasn't expired
      if (
        admin.resetPasswordCode !== code ||
        !admin.resetPasswordExpiry ||
        admin.resetPasswordExpiry < new Date()
      ) {
        throw new ErrorResponse(400, 'Invalid or expired reset code');
      }

      // Hash new password
      const hashedPassword = await hashPassword(newPassword);

      // Update admin password and clear reset fields
      admin.password = hashedPassword;
      admin.resetPasswordCode = undefined;
      admin.resetPasswordToken = undefined;
      admin.resetPasswordExpiry = undefined;
      admin.updatedAt = new Date();
      await admin.save();

      // Log password reset
      await AuditLogService.logAction({
        adminId: admin._id,
        adminEmail: admin.email,
        adminRole: admin.role,
        action: 'password_reset_completed',
        resource: 'auth',
        success: true,
      });

      return {
        success: true,
        message: 'Password reset successful',
      };
    } catch (error: any) {
      throw new ErrorResponse(500, 'Error resetting password', error.message);
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

  /**
   * Update admin last active time
   */
  static async updateLastActive(adminId: string) {
    try {
      await Admin.findByIdAndUpdate(adminId, {
        lastActiveAt: new Date(),
      });
    } catch (error: any) {
      // Don't throw error for this utility function
      console.error('Error updating last active time:', error);
    }
  }

  /**
   * Check if admin has permission
   */
  static async hasPermission(
    adminId: string,
    permission: string
  ): Promise<boolean> {
    try {
      const admin = await Admin.findById(adminId).select('role permissions');

      if (!admin) return false;

      // Super admin has all permissions
      if (admin.role === 'SUPER_ADMIN') return true;

      // Check if admin has the specific permission
      return admin.permissions.includes(permission);
    } catch (error: any) {
      return false;
    }
  }

  /**
   * Get admins by role
   */
  static async getAdminsByRole(role: string) {
    try {
      const admins = await Admin.find({
        role,
        isActive: true,
      }).select('-password');

      return admins.map((admin) => admin.toSafeObject());
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error fetching admins by role',
        error.message
      );
    }
  }

  /**
   * Get admin statistics
   */
  static async getAdminStats() {
    try {
      const stats = await Admin.aggregate([
        {
          $group: {
            _id: '$role',
            count: { $sum: 1 },
            active: {
              $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] },
            },
            inactive: {
              $sum: { $cond: [{ $eq: ['$isActive', false] }, 1, 0] },
            },
          },
        },
      ]);

      const totalAdmins = await Admin.countDocuments();
      const activeAdmins = await Admin.countDocuments({ isActive: true });

      return {
        total: totalAdmins,
        active: activeAdmins,
        inactive: totalAdmins - activeAdmins,
        byRole: stats,
      };
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error fetching admin statistics',
        error.message
      );
    }
  }
}

export default AdminAuthService;
