import mongoose from 'mongoose';
import { ErrorResponse } from '../../utils/responses';
import Trip from '../trip/trip.model';
import Driver from '../driver/driver.model';
import Customer from '../customer/customer.model';
import { DriverSubscription } from '../subscription/subscription.model';
import Transaction from '../transaction/transaction.model';


interface DateRange {
  startDate: Date;
  endDate: Date;
}

interface DashboardMetrics {
  realTime: RealTimeMetrics;
  financial: FinancialMetrics;
  operational: OperationalMetrics;
  growth: GrowthMetrics;
}

interface RealTimeMetrics {
  activeTrips: number;
  onlineDrivers: number;
  availableDrivers: number;
  pendingRequests: number;
  completedTripsToday: number;
  revenueToday: number;
}

interface FinancialMetrics {
  totalRevenue: number;
  subscriptionRevenue: number;
  commissionRevenue: number;
  pendingPayouts: number;
  totalPayouts: number;
  averageTransactionValue: number;
  paymentSuccessRate: number;
}

interface OperationalMetrics {
  totalDrivers: number;
  activeDrivers: number;
  totalCustomers: number;
  activeCustomers: number;
  tripCompletionRate: number;
  averageResponseTime: number;
  customerSatisfactionScore: number;
}

interface GrowthMetrics {
  newDriversThisMonth: number;
  newCustomersThisMonth: number;
  driverRetentionRate: number;
  customerRetentionRate: number;
  monthOverMonthGrowth: number;
}

