// src/features/admin/admin-analytics.service.ts
import mongoose from 'mongoose';
import { ErrorResponse } from '../../utils/responses';
import Driver from '../driver/driver.model';
import Customer from '../customer/customer.model';
import Trip from '../trip/trip.model';

interface DateRange {
  startDate: Date;
  endDate: Date;
}

interface DashboardMetrics {
  overview: {
    totalDrivers: number;
    activeDrivers: number;
    totalCustomers: number;
    activeCustomers: number;
    totalTrips: number;
    completedTrips: number;
    totalRevenue: number;
    platformCommission: number;
  };
  todayStats: {
    tripsToday: number;
    revenueToday: number;
    newDriversToday: number;
    newCustomersToday: number;
    activeDriversToday: number;
  };
  trends: {
    tripsGrowth: number;
    revenueGrowth: number;
    driversGrowth: number;
    customersGrowth: number;
  };
  tripsByStatus: {
    pending: number;
    active: number;
    completed: number;
    cancelled: number;
  };
  recentActivity: Array<{
    type: string;
    description: string;
    timestamp: Date;
    amount?: number;
  }>;
}

class AdminAnalyticsService {
  /**
   * Get comprehensive dashboard metrics
   */
  static async getDashboardMetrics(
    dateRange?: DateRange
  ): Promise<DashboardMetrics> {
    try {
      const today = new Date();
      const startOfToday = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate()
      );
      const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);

      // Calculate date ranges for trends
      const thirtyDaysAgo = new Date(
        today.getTime() - 30 * 24 * 60 * 60 * 1000
      );
      const sixtyDaysAgo = new Date(today.getTime() - 60 * 24 * 60 * 60 * 1000);

