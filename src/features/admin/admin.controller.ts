// src/features/admin/admin.controller.ts - Complete Admin Controller
import AdminAnalyticsService from './admin-analytics.service';
import AdminAuthService from './admin-auth.service';
import AuditLogService from './audit-log.service';
import SystemMonitoringService from './system-monitoring.service';
import AdminSystemConfigService from './admin-system-config.service';
import AdminNotificationService from './admin-notification.service';
import NotificationService from '../../services/notification.services';
import Driver from '../driver/driver.model';
import Customer from '../customer/customer.model';
import Trip from '../trip/trip.model';
import Admin from './admin.model';
import { ErrorResponse } from '../../utils/responses';
import { ContextType } from '../../types';
import { AccountType } from '../../constants/general';

class AdminController {
  // ===== AUTHENTICATION & ADMIN MANAGEMENT =====
  static async adminLogin(
    _: any,
    { input }: { input: { email: string; password: string } }
  ) {
    const { email, password } = input;
    try {
      return await AdminAuthService.login(email, password);
    } catch (error: any) {
      throw new ErrorResponse(401, 'Authentication failed', error.message);
    }
  }

  static async adminLogout(_: any, __: any, { user }: ContextType) {
    try {
      return await AdminAuthService.logout(user.id);
    } catch (error: any) {
      throw new ErrorResponse(500, 'Logout failed', error.message);
    }
  }