class AdminAnalyticsService {
  /**
   * Get comprehensive dashboard metrics
   */
  static async getDashboardMetrics(
    dateRange?: DateRange
  ): Promise<DashboardMetrics> {
    try {
      const [realTime, financial, operational, growth] = await Promise.all([
        this.getRealTimeMetrics(),
        this.getFinancialMetrics(dateRange),
        this.getOperationalMetrics(dateRange),
        this.getGrowthMetrics(dateRange),
      ]);

      return { realTime, financial, operational, growth };
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error fetching dashboard metrics',
        error.message
      );
    }
  }

  /**
   * Real-time operational metrics
   */
  static async getRealTimeMetrics(): Promise<RealTimeMetrics> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      activeTrips,
      onlineDrivers,
      availableDrivers,
      pendingRequests,
      completedTripsToday,
      revenueToday,
    ] = await Promise.all([
      Trip.countDocuments({
        status: { $in: ['driver_assigned', 'driver_arrived', 'in_progress'] },
      }),
      Driver.countDocuments({ isOnline: true }),
      Driver.countDocuments({ isOnline: true, isAvailable: true }),
      Trip.countDocuments({ status: 'searching' }),
      Trip.countDocuments({
        status: 'completed',
        completedAt: { $gte: today },
      }),
      this.getTodayRevenue(),
    ]);

    return {
      activeTrips,
      onlineDrivers,
      availableDrivers,
      pendingRequests,
      completedTripsToday,
      revenueToday,
    };
  }

  /**
   * Financial performance metrics
   */
  static async getFinancialMetrics(
    dateRange?: DateRange
  ): Promise<FinancialMetrics> {
    const range = dateRange || this.getDefaultDateRange();

    const [
      subscriptionRevenue,
      commissionRevenue,
      totalPayouts,
      pendingPayouts,
      transactionStats,
      paymentStats,
    ] = await Promise.all([
      this.getSubscriptionRevenue(range),
      this.getCommissionRevenue(range),
      this.getTotalPayouts(range),
      this.getPendingPayouts(),
      this.getTransactionStats(range),
      this.getPaymentSuccessRate(range),
    ]);

    const totalRevenue = subscriptionRevenue + commissionRevenue;

    return {
      totalRevenue,
      subscriptionRevenue,
      commissionRevenue,
      pendingPayouts,
      totalPayouts,
      averageTransactionValue: transactionStats.averageValue,
      paymentSuccessRate: paymentStats.successRate,
    };
  }

  /**
   * Operational performance metrics
   */
  static async getOperationalMetrics(
    dateRange?: DateRange
  ): Promise<OperationalMetrics> {
    const range = dateRange || this.getDefaultDateRange();

    const [
      totalDrivers,
      activeDrivers,
      totalCustomers,
      activeCustomers,
      tripStats,
      customerSatisfaction,
    ] = await Promise.all([
      Driver.countDocuments(),
      this.getActiveDriversCount(range),
      Customer.countDocuments(),
      this.getActiveCustomersCount(range),
      this.getTripCompletionStats(range),
      this.getCustomerSatisfactionScore(range),
    ]);

    return {
      totalDrivers,
      activeDrivers,
      totalCustomers,
      activeCustomers,
      tripCompletionRate: tripStats.completionRate,
      averageResponseTime: tripStats.averageResponseTime,
      customerSatisfactionScore: customerSatisfaction,
    };
  }

  /**
   * Growth and retention metrics
   */
  static async getGrowthMetrics(dateRange?: DateRange): Promise<GrowthMetrics> {
    const range = dateRange || this.getDefaultDateRange();
    const previousRange = this.getPreviousDateRange(range);

    const [
      newDriversThisMonth,
      newCustomersThisMonth,
      driverRetentionRate,
      customerRetentionRate,
      monthOverMonthGrowth,
    ] = await Promise.all([
      Driver.countDocuments({
        createdAt: { $gte: range.startDate, $lte: range.endDate },
      }),
      Customer.countDocuments({
        createdAt: { $gte: range.startDate, $lte: range.endDate },
      }),
      this.getDriverRetentionRate(range),
      this.getCustomerRetentionRate(range),
      this.getMonthOverMonthGrowth(range, previousRange),
    ]);

    return {
      newDriversThisMonth,
      newCustomersThisMonth,
      driverRetentionRate,
      customerRetentionRate,
      monthOverMonthGrowth,
    };
  }

  /**
   * Advanced analytics queries
   */
  static async getRevenueAnalytics(
    period: 'daily' | 'weekly' | 'monthly' = 'daily',
    days: number = 30
  ) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);

    let groupBy: any;
    switch (period) {
      case 'daily':
        groupBy = {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' },
        };
        break;
      case 'weekly':
        groupBy = {
          year: { $year: '$createdAt' },
          week: { $week: '$createdAt' },
        };
        break;
      case 'monthly':
        groupBy = {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
        };
        break;
    }

    const [subscriptionRevenue, commissionRevenue] = await Promise.all([
      DriverSubscription.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate, $lte: endDate },
            status: 'active',
          },
        },
        {
          $lookup: {
            from: 'subscriptionplans',
            localField: 'planId',
            foreignField: '_id',
            as: 'plan',
          },
        },
        { $unwind: '$plan' },
        {
          $group: {
            _id: groupBy,
            revenue: { $sum: '$plan.price' },
            count: { $sum: 1 },
          },
        },
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
      ]),
      Trip.aggregate([
        {
          $match: {
            completedAt: { $gte: startDate, $lte: endDate },
            status: 'completed',
            paymentModel: 'COMMISSION',
          },
        },
        {
          $group: {
            _id: groupBy,
            revenue: { $sum: '$platformCommission' },
            count: { $sum: 1 },
          },
        },
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
      ]),
    ]);

    return { subscriptionRevenue, commissionRevenue };
  }

  /**
   * Driver performance analytics
   */
  static async getDriverPerformanceAnalytics(
    driverId?: string,
    dateRange?: DateRange
  ) {
    const range = dateRange || this.getDefaultDateRange();
    const matchCondition: any = {
      completedAt: { $gte: range.startDate, $lte: range.endDate },
      status: 'completed',
    };

    if (driverId) {
      matchCondition.driverId = driverId;
    }

    const driverStats = await Trip.aggregate([
      { $match: matchCondition },
      {
        $group: {
          _id: '$driverId',
          totalTrips: { $sum: 1 },
          totalEarnings: { $sum: '$driverEarnings' },
          averageRating: { $avg: '$driverRating' },
          totalDistance: { $sum: '$route.distance' },
          totalDuration: { $sum: '$route.duration' },
        },
      },
      {
        $lookup: {
          from: 'drivers',
          localField: '_id',
          foreignField: '_id',
          as: 'driver',
        },
      },
      { $unwind: '$driver' },
      {
        $project: {
          driverId: '$_id',
          driverName: {
            $concat: ['$driver.firstname', ' ', '$driver.lastname'],
          },
          paymentModel: '$driver.paymentModel',
          totalTrips: 1,
          totalEarnings: 1,
          averageRating: 1,
          totalDistance: 1,
          totalDuration: 1,
          earningsPerTrip: { $divide: ['$totalEarnings', '$totalTrips'] },
          averageDistance: { $divide: ['$totalDistance', '$totalTrips'] },
        },
      },
      { $sort: { totalEarnings: -1 } },
    ]);

    return driverStats;
  }

  /**
   * Geographic analytics
   */
  static async getGeographicAnalytics(dateRange?: DateRange) {
    const range = dateRange || this.getDefaultDateRange();

    const locationStats = await Trip.aggregate([
      {
        $match: {
          completedAt: { $gte: range.startDate, $lte: range.endDate },
          status: 'completed',
        },
      },
      {
        $group: {
          _id: {
            pickupArea: '$pickup.estateId',
            destinationArea: '$destination.estateId',
          },
          tripCount: { $sum: 1 },
          totalRevenue: { $sum: '$pricing.finalAmount' },
          averageFare: { $avg: '$pricing.finalAmount' },
          averageDistance: { $avg: '$route.distance' },
        },
      },
      { $sort: { tripCount: -1 } },
    ]);

    return locationStats;
  }

  /**
   * Payment model analytics
   */
  static async getPaymentModelAnalytics(dateRange?: DateRange) {
    const range = dateRange || this.getDefaultDateRange();

    const [tripAnalytics, subscriptionAnalytics] = await Promise.all([
      Trip.aggregate([
        {
          $match: {
            completedAt: { $gte: range.startDate, $lte: range.endDate },
            status: 'completed',
          },
        },
        {
          $group: {
            _id: '$paymentModel',
            tripCount: { $sum: 1 },
            totalRevenue: { $sum: '$pricing.finalAmount' },
            platformEarnings: { $sum: '$platformCommission' },
            driverEarnings: { $sum: '$driverEarnings' },
            averageFare: { $avg: '$pricing.finalAmount' },
          },
        },
      ]),
      DriverSubscription.aggregate([
        {
          $match: {
            createdAt: { $gte: range.startDate, $lte: range.endDate },
          },
        },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    return { tripAnalytics, subscriptionAnalytics };
  }

  /**
   * Helper methods
   */
  private static async getTodayRevenue(): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [commissionRevenue, subscriptionRevenue] = await Promise.all([
      Trip.aggregate([
        {
          $match: {
            completedAt: { $gte: today },
            status: 'completed',
            paymentModel: 'COMMISSION',
          },
        },
        { $group: { _id: null, total: { $sum: '$platformCommission' } } },
      ]),
      DriverSubscription.aggregate([
        {
          $match: {
            createdAt: { $gte: today },
            status: 'active',
          },
        },
        {
          $lookup: {
            from: 'subscriptionplans',
            localField: 'planId',
            foreignField: '_id',
            as: 'plan',
          },
        },
        { $unwind: '$plan' },
        { $group: { _id: null, total: { $sum: '$plan.price' } } },
      ]),
    ]);

    const commission = commissionRevenue[0]?.total || 0;
    const subscription = subscriptionRevenue[0]?.total || 0;

    return commission + subscription;
  }

  private static async getSubscriptionRevenue(
    range: DateRange
  ): Promise<number> {
    const result = await DriverSubscription.aggregate([
      {
        $match: {
          createdAt: { $gte: range.startDate, $lte: range.endDate },
          status: 'active',
        },
      },
      {
        $lookup: {
          from: 'subscriptionplans',
          localField: 'planId',
          foreignField: '_id',
          as: 'plan',
        },
      },
      { $unwind: '$plan' },
      { $group: { _id: null, total: { $sum: '$plan.price' } } },
    ]);

    return result[0]?.total || 0;
  }

  private static async getCommissionRevenue(range: DateRange): Promise<number> {
    const result = await Trip.aggregate([
      {
        $match: {
          completedAt: { $gte: range.startDate, $lte: range.endDate },
          status: 'completed',
          paymentModel: 'COMMISSION',
        },
      },
      { $group: { _id: null, total: { $sum: '$platformCommission' } } },
    ]);

    return result[0]?.total || 0;
  }

  private static getDefaultDateRange(): DateRange {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(endDate.getMonth() - 1);
    return { startDate, endDate };
  }

  private static getPreviousDateRange(currentRange: DateRange): DateRange {
    const duration =
      currentRange.endDate.getTime() - currentRange.startDate.getTime();
    const startDate = new Date(currentRange.startDate.getTime() - duration);
    const endDate = new Date(currentRange.endDate.getTime() - duration);
    return { startDate, endDate };
  }

  private static async getTotalPayouts(range: DateRange): Promise<number> {
    const result = await Transaction.aggregate([
      {
        $match: {
          createdAt: { $gte: range.startDate, $lte: range.endDate },
          purpose: 'cashout',
          status: 'completed',
        },
      },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);

    return result[0]?.total || 0;
  }

  private static async getPendingPayouts(): Promise<number> {
    const result = await Transaction.aggregate([
      {
        $match: {
          purpose: 'cashout',
          status: 'pending',
        },
      },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);

    return result[0]?.total || 0;
  }

  private static async getTransactionStats(range: DateRange) {
    const result = await Transaction.aggregate([
      {
        $match: {
          createdAt: { $gte: range.startDate, $lte: range.endDate },
          status: 'completed',
        },
      },
      {
        $group: {
          _id: null,
          averageValue: { $avg: '$amount' },
          totalTransactions: { $sum: 1 },
        },
      },
    ]);

    return result[0] || { averageValue: 0, totalTransactions: 0 };
  }

  private static async getPaymentSuccessRate(range: DateRange) {
    const result = await Transaction.aggregate([
      {
        $match: {
          createdAt: { $gte: range.startDate, $lte: range.endDate },
        },
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    const total = result.reduce((sum, item) => sum + item.count, 0);
    const successful =
      result.find((item) => item._id === 'completed')?.count || 0;

    return { successRate: total > 0 ? (successful / total) * 100 : 0 };
  }

  private static async getActiveDriversCount(
    range: DateRange
  ): Promise<number> {
    return await Trip.distinct('driverId', {
      completedAt: { $gte: range.startDate, $lte: range.endDate },
      status: 'completed',
    }).then((drivers) => drivers.length);
  }

  private static async getActiveCustomersCount(
    range: DateRange
  ): Promise<number> {
    return await Trip.distinct('customerId', {
      completedAt: { $gte: range.startDate, $lte: range.endDate },
      status: 'completed',
    }).then((customers) => customers.length);
  }

  private static async getTripCompletionStats(range: DateRange) {
    const result = await Trip.aggregate([
      {
        $match: {
          createdAt: { $gte: range.startDate, $lte: range.endDate },
        },
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          averageResponseTime: {
            $avg: {
              $subtract: ['$acceptedAt', '$requestedAt'],
            },
          },
        },
      },
    ]);

    const total = result.reduce((sum, item) => sum + item.count, 0);
    const completed =
      result.find((item) => item._id === 'completed')?.count || 0;
    const avgResponseTime =
      result.find((item) => item._id === 'completed')?.averageResponseTime || 0;

    return {
      completionRate: total > 0 ? (completed / total) * 100 : 0,
      averageResponseTime: avgResponseTime / 1000, // Convert to seconds
    };
  }

  private static async getCustomerSatisfactionScore(
    range: DateRange
  ): Promise<number> {
    const result = await Trip.aggregate([
      {
        $match: {
          completedAt: { $gte: range.startDate, $lte: range.endDate },
          status: 'completed',
          customerRating: { $exists: true },
        },
      },
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$customerRating' },
        },
      },
    ]);

    return result[0]?.averageRating || 0;
  }

  private static async getDriverRetentionRate(
    range: DateRange
  ): Promise<number> {
    // Simplified retention calculation - drivers who completed trips in both periods
    const previousRange = this.getPreviousDateRange(range);

    const [currentDrivers, previousDrivers] = await Promise.all([
      Trip.distinct('driverId', {
        completedAt: { $gte: range.startDate, $lte: range.endDate },
        status: 'completed',
      }),
      Trip.distinct('driverId', {
        completedAt: {
          $gte: previousRange.startDate,
          $lte: previousRange.endDate,
        },
        status: 'completed',
      }),
    ]);

    const retainedDrivers = currentDrivers.filter((id) =>
      previousDrivers.includes(id)
    );

    return previousDrivers.length > 0
      ? (retainedDrivers.length / previousDrivers.length) * 100
      : 0;
  }

  private static async getCustomerRetentionRate(
    range: DateRange
  ): Promise<number> {
    // Similar logic for customers
    const previousRange = this.getPreviousDateRange(range);

    const [currentCustomers, previousCustomers] = await Promise.all([
      Trip.distinct('customerId', {
        completedAt: { $gte: range.startDate, $lte: range.endDate },
        status: 'completed',
      }),
      Trip.distinct('customerId', {
        completedAt: {
          $gte: previousRange.startDate,
          $lte: previousRange.endDate,
        },
        status: 'completed',
      }),
    ]);

    const retainedCustomers = currentCustomers.filter((id) =>
      previousCustomers.includes(id)
    );

    return previousCustomers.length > 0
      ? (retainedCustomers.length / previousCustomers.length) * 100
      : 0;
  }

  private static async getMonthOverMonthGrowth(
    currentRange: DateRange,
    previousRange: DateRange
  ): Promise<number> {
    const [currentRevenue, previousRevenue] = await Promise.all([
      this.getTodayRevenue(), // Simplified - should use range
      0, // Placeholder for previous period revenue
    ]);

    return previousRevenue > 0
      ? ((currentRevenue - previousRevenue) / previousRevenue) * 100
      : 0;
  }
}

export default AdminAnalyticsService;
