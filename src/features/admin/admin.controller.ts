// src/features/admin/admin.controller.ts - Comprehensive Admin Controller
import AdminAnalyticsService from './admin-analytics.service';
import AdminAuthService from './admin-auth.service';
import AuditLogService from './audit-log.service';
import SystemMonitoringService from './system-monitoring.service';
import PaymentModelService from '../payment-model/payment-model.services';
import SubscriptionService from '../subscription/subscription.service';
import NotificationService from '../../services/notification.services';
import Driver from '../driver/driver.model';
import Customer from '../customer/customer.model';
import Trip from '../trip/trip.model';
import Admin from './admin.model';
import { ErrorResponse } from '../../utils/responses';
import { ADMIN_PERMISSIONS } from '../../constants/admin-permissions';
import { ContextType } from '../../types';
import WalletService from '../../services/wallet.service';

class AdminController {
  /**
   * DASHBOARD & ANALYTICS
   */
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
      await AuditLogService.logAction({
        adminId: user.id,
        adminEmail: user.email,
        adminRole: user.role,
        action: 'view_dashboard',
        resource: 'dashboard',
        success: false,
        errorMessage: error.message,
      });
      throw new ErrorResponse(
        500,
        'Error fetching dashboard metrics',
        error.message
      );
    }
  }

  static async getRevenueAnalytics(
    _: any,
    { period = 'daily', days = 30 }: { period: string; days: number },
    { user }: ContextType
  ) {
    try {
      return await AdminAnalyticsService.getRevenueAnalytics(
        period as any,
        days
      );
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error fetching revenue analytics',
        error.message
      );
    }
  }

  static async getDriverPerformanceAnalytics(
    _: any,
    { driverId, dateRange }: { driverId?: string; dateRange?: any },
    { user }: ContextType
  ) {
    try {
      return await AdminAnalyticsService.getDriverPerformanceAnalytics(
        driverId,
        dateRange
      );
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error fetching driver analytics',
        error.message
      );
    }
  }

  static async getGeographicAnalytics(
    _: any,
    { dateRange }: any,
    { user }: ContextType
  ) {
    try {
      return await AdminAnalyticsService.getGeographicAnalytics(dateRange);
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error fetching geographic analytics',
        error.message
      );
    }
  }

  /**
   * DRIVER MANAGEMENT
   */
  static async getAllDrivers(
    _: any,
    {
      page = 1,
      limit = 20,
      status,
      paymentModel,
      searchTerm,
    }: {
      page?: number;
      limit?: number;
      status?: string;
      paymentModel?: string;
      searchTerm?: string;
    },
    { user }: ContextType
  ) {
    try {
      const query: any = {};

      if (status) query.isOnline = status === 'online';
      if (paymentModel) query.paymentModel = paymentModel;
      if (searchTerm) {
        query.$or = [
          { firstname: { $regex: searchTerm, $options: 'i' } },
          { lastname: { $regex: searchTerm, $options: 'i' } },
          { email: { $regex: searchTerm, $options: 'i' } },
        ];
      }

      const skip = (page - 1) * limit;
      const [drivers, total] = await Promise.all([
        Driver.find(query)
          .populate('walletId')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        Driver.countDocuments(query),
      ]);

      return {
        drivers,
        total,
        page,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPreviousPage: page > 1,
      };
    } catch (error: any) {
      throw new ErrorResponse(500, 'Error fetching drivers', error.message);
    }
  }

  static async getDriverDetails(
    _: any,
    { driverId }: { driverId: string },
    { user }: ContextType
  ) {
    try {
      const [driver, activeSubscription, tripStats, walletBalance] =
        await Promise.all([
          Driver.findById(driverId).populate('walletId'),
          SubscriptionService.getActiveSubscription(driverId),
          this.getDriverTripStats(driverId),
          WalletService.getUserWallet(driverId),
        ]);

      if (!driver) {
        throw new ErrorResponse(404, 'Driver not found');
      }

      return {
        driver,
        activeSubscription,
        tripStats,
        walletBalance,
      };
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error fetching driver details',
        error.message
      );
    }
  }

  static async updateDriverStatus(
    _: any,
    { driverId, isActive }: { driverId: string; isActive: boolean },
    { user }: ContextType
  ) {
    try {
      const beforeDriver = await Driver.findById(driverId);

      const driver = await Driver.findByIdAndUpdate(
        driverId,
        { isActive, lastModifiedBy: user.id },
        { new: true }
      );

      if (!driver) {
        throw new ErrorResponse(404, 'Driver not found');
      }

      // Log action
      await AuditLogService.logAction({
        adminId: user.id,
        adminEmail: user.email,
        adminRole: user.role,
        action: isActive ? 'activate_driver' : 'suspend_driver',
        resource: 'driver',
        resourceId: driverId,
        changes: AuditLogService.detectChanges(beforeDriver, driver),
        success: true,
      });

      // Send notification to driver
      await NotificationService.sendNotification({
        userId: driverId,
        userType: 'driver',
        type: isActive ? 'account_activated' : 'account_suspended',
        title: isActive ? 'Account Activated' : 'Account Suspended',
        message: isActive
          ? 'Your driver account has been activated'
          : 'Your driver account has been suspended. Please contact support.',
        sendPush: true,
        sendSMS: true,
      });

      return driver;
    } catch (error: any) {
      await AuditLogService.logAction({
        adminId: user.id,
        adminEmail: user.email,
        adminRole: user.role,
        action: isActive ? 'activate_driver' : 'suspend_driver',
        resource: 'driver',
        resourceId: driverId,
        success: false,
        errorMessage: error.message,
      });
      throw new ErrorResponse(
        500,
        'Error updating driver status',
        error.message
      );
    }
  }

  static async approveDriverDocuments(
    _: any,
    { driverId, documentType }: { driverId: string; documentType: string },
    { user }: ContextType
  ) {
    try {
      const updateData: any = {};

      switch (documentType) {
        case 'license':
          updateData.driverLicenseVerified = true;
          break;
        case 'vehicle':
          updateData.vehicleInspectionDone = true;
          break;
        default:
          throw new ErrorResponse(400, 'Invalid document type');
      }

      const driver = await Driver.findByIdAndUpdate(
        driverId,
        { ...updateData, lastModifiedBy: user.id },
        { new: true }
      );

      if (!driver) {
        throw new ErrorResponse(404, 'Driver not found');
      }

      // Log action
      await AuditLogService.logAction({
        adminId: user.id,
        adminEmail: user.email,
        adminRole: user.role,
        action: 'approve_document',
        resource: 'driver',
        resourceId: driverId,
        success: true,
      });

      // Send notification
      await NotificationService.sendNotification({
        userId: driverId,
        userType: 'driver',
        type: 'document_approved',
        title: 'Document Approved',
        message: `Your ${documentType} has been approved`,
        sendPush: true,
      });

      return driver;
    } catch (error: any) {
      throw new ErrorResponse(500, 'Error approving document', error.message);
    }
  }

  /**
   * CUSTOMER MANAGEMENT
   */
  static async getAllCustomers(
    _: any,
    {
      page = 1,
      limit = 20,
      searchTerm,
    }: { page?: number; limit?: number; searchTerm?: string },
    { user }: ContextType
  ) {
    try {
      const query: any = {};

      if (searchTerm) {
        query.$or = [
          { firstname: { $regex: searchTerm, $options: 'i' } },
          { lastname: { $regex: searchTerm, $options: 'i' } },
          { email: { $regex: searchTerm, $options: 'i' } },
        ];
      }

      const skip = (page - 1) * limit;
      const [customers, total] = await Promise.all([
        Customer.find(query)
          .populate('walletId')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        Customer.countDocuments(query),
      ]);

      return {
        customers,
        total,
        page,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error: any) {
      throw new ErrorResponse(500, 'Error fetching customers', error.message);
    }
  }

  static async getCustomerDetails(
    _: any,
    { customerId }: { customerId: string }
  ) {
    try {
      const [customer, tripStats, walletBalance] = await Promise.all([
        Customer.findById(customerId).populate('walletId'),
        this.getCustomerTripStats(customerId),
        WalletService.getUserWallet(customerId),
      ]);

      if (!customer) {
        throw new ErrorResponse(404, 'Customer not found');
      }

      return {
        customer,
        tripStats,
        walletBalance,
      };
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error fetching customer details',
        error.message
      );
    }
  }

  /**
   * TRIP MANAGEMENT
   */
  static async getAllTrips(
    _: any,
    {
      page = 1,
      limit = 20,
      status,
      paymentMethod,
      dateRange,
    }: {
      page?: number;
      limit?: number;
      status?: string;
      paymentMethod?: string;
      dateRange?: any;
    }
  ) {
    try {
      const query: any = {};

      if (status) query.status = status;
      if (paymentMethod) query.paymentMethod = paymentMethod;
      if (dateRange) {
        query.createdAt = {
          $gte: new Date(dateRange.startDate),
          $lte: new Date(dateRange.endDate),
        };
      }

      const skip = (page - 1) * limit;
      const [trips, total] = await Promise.all([
        Trip.find(query)
          .populate(['driverId', 'customerId'])
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        Trip.countDocuments(query),
      ]);

      return {
        trips,
        total,
        page,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error: any) {
      throw new ErrorResponse(500, 'Error fetching trips', error.message);
    }
  }

  static async getTripDetails(_: any, { tripId }: { tripId: string }) {
    try {
      const trip = await Trip.findById(tripId).populate([
        'driverId',
        'customerId',
      ]);

      if (!trip) {
        throw new ErrorResponse(404, 'Trip not found');
      }

      return trip;
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error fetching trip details',
        error.message
      );
    }
  }

  static async assignTripToDriver(
    _: any,
    { tripId, driverId }: { tripId: string; driverId: string },
    { user }: ContextType
  ) {
    try {
      const trip = await Trip.findByIdAndUpdate(
        tripId,
        {
          driverId,
          status: 'driver_assigned',
          assignedBy: user.id,
          acceptedAt: new Date(),
        },
        { new: true }
      );

      if (!trip) {
        throw new ErrorResponse(404, 'Trip not found');
      }

      // Log action
      await AuditLogService.logAction({
        adminId: user.id,
        adminEmail: user.email,
        adminRole: user.role,
        action: 'assign_trip',
        resource: 'trip',
        resourceId: tripId,
        success: true,
      });

      // Send notifications
      await Promise.all([
        NotificationService.sendNotification({
          userId: driverId,
          userType: 'driver',
          type: 'trip_assigned',
          title: 'Trip Assigned',
          message: 'You have been assigned a new trip',
          data: { tripId },
          sendPush: true,
        }),
        NotificationService.sendNotification({
          userId: trip.customerId,
          userType: 'customer',
          type: 'driver_assigned',
          title: 'Driver Found',
          message: 'A driver has been assigned to your trip',
          data: { tripId, driverId },
          sendPush: true,
        }),
      ]);

      return trip;
    } catch (error: any) {
      throw new ErrorResponse(500, 'Error assigning trip', error.message);
    }
  }

  /**
   * FINANCIAL MANAGEMENT
   */
  static async getFinancialOverview(_: any, { dateRange }: any) {
    try {
      return await AdminAnalyticsService.getFinancialMetrics(dateRange);
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error fetching financial overview',
        error.message
      );
    }
  }

  static async processPendingPayouts(_: any, __: any, { user }: ContextType) {
    try {
      // Get pending cashout requests
      const Transaction = require('../transaction/transaction.model').default;
      const pendingPayouts = await Transaction.find({
        purpose: 'cashout',
        status: 'pending',
      }).populate('userId');

      const results = [];
      for (const payout of pendingPayouts) {
        try {
          // Process payout (implement actual payout logic)
          await Transaction.findByIdAndUpdate(payout._id, {
            status: 'completed',
            completedAt: new Date(),
            processedBy: user.id,
          });

          results.push({ id: payout._id, status: 'success' });
        } catch (error: any) {
          results.push({
            id: payout._id,
            status: 'failed',
            error: error.message,
          });
        }
      }

      // Log action
      await AuditLogService.logAction({
        adminId: user.id,
        adminEmail: user.email,
        adminRole: user.role,
        action: 'process_payouts',
        resource: 'payouts',
        success: true,
      });

      return results;
    } catch (error: any) {
      throw new ErrorResponse(500, 'Error processing payouts', error.message);
    }
  }

  static async creditUserWallet(
    _: any,
    {
      userId,
      amount,
      reason,
    }: { userId: string; amount: number; reason: string },
    { user }: ContextType
  ) {
    try {
      const result = await WalletService.creditWallet({
        userId,
        amount,
        type: 'credit',
        purpose: 'admin_credit',
        description: reason,
        paymentMethod: 'system',
      });

      // Log action
      await AuditLogService.logAction({
        adminId: user.id,
        adminEmail: user.email,
        adminRole: user.role,
        action: 'credit_wallet',
        resource: 'wallet',
        resourceId: userId,
        success: true,
      });

      return result.transaction;
    } catch (error: any) {
      throw new ErrorResponse(500, 'Error crediting wallet', error.message);
    }
  }

  /**
   * SYSTEM ADMINISTRATION
   */
  static async getSystemHealth() {
    try {
      return await SystemMonitoringService.getCurrentStatus();
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
      return await SystemMonitoringService.getHealthHistory(hours);
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error fetching system health history',
        error.message
      );
    }
  }

  static async getAuditLogs(_: any, { filters }: { filters: any }) {
    try {
      return await AuditLogService.getAuditLogs(filters);
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

  /**
   * ADMIN USER MANAGEMENT
   */
  static async getAllAdmins(
    _: any,
    { page = 1, limit = 20 }: { page?: number; limit?: number }
  ) {
    try {
      const skip = (page - 1) * limit;
      const [admins, total] = await Promise.all([
        Admin.find({ isActive: true })
          .select('-password')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        Admin.countDocuments({ isActive: true }),
      ]);

      return {
        admins,
        total,
        page,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error: any) {
      throw new ErrorResponse(500, 'Error fetching admins', error.message);
    }
  }

  static async createAdmin(
    _: any,
    { input }: { input: any },
    { user }: ContextType
  ) {
    try {
      const admin = await AdminAuthService.createAdmin(input, user.id);

      // Log action
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

  /**
   * COMMUNICATION & NOTIFICATIONS
   */
  static async sendBroadcastNotification(
    _: any,
    {
      target,
      title,
      message,
      userType,
    }: {
      target: 'all' | 'drivers' | 'customers';
      title: string;
      message: string;
      userType: string;
    },
    { user }: ContextType
  ) {
    try {
      let recipients: string[] = [];

      if (target === 'all' || target === 'drivers') {
        const drivers = await Driver.find({ isActive: true }).select('_id');
        recipients.push(...drivers.map((d) => d._id));
      }

      if (target === 'all' || target === 'customers') {
        const customers = await Customer.find().select('_id');

        if (customers && customers.length > 0) {
          recipients.push(...customers.map((c) => String(c._id)));
        }
      }

      // Send notifications (implement batch notification logic)
      const results = await Promise.all(
        recipients.map((userId) =>
          NotificationService.sendNotification({
            userId,
            userType:
              target === 'drivers'
                ? 'driver'
                : target === 'customers'
                  ? 'customer'
                  : 'admin',
            type: 'broadcast',
            title,
            message,
            sendPush: true,
          })
        )
      );

      // Log action
      await AuditLogService.logAction({
        adminId: user.id,
        adminEmail: user.email,
        adminRole: user.role,
        action: 'send_broadcast',
        resource: 'notification',
        success: true,
      });

      return {
        sent: results.length,
        target,
        title,
        message,
      };
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error sending broadcast notification',
        error.message
      );
    }
  }

  /**
   * Helper methods
   */
  private static async getDriverTripStats(driverId: string) {
    const stats = await Trip.aggregate([
      { $match: { driverId, status: 'completed' } },
      {
        $group: {
          _id: null,
          totalTrips: { $sum: 1 },
          totalEarnings: { $sum: '$driverEarnings' },
          averageRating: { $avg: '$driverRating' },
          totalDistance: { $sum: '$route.distance' },
        },
      },
    ]);

    return (
      stats[0] || {
        totalTrips: 0,
        totalEarnings: 0,
        averageRating: 0,
        totalDistance: 0,
      }
    );
  }

  private static async getCustomerTripStats(customerId: string) {
    const stats = await Trip.aggregate([
      { $match: { customerId, status: 'completed' } },
      {
        $group: {
          _id: null,
          totalTrips: { $sum: 1 },
          totalSpent: { $sum: '$pricing.finalAmount' },
          averageRating: { $avg: '$customerRating' },
        },
      },
    ]);

    return (
      stats[0] || {
        totalTrips: 0,
        totalSpent: 0,
        averageRating: 0,
      }
    );
  }

  // Email template management (existing methods)
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