      // Get overview metrics
      const [
        totalDrivers,
        activeDrivers,
        totalCustomers,
        activeCustomers,
        totalTrips,
        completedTrips,
        revenueData,
        commissionData,
      ] = await Promise.all([
        Driver.countDocuments({}),
        Driver.countDocuments({ isActive: true }),
        Customer.countDocuments({}),
        Customer.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }), // Active in last 30 days
        Trip.countDocuments({}),
        Trip.countDocuments({ status: 'completed' }),
        this.calculateTotalRevenue(),
        this.calculatePlatformCommission(),
      ]);

      // Get today's stats
      const todayStats = await this.getTodayStats(startOfToday, endOfToday);

      // Get growth trends
      const trends = await this.getGrowthTrends(thirtyDaysAgo, sixtyDaysAgo);

      // Get trips by status
      const tripsByStatus = await this.getTripsByStatus();

      // Get recent activity
      const recentActivity = await this.getRecentActivity();

      return {
        overview: {
          totalDrivers,
          activeDrivers,
          totalCustomers,
          activeCustomers,
          totalTrips,
          completedTrips,
          totalRevenue: revenueData.total,
          platformCommission: commissionData.total,
        },
        todayStats,
        trends,
        tripsByStatus,
        recentActivity,
      };
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error fetching dashboard metrics',
        error.message
      );
    }
  }

  /**
   * Get revenue analytics
   */
  static async getRevenueAnalytics(
    period: 'daily' | 'weekly' | 'monthly' = 'daily',
    days: number = 30
  ) {
    try {
      const endDate = new Date();
      const startDate = new Date(
        endDate.getTime() - days * 24 * 60 * 60 * 1000
      );

      let groupByFormat: string;
      let dateIncrement: number;

      switch (period) {
        case 'weekly':
          groupByFormat = '%Y-%U'; // Year-Week
          dateIncrement = 7 * 24 * 60 * 60 * 1000;
          break;
        case 'monthly':
          groupByFormat = '%Y-%m'; // Year-Month
          dateIncrement = 30 * 24 * 60 * 60 * 1000;
          break;
        default:
          groupByFormat = '%Y-%m-%d'; // Year-Month-Day
          dateIncrement = 24 * 60 * 60 * 1000;
      }

      const revenueData = await Trip.aggregate([
        {
          $match: {
            status: 'completed',
            createdAt: { $gte: startDate, $lte: endDate },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: groupByFormat,
                date: '$createdAt',
              },
            },
            totalRevenue: { $sum: '$pricing.finalAmount' },
            platformCommission: { $sum: '$platformCommission' },
            driverEarnings: { $sum: '$driverEarnings' },
            tripCount: { $sum: 1 },
            averageAmount: { $avg: '$pricing.finalAmount' },
          },
        },
        { $sort: { _id: 1 } },
      ]);

      // Fill missing dates with zero values
      const filledData = this.fillMissingDates(
        revenueData,
        startDate,
        endDate,
        dateIncrement,
        groupByFormat
      );

      // Calculate totals and growth
      const totals = revenueData.reduce(
        (acc, item) => ({
          revenue: acc.revenue + item.totalRevenue,
          commission: acc.commission + item.platformCommission,
          trips: acc.trips + item.tripCount,
        }),
        { revenue: 0, commission: 0, trips: 0 }
      );

      // Calculate growth rate (comparing first half vs second half of period)
      const midPoint = Math.floor(filledData.length / 2);
      const firstHalf = filledData.slice(0, midPoint);
      const secondHalf = filledData.slice(midPoint);

      const firstHalfRevenue = firstHalf.reduce(
        (sum, item) => sum + item.totalRevenue,
        0
      );
      const secondHalfRevenue = secondHalf.reduce(
        (sum, item) => sum + item.totalRevenue,
        0
      );

      const growthRate =
        firstHalfRevenue > 0
          ? ((secondHalfRevenue - firstHalfRevenue) / firstHalfRevenue) * 100
          : 0;

      return {
        period,
        days,
        data: filledData,
        totals,
        growthRate: Math.round(growthRate * 100) / 100,
        averageDaily: totals.revenue / days,
      };
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error fetching revenue analytics',
        error.message
      );
    }
  }

  /**
   * Get driver performance analytics
   */
  static async getDriverPerformanceAnalytics(
    driverId?: string,
    dateRange?: DateRange
  ) {
    try {
      const query: any = { status: 'completed' };

      if (driverId) query.driverId = driverId;
      if (dateRange) {
        query.createdAt = {
          $gte: dateRange.startDate,
          $lte: dateRange.endDate,
        };
      }

      const performanceData = await Trip.aggregate([
        { $match: query },
        {
          $group: {
            _id: '$driverId',
            totalTrips: { $sum: 1 },
            totalEarnings: { $sum: '$driverEarnings' },
            totalRevenue: { $sum: '$pricing.finalAmount' },
            averageRating: { $avg: '$driverRating' },
            totalDistance: { $sum: '$route.distance' },
            totalDuration: { $sum: '$route.duration' },
            averageTripAmount: { $avg: '$pricing.finalAmount' },
          },
        },
        { $sort: { totalEarnings: -1 } },
        { $limit: driverId ? 1 : 50 }, // If specific driver, limit to 1, else top 50
      ]);

      // Populate driver details
      const driverIds = performanceData.map((item) => item._id);
      const drivers = await Driver.find({ _id: { $in: driverIds } })
        .select('firstname lastname email phone profilePhoto isActive')
        .lean();

      const driverMap = drivers.reduce((map, driver) => {
        map[driver._id.toString()] = driver;
        return map;
      }, {} as any);

      const enrichedData = performanceData.map((item) => ({
        ...item,
        driver: driverMap[item._id.toString()],
        efficiencyScore: this.calculateEfficiencyScore(item),
      }));

      return {
        drivers: enrichedData,
        total: enrichedData.length,
        summary: this.calculatePerformanceSummary(enrichedData),
      };
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error fetching driver performance analytics',
        error.message
      );
    }
  }

  /**
   * Get customer analytics
   */
  static async getCustomerAnalytics(dateRange?: DateRange) {
    try {
      const query: any = {};

      if (dateRange) {
        query.createdAt = {
          $gte: dateRange.startDate,
          $lte: dateRange.endDate,
        };
      }

      const [
        customerSegments,
        spendingAnalytics,
        retentionMetrics,
        geographicDistribution,
      ] = await Promise.all([
        this.getCustomerSegments(query),
        this.getCustomerSpendingAnalytics(query),
        this.getCustomerRetentionMetrics(query),
        this.getCustomerGeographicDistribution(query),
      ]);

      return {
        segments: customerSegments,
        spending: spendingAnalytics,
        retention: retentionMetrics,
        geographic: geographicDistribution,
      };
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error fetching customer analytics',
        error.message
      );
    }
  }

  /**
   * Get trip analytics
   */
  static async getTripAnalytics(dateRange?: DateRange) {
    try {
      const query: any = {};

      if (dateRange) {
        query.createdAt = {
          $gte: dateRange.startDate,
          $lte: dateRange.endDate,
        };
      }

      const [
        tripsByHour,
        tripsByDay,
        popularRoutes,
        cancellationAnalysis,
        averageMetrics,
      ] = await Promise.all([
        this.getTripsByHour(query),
        this.getTripsByDayOfWeek(query),
        this.getPopularRoutes(query),
        this.getCancellationAnalysis(query),
        this.getAverageTripMetrics(query),
      ]);

      return {
        hourlyDistribution: tripsByHour,
        dailyDistribution: tripsByDay,
        popularRoutes,
        cancellations: cancellationAnalysis,
        averages: averageMetrics,
      };
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error fetching trip analytics',
        error.message
      );
    }
  }

  // Helper methods
  private static async getTodayStats(startOfToday: Date, endOfToday: Date) {
    const [
      tripsToday,
      revenueToday,
      newDriversToday,
      newCustomersToday,
      activeDriversToday,
    ] = await Promise.all([
      Trip.countDocuments({
        createdAt: { $gte: startOfToday, $lt: endOfToday },
      }),
      Trip.aggregate([
        {
          $match: {
            status: 'completed',
            createdAt: { $gte: startOfToday, $lt: endOfToday },
          },
        },
        { $group: { _id: null, total: { $sum: '$pricing.finalAmount' } } },
      ]).then((result) => result[0]?.total || 0),
      Driver.countDocuments({
        createdAt: { $gte: startOfToday, $lt: endOfToday },
      }),
      Customer.countDocuments({
        createdAt: { $gte: startOfToday, $lt: endOfToday },
      }),
      Trip.distinct('driverId', {
        createdAt: { $gte: startOfToday, $lt: endOfToday },
      }).then((drivers) => drivers.length),
    ]);

    return {
      tripsToday,
      revenueToday,
      newDriversToday,
      newCustomersToday,
      activeDriversToday,
    };
  }

  private static async getGrowthTrends(
    thirtyDaysAgo: Date,
    sixtyDaysAgo: Date
  ) {
    const [currentPeriod, previousPeriod] = await Promise.all([
      // Last 30 days
      Promise.all([
        Trip.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
        Trip.aggregate([
          {
            $match: { status: 'completed', createdAt: { $gte: thirtyDaysAgo } },
          },
          { $group: { _id: null, total: { $sum: '$pricing.finalAmount' } } },
        ]).then((result) => result[0]?.total || 0),
        Driver.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
        Customer.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
      ]),
      // Previous 30 days (30-60 days ago)
      Promise.all([
        Trip.countDocuments({
          createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo },
        }),
        Trip.aggregate([
          {
            $match: {
              status: 'completed',
              createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo },
            },
          },
          { $group: { _id: null, total: { $sum: '$pricing.finalAmount' } } },
        ]).then((result) => result[0]?.total || 0),
        Driver.countDocuments({
          createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo },
        }),
        Customer.countDocuments({
          createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo },
        }),
      ]),
    ]);

    const calculateGrowth = (current: number, previous: number) =>
      previous > 0 ? ((current - previous) / previous) * 100 : 0;

    return {
      tripsGrowth:
        Math.round(calculateGrowth(currentPeriod[0], previousPeriod[0]) * 100) /
        100,
      revenueGrowth:
        Math.round(calculateGrowth(currentPeriod[1], previousPeriod[1]) * 100) /
        100,
      driversGrowth:
        Math.round(calculateGrowth(currentPeriod[2], previousPeriod[2]) * 100) /
        100,
      customersGrowth:
        Math.round(calculateGrowth(currentPeriod[3], previousPeriod[3]) * 100) /
        100,
    };
  }

  private static async getTripsByStatus() {
    const statuses = await Trip.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    return statuses.reduce(
      (acc, item) => {
        acc[item._id] = item.count;
        return acc;
      },
      {
        pending: 0,
        active: 0,
        completed: 0,
        cancelled: 0,
      }
    );
  }

  private static async getRecentActivity() {
    const recentTrips = await Trip.find({})
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('driverId', 'firstname lastname')
      .populate('customerId', 'firstname lastname')
      .lean();

    return recentTrips.map((trip) => ({
      type: 'trip',
      description: `Trip from ${trip.route?.pickup?.address || 'Unknown'} to ${trip.route?.destination?.address || 'Unknown'}`,
      timestamp: trip.createdAt,
      amount: trip.pricing?.finalAmount,
    }));
  }

  private static async calculateTotalRevenue() {
    const result = await Trip.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$pricing.finalAmount' } } },
    ]);
    return { total: result[0]?.total || 0 };
  }

  private static async calculatePlatformCommission() {
    const result = await Trip.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$platformCommission' } } },
    ]);
    return { total: result[0]?.total || 0 };
  }

  private static fillMissingDates(
    data: any[],
    startDate: Date,
    endDate: Date,
    increment: number,
    format: string
  ) {
    const filledData = [];
    const dataMap = new Map(data.map((item) => [item._id, item]));

    for (
      let date = new Date(startDate);
      date <= endDate;
      date = new Date(date.getTime() + increment)
    ) {
      const key = this.formatDate(date, format);
      const existingData = dataMap.get(key);

      filledData.push(
        existingData || {
          _id: key,
          totalRevenue: 0,
          platformCommission: 0,
          driverEarnings: 0,
          tripCount: 0,
          averageAmount: 0,
        }
      );
    }

    return filledData;
  }

  private static formatDate(date: Date, format: string): string {
    switch (format) {
      case '%Y-%m-%d':
        return date.toISOString().split('T')[0];
      case '%Y-%U':
        const week = this.getWeekNumber(date);
        return `${date.getFullYear()}-${week}`;
      case '%Y-%m':
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      default:
        return date.toISOString().split('T')[0];
    }
  }

  private static getWeekNumber(date: Date): string {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear =
      (date.getTime() - firstDayOfYear.getTime()) / 86400000;
    return String(
      Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7)
    ).padStart(2, '0');
  }

  private static calculateEfficiencyScore(driverData: any): number {
    // Simple efficiency score based on trips per day, earnings, and rating
    const tripsPerDay = driverData.totalTrips / 30; // Assuming 30-day period
    const earningsPerTrip = driverData.totalEarnings / driverData.totalTrips;
    const rating = driverData.averageRating || 0;

    // Weighted score (0-100)
    return Math.min(
      100,
      Math.round(tripsPerDay * 10 + earningsPerTrip / 100 + rating * 20)
    );
  }

  private static calculatePerformanceSummary(driverData: any[]) {
    if (driverData.length === 0) {
      return {
        totalEarnings: 0,
        averageRating: 0,
        totalTrips: 0,
        topPerformer: null,
      };
    }

    const totalEarnings = driverData.reduce(
      (sum, driver) => sum + driver.totalEarnings,
      0
    );
    const averageRating =
      driverData.reduce((sum, driver) => sum + (driver.averageRating || 0), 0) /
      driverData.length;
    const totalTrips = driverData.reduce(
      (sum, driver) => sum + driver.totalTrips,
      0
    );

    return {
      totalEarnings,
      averageRating: Math.round(averageRating * 100) / 100,
      totalTrips,
      topPerformer: driverData[0], // Already sorted by earnings
    };
  }

  // Placeholder methods for customer analytics
  private static async getCustomerSegments(query: any) {
    // Implementation for customer segments
    return [];
  }

  private static async getCustomerSpendingAnalytics(query: any) {
    // Implementation for spending analytics
    return {};
  }

  private static async getCustomerRetentionMetrics(query: any) {
    // Implementation for retention metrics
    return {};
  }

  private static async getCustomerGeographicDistribution(query: any) {
    // Implementation for geographic distribution
    return {};
  }

  // Placeholder methods for trip analytics
  private static async getTripsByHour(query: any) {
    // Implementation for trips by hour
    return [];
  }

  private static async getTripsByDayOfWeek(query: any) {
    // Implementation for trips by day
    return [];
  }

  private static async getPopularRoutes(query: any) {
    // Implementation for popular routes
    return [];
  }

  private static async getCancellationAnalysis(query: any) {
    // Implementation for cancellation analysis
    return {};
  }

  private static async getAverageTripMetrics(query: any) {
    // Implementation for average metrics
    return {};
  }
}

export default AdminAnalyticsService;