  static async getCurrentAdmin(_: any, __: any, { user }: ContextType) {
    try {
      return await AdminAuthService.getCurrentAdmin(user.id);
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error fetching current admin',
        error.message
      );
    }
  }

  static async getAllAdmins(
    _: any,
    { page = 1, limit = 20 }: { page?: number; limit?: number }
  ) {
    try {
      return await AdminAuthService.getAllAdmins({ page, limit });
    } catch (error: any) {
      throw new ErrorResponse(500, 'Error fetching admins', error.message);
    }
  }

  static async getAdminById(_: any, { id }: { id: string }) {
    try {
      return await AdminAuthService.getAdminById(id);
    } catch (error: any) {
      throw new ErrorResponse(500, 'Error fetching admin', error.message);
    }
  }

  static async createAdmin(
    _: any,
    { input }: { input: any },
    { user }: ContextType
  ) {
    user = {
      email: 'ibrahimridwan477@gmail.com',
      id: '1234567890',
      role: 'SUPER_ADMIN',
      accountType: AccountType.ADMIN,
      name: user.name
    };
    try {
      const admin = await AdminAuthService.createAdmin(input, user.id);

      await AuditLogService.logAction({
        adminId: user.id,
        adminEmail: user.email,
        adminRole: user.role,
        action: 'create_admin',
        resource: 'admin',
        resourceId: admin._id,
        success: true,
      });

      return admin;
    } catch (error: any) {
      throw new ErrorResponse(500, 'Error creating admin', error.message);
    }
  }

  static async updateAdmin(
    _: any,
    { id, input }: { id: string; input: any },
    { user }: ContextType
  ) {
    try {
      const admin = await AdminAuthService.updateAdmin(id, input, user.id);

      await AuditLogService.logAction({
        adminId: user.id,
        adminEmail: user.email,
        adminRole: user.role,
        action: 'update_admin',
        resource: 'admin',
        resourceId: id,
        success: true,
      });

      return admin;
    } catch (error: any) {
      throw new ErrorResponse(500, 'Error updating admin', error.message);
    }
  }

  static async activateAdmin(
    _: any,
    { id }: { id: string },
    { user }: ContextType
  ) {
    try {
      const admin = await AdminAuthService.activateAdmin(id, user.id);

      await AuditLogService.logAction({
        adminId: user.id,
        adminEmail: user.email,
        adminRole: user.role,
        action: 'activate_admin',
        resource: 'admin',
        resourceId: id,
        success: true,
      });

      return admin;
    } catch (error: any) {
      throw new ErrorResponse(500, 'Error activating admin', error.message);
    }
  }

  static async deactivateAdmin(
    _: any,
    { id }: { id: string },
    { user }: ContextType
  ) {
    try {
      const admin = await AdminAuthService.deactivateAdmin(id, user.id);

      await AuditLogService.logAction({
        adminId: user.id,
        adminEmail: user.email,
        adminRole: user.role,
        action: 'deactivate_admin',
        resource: 'admin',
        resourceId: id,
        success: true,
      });

      return admin;
    } catch (error: any) {
      throw new ErrorResponse(500, 'Error deactivating admin', error.message);
    }
  }

  static async deleteAdmin(
    _: any,
    { id }: { id: string },
    { user }: ContextType
  ) {
    try {
      const result = await AdminAuthService.deleteAdmin(id, user.id);

      await AuditLogService.logAction({
        adminId: user.id,
        adminEmail: user.email,
        adminRole: user.role,
        action: 'delete_admin',
        resource: 'admin',
        resourceId: id,
        success: true,
      });

      return result;
    } catch (error: any) {
      throw new ErrorResponse(500, 'Error deleting admin', error.message);
    }
  }

  // ===== DASHBOARD & ANALYTICS =====
  static async getDashboardMetrics(
    _: any,
    { dateRange }: any,
    { user }: ContextType
  ) {
    try {
      await AuditLogService.logAction({
        adminId: user.id,
        adminEmail: user.email,
        adminRole: user.role,
        action: 'view_dashboard',
        resource: 'dashboard',
        success: true,
      });

      return await AdminAnalyticsService.getDashboardMetrics(dateRange);
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error fetching dashboard metrics',
        error.message
      );
    }
  }

  static async getSystemHealth(_: any, __: any, { user }: ContextType) {
    try {
      return await SystemMonitoringService.getSystemHealth();
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error fetching system health',
        error.message
      );
    }
  }

  static async getSystemHealthHistory(
    _: any,
    { hours = 24 }: { hours?: number }
  ) {
    try {
      return await SystemMonitoringService.getSystemHealthHistory(hours);
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error fetching system health history',
        error.message
      );
    }
  }

  static async getSystemAlerts(
    _: any,
    { severity, resolved }: { severity?: string; resolved?: boolean }
  ) {
    try {
      return await SystemMonitoringService.getSystemAlerts({
        severity,
        resolved,
      });
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error fetching system alerts',
        error.message
      );
    }
  }

  // ===== NOTIFICATIONS =====
  static async getMyNotifications(
    _: any,
    { page = 1, limit = 20 }: { page?: number; limit?: number },
    { user }: ContextType
  ) {
    try {
      return await AdminNotificationService.getAdminNotifications(user.id, {
        page,
        limit,
      });
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error fetching notifications',
        error.message
      );
    }
  }

  static async getNotificationStats(_: any, __: any, { user }: ContextType) {
    try {
      return await AdminNotificationService.getNotificationStats(user.id);
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error fetching notification stats',
        error.message
      );
    }
  }

  static async createNotification(
    _: any,
    { input }: { input: any },
    { user }: ContextType
  ) {
    try {
      const notification = await AdminNotificationService.createNotification({
        ...input,
        senderId: user.id,
      });

      await AuditLogService.logAction({
        adminId: user.id,
        adminEmail: user.email,
        adminRole: user.role,
        action: 'create_notification',
        resource: 'notification',
        success: true,
      });

      return notification;
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error creating notification',
        error.message
      );
    }
  }

  static async broadcastNotification(
    _: any,
    { input }: { input: any },
    { user }: ContextType
  ) {
    try {
      const result = await AdminNotificationService.broadcastNotification({
        ...input,
        senderId: user.id,
      });

      await AuditLogService.logAction({
        adminId: user.id,
        adminEmail: user.email,
        adminRole: user.role,
        action: 'broadcast_notification',
        resource: 'notification',
        success: true,
      });

      return result;
    } catch (error: any) {
      console.log(error, "Error from broadcasting notification")
      throw new ErrorResponse(
        500,
        'Error broadcasting notification',
        error.message
      );
    }
  }

  static async markNotificationAsRead(
    _: any,
    { id }: { id: string },
    { user }: ContextType
  ) {
    try {
      return await AdminNotificationService.markAsRead(id, user.id);
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error marking notification as read',
        error.message
      );
    }
  }

  static async markAllNotificationsAsRead(
    _: any,
    __: any,
    { user }: ContextType
  ) {
    try {
      return await AdminNotificationService.markAllAsRead(user.id);
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error marking all notifications as read',
        error.message
      );
    }
  }

  static async deleteNotification(
    _: any,
    { id }: { id: string },
    { user }: ContextType
  ) {
    try {
      const result = await AdminNotificationService.deleteNotification(
        id,
        user.id
      );

      await AuditLogService.logAction({
        adminId: user.id,
        adminEmail: user.email,
        adminRole: user.role,
        action: 'delete_notification',
        resource: 'notification',
        resourceId: id,
        success: true,
      });

      return result;
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error deleting notification',
        error.message
      );
    }
  }

  // ===== SYSTEM CONFIGURATION =====
  static async getSystemConfigs(_: any, { filters }: { filters?: any }) {
    try {
      return await AdminSystemConfigService.getSystemConfigs(filters || {});
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error fetching system configs',
        error.message
      );
    }
  }

  static async getSystemConfig(_: any, { id }: { id: string }) {
    try {
      return await AdminSystemConfigService.getConfigById(id);
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error fetching system config',
        error.message
      );
    }
  }

  static async getConfigsByCategory(
    _: any,
    { category }: { category: string }
  ) {
    try {
      return await AdminSystemConfigService.getConfigsByCategory(category);
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error fetching configs by category',
        error.message
      );
    }
  }

  static async getConfigCategories() {
    try {
      return await AdminSystemConfigService.getCategories();
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error fetching config categories',
        error.message
      );
    }
  }

  static async createSystemConfig(
    _: any,
    { input }: { input: any },
    { user }: ContextType
  ) {
    try {
      const config = await AdminSystemConfigService.createConfig({
        ...input,
        adminId: user.id,
        adminEmail: user.email,
        adminRole: user.role,
      });

      return config;
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error creating system config',
        error.message
      );
    }
  }

  static async updateSystemConfig(
    _: any,
    { id, input }: { id: string; input: any },
    { user }: ContextType
  ) {
    try {
      const config = await AdminSystemConfigService.updateConfig({
        configId: id,
        value: input.value,
        adminId: user.id,
        adminEmail: user.email,
        adminRole: user.role,
      });

      return config;
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error updating system config',
        error.message
      );
    }
  }

  static async deleteSystemConfig(
    _: any,
    { id }: { id: string },
    { user }: ContextType
  ) {
    try {
      const result = await AdminSystemConfigService.deleteConfig(id, {
        adminId: user.id,
        adminEmail: user.email,
        adminRole: user.role,
      });

      return result;
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error deleting system config',
        error.message
      );
    }
  }

  static async bulkUpdateConfigs(
    _: any,
    { updates }: { updates: any[] },
    { user }: ContextType
  ) {
    try {
      return await AdminSystemConfigService.bulkUpdateConfigs(updates, {
        adminId: user.id,
        adminEmail: user.email,
        adminRole: user.role,
      });
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error bulk updating configs',
        error.message
      );
    }
  }

  // ===== AUDIT LOGS =====
  static async getAuditLogs(_: any, { filters }: { filters?: any }) {
    try {
      return await AuditLogService.getAuditLogs(filters || {});
    } catch (error: any) {
      throw new ErrorResponse(500, 'Error fetching audit logs', error.message);
    }
  }

  static async getAuditStats(_: any, { days = 30 }: { days?: number }) {
    try {
      return await AuditLogService.getAuditStats(days);
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error fetching audit statistics',
        error.message
      );
    }
  }

  // ===== SYSTEM MANAGEMENT =====
  static async resolveSystemAlert(
    _: any,
    { id, resolution }: { id: string; resolution: string },
    { user }: ContextType
  ) {
    try {
      const result = await SystemMonitoringService.resolveAlert(
        id,
        resolution,
        user.id
      );

      await AuditLogService.logAction({
        adminId: user.id,
        adminEmail: user.email,
        adminRole: user.role,
        action: 'resolve_alert',
        resource: 'system_alert',
        resourceId: id,
        success: true,
      });

      return result;
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error resolving system alert',
        error.message
      );
    }
  }

  static async triggerSystemHealthCheck(
    _: any,
    __: any,
    { user }: ContextType
  ) {
    try {
      const result = await SystemMonitoringService.triggerHealthCheck();

      await AuditLogService.logAction({
        adminId: user.id,
        adminEmail: user.email,
        adminRole: user.role,
        action: 'trigger_health_check',
        resource: 'system',
        success: true,
      });

      return result;
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error triggering health check',
        error.message
      );
    }
  }

  static async cleanupOldData(
    _: any,
    { type, olderThan }: { type: string; olderThan: number },
    { user }: ContextType
  ) {
    try {
      const result = await SystemMonitoringService.cleanupOldData(
        type,
        olderThan
      );

      await AuditLogService.logAction({
        adminId: user.id,
        adminEmail: user.email,
        adminRole: user.role,
        action: 'cleanup_data',
        resource: 'system',
        success: true,
      });

      return result;
    } catch (error: any) {
      throw new ErrorResponse(500, 'Error cleaning up old data', error.message);
    }
  }

  // ===== EMAIL TEMPLATES =====
  static async listEmailTemplates() {
    try {
      return await NotificationService.listEmailTemplates();
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error fetching email templates',
        error.message
      );
    }
  }

  static async createEmailTemplate(
    _: any,
    { input }: { input: any },
    { user }: ContextType
  ) {
    try {
      const result = await NotificationService.createEmailTemplate(input);

      await AuditLogService.logAction({
        adminId: user.id,
        adminEmail: user.email,
        adminRole: user.role,
        action: 'create_email_template',
        resource: 'email_template',
        success: true,
      });

      return result;
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error creating email template',
        error.message
      );
    }
  }

  static async updateEmailTemplate(
    _: any,
    { input }: { input: any },
    { user }: ContextType
  ) {
    try {
      const result = await NotificationService.updateEmailTemplate(input);

      await AuditLogService.logAction({
        adminId: user.id,
        adminEmail: user.email,
        adminRole: user.role,
        action: 'update_email_template',
        resource: 'email_template',
        success: true,
      });

      return result;
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error updating email template',
        error.message
      );
    }
  }

  static async deleteEmailTemplate(
    _: any,
    { name }: { name: string },
    { user }: ContextType
  ) {
    try {
      const result = await NotificationService.deleteEmailTemplate(name);

      await AuditLogService.logAction({
        adminId: user.id,
        adminEmail: user.email,
        adminRole: user.role,
        action: 'delete_email_template',
        resource: 'email_template',
        success: true,
      });

      return result;
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error deleting email template',
        error.message
      );
    }
  }
}

export default AdminController;
