import Trip from '../features/trip/trip.model';
import Driver from '../features/driver/driver.model';
import Customer from '../features/customer/customer.model';
import Notification from '../features/notification/notification.model';
import NotificationService from './notification.services';
import { ErrorResponse } from '../utils/responses';

interface TripNotificationData {
  tripId: string;
  tripNumber: string;
  pickup: {
    address: string;
    coordinates: [number, number];
    estateId?: string;
  };
  destination: {
    address: string;
    coordinates: [number, number];
    estateId?: string;
  };
  pricing: {
    estimatedFare: number;
    currency: string;
    surgeMultiplier: number;
  };
  route: {
    distance: number;
    duration: number;
  };
  paymentMethod: string;
  tripType: string;
  customerInfo: {
    name: string;
    phone?: string;
    photo?: string;
  };
  requestTimeout: number;
  estimatedArrival?: Date;
}

interface DriverData {
  _id: string;
  id?: string;
  firstname: string;
  lastname: string;
  phone: any;
  currentLocation?: any; // Make optional since MongoDB might not return it
  vehicleId?: string;
  stats: any;
}

class TripNotificationService {
  /**
   * Main function to broadcast trip to nearby drivers
   */
  static async broadcastTripToDrivers(
    trip: any,
    nearbyDrivers: DriverData[],
    customerId: string
  ): Promise<void> {
    try {
      if (nearbyDrivers.length === 0) {
        await this.handleNoDriversFound(trip, customerId);
        return;
      }

      // Get customer details
      const customer = await this.getCustomerDetails(customerId);

      // Prepare notification data
      const notificationData = await this.prepareNotificationData(
        trip,
        customer
      );

      // Extract driver IDs
      const driverIds = this.extractDriverIds(nearbyDrivers);

      // Send all types of notifications
      await this.sendAllNotifications(driverIds, notificationData, trip);

      // Set up automatic timeout
      this.scheduleAutoTimeout(trip._id.toString());

      console.log(
        `✅ Trip ${trip.tripNumber} broadcasted to ${driverIds.length} drivers`
      );
    } catch (error: any) {
      console.error('❌ Error broadcasting trip to drivers:', error);
      throw new ErrorResponse(500, 'Failed to broadcast trip', error.message);
    }
  }

  /**
   * Handle case when no drivers are found
   */
  private static async handleNoDriversFound(
    trip: any,
    customerId: string
  ): Promise<void> {
    console.warn(`⚠️ No nearby drivers found for trip ${trip.tripNumber}`);

    try {
      // Try expanded radius search
      const expandedDrivers = await this.findDriversInExpandedRadius(
        trip.pickup.location.coordinates,
        10000 // 10km radius
      );

      if (expandedDrivers.length > 0) {
        console.log(
          `🔍 Found ${expandedDrivers.length} drivers in expanded radius`
        );
        await this.broadcastTripToDrivers(trip, expandedDrivers, customerId);
      } else {
        // No drivers available - notify customer
        await this.notifyCustomerNoDrivers(trip, customerId);
      }
    } catch (error) {
      console.error('Error in expanded search:', error);
      await this.notifyCustomerNoDrivers(trip, customerId);
    }
  }

  /**
   * Find drivers in expanded radius
   */
  private static async findDriversInExpandedRadius(
    coordinates: [number, number],
    radiusInMeters: number
  ): Promise<DriverData[]> {
    const drivers = await Driver.find({
      isOnline: true,
      isAvailable: true,
      currentLocation: {
        $geoWithin: {
          $centerSphere: [coordinates, radiusInMeters / 6378100],
        },
      },
    })
      .limit(20)
      .select('_id firstname lastname phone currentLocation vehicleId stats')
      .lean();

    // Transform the Mongoose result to match our DriverData interface
    return drivers.map((driver) => ({
      _id: driver._id.toString(),
      id: driver._id.toString(),
      firstname: driver.firstname || '',
      lastname: driver.lastname || '',
      phone: driver.phone,
      currentLocation: driver.currentLocation,
      vehicleId: driver.vehicleId,
      stats: driver.stats,
    }));
  }

  /**
   * Get customer details for notification
   */
  private static async getCustomerDetails(customerId: string) {
    return await Customer.findById(customerId)
      .select('firstname lastname phone profilePhoto')
      .lean();
  }

  /**
   * Prepare notification data structure
   */
  private static async prepareNotificationData(
    trip: any,
    customer: any
  ): Promise<TripNotificationData> {
    return {
      tripId: trip._id.toString(),
      tripNumber: trip.tripNumber,
      pickup: {
        address: trip.pickup.address,
        coordinates: trip.pickup.location.coordinates,
        estateId: trip.pickup.estateId,
      },
      destination: {
        address: trip.destination.address,
        coordinates: trip.destination.location.coordinates,
        estateId: trip.destination.estateId,
      },
      pricing: {
        estimatedFare: trip.pricing.finalAmount,
        currency: trip.pricing.currency,
        surgeMultiplier: trip.pricing.surgeMultiplier,
      },
      route: {
        distance: trip.route.distance,
        duration: trip.route.duration,
      },
      paymentMethod: trip.paymentMethod,
      tripType: trip.tripType,
      customerInfo: {
        name: customer
          ? `${customer.firstname || ''} ${customer.lastname || ''}`.trim()
          : 'Customer',
        phone: customer?.phone?.fullPhone,
        photo: customer?.profilePhoto,
      },
      requestTimeout: 30, // 30 seconds
      estimatedArrival: trip.estimatedArrival,
    };
  }

  /**
   * Extract driver IDs from driver data
   */
  private static extractDriverIds(drivers: DriverData[]): string[] {
    return drivers
      .map((driver) => driver._id || driver.id)
      .filter((id): id is string => Boolean(id)); // Type guard to ensure string[]
  }

  /**
   * Send all types of notifications
   */
  private static async sendAllNotifications(
    driverIds: string[],
    notificationData: TripNotificationData,
    trip: any
  ): Promise<void> {
    const notifications = [
      this.sendWebSocketNotifications(driverIds, notificationData),
      this.sendPushNotifications(driverIds, notificationData),
      this.createInAppNotifications(driverIds, trip),
    ];

    // Send all notifications in parallel
    await Promise.allSettled(notifications);
  }

  /**
   * Send WebSocket notifications
   */
  private static async sendWebSocketNotifications(
    driverIds: string[],
    notificationData: TripNotificationData
  ): Promise<void> {
    try {
      if (global.websocketService) {
        // Send individual notifications
        driverIds.forEach((driverId) => {
          global.websocketService.sendToUser(driverId, 'new_trip_request', {
            ...notificationData,
            timestamp: new Date(),
          });
        });

        // Schedule auto-expiry
        this.scheduleRequestExpiry(driverIds, notificationData.tripId);

        console.log(
          `📡 WebSocket notifications sent to ${driverIds.length} drivers`
        );
      } else {
        console.warn('⚠️ WebSocket service not available');
      }
    } catch (error) {
      console.error('❌ Error sending WebSocket notifications:', error);
    }
  }

  /**
   * Send push notifications
   */
  private static async sendPushNotifications(
    driverIds: string[],
    notificationData: TripNotificationData
  ): Promise<void> {
    try {
      await NotificationService.sendDriverBroadcast(
        driverIds,
        notificationData.tripId,
        notificationData
      );
      console.log(`📱 Push notifications sent to ${driverIds.length} drivers`);
    } catch (error) {
      console.error('❌ Error sending push notifications:', error);
    }
  }

  /**
   * Create in-app notifications
   */
  private static async createInAppNotifications(
    driverIds: string[],
    trip: any
  ): Promise<void> {
    try {
      const notifications = driverIds.map((driverId) => ({
        userId: driverId,
        userType: 'driver',
        type: 'new_request',
        title: '🚗 New Trip Request!',
        message: `Trip from ${trip.pickup.address} to ${trip.destination.address}`,
        data: {
          tripId: trip._id,
          tripNumber: trip.tripNumber,
          pickup: trip.pickup.address,
          destination: trip.destination.address,
          estimatedFare: trip.pricing.finalAmount,
          distance: trip.route.distance,
          duration: trip.route.duration,
          paymentMethod: trip.paymentMethod,
          expiresAt: new Date(Date.now() + 30000), // 30 seconds
        },
      }));

      await Notification.insertMany(notifications);
      console.log(
        `💾 In-app notifications created for ${driverIds.length} drivers`
      );
    } catch (error) {
      console.error('❌ Error creating in-app notifications:', error);
    }
  }

  /**
   * Schedule WebSocket request expiry
   */
  private static scheduleRequestExpiry(
    driverIds: string[],
    tripId: string
  ): void {
    setTimeout(() => {
      if (global.websocketService) {
        driverIds.forEach((driverId) => {
          global.websocketService.sendToUser(driverId, 'trip_request_expired', {
            tripId,
            message: 'Trip request has expired',
            timestamp: new Date(),
          });
        });
      }
    }, 30000); // 30 seconds
  }

  /**
   * Schedule automatic trip timeout
   */
  private static scheduleAutoTimeout(tripId: string): void {
    const timeoutMs = 5 * 60 * 1000; // 5 minutes

    setTimeout(async () => {
      try {
        const trip = await Trip.findById(tripId);

        if (trip && trip.status === 'searching') {
          await this.cancelTripDueToTimeout(trip);
        }
      } catch (error) {
        console.error('❌ Error in trip timeout handler:', error);
      }
    }, timeoutMs);
  }

  /**
   * Cancel trip due to timeout
   */
  private static async cancelTripDueToTimeout(trip: any): Promise<void> {
    try {
      trip.status = 'cancelled';
      trip.cancelledAt = new Date();
      await trip.save();

      console.log(`⏰ Trip ${trip.tripNumber} auto-cancelled due to timeout`);

      // Notify customer
      await this.notifyCustomerTripCancelled(
        trip,
        'No available drivers found'
      );
    } catch (error) {
      console.error('❌ Error cancelling trip due to timeout:', error);
    }
  }

  /**
   * Notify customer when no drivers are available
   */
  private static async notifyCustomerNoDrivers(
    trip: any,
    customerId: string
  ): Promise<void> {
    try {
      // Cancel the trip
      trip.status = 'cancelled';
      trip.cancelledAt = new Date();
      await trip.save();

      await this.notifyCustomerTripCancelled(
        trip,
        'No drivers available in your area'
      );
    } catch (error) {
      console.error('❌ Error notifying customer about no drivers:', error);
    }
  }

  /**
   * Notify customer about trip cancellation
   */
   static async notifyCustomerTripCancelled(
    trip: any,
    reason: string
  ): Promise<void> {
    if (!trip.customerId) return;

    try {
      // Send notification
      await NotificationService.sendTripNotification(
        trip.customerId,
        'customer',
        'trip_cancelled',
        {
          ...trip.toObject(),
          cancellationReason: reason,
        }
      );

      // Send WebSocket update
      if (global.websocketService) {
        global.websocketService.sendToUser(trip.customerId, 'trip_cancelled', {
          tripId: trip._id,
          reason,
          timestamp: new Date(),
        });
      }

      console.log(`📢 Customer notified of trip cancellation: ${reason}`);
    } catch (error) {
      console.error('❌ Error notifying customer of cancellation:', error);
    }
  }

  /**
   * Notify drivers that trip is no longer available
   */
  static async notifyDriversTripTaken(
    tripId: string,
    excludeDriverId: string
  ): Promise<void> {
    try {
      if (global.websocketService) {
        // Use the public method instead of accessing private io property
        global.websocketService.broadcastToAll('trip_no_longer_available', {
          tripId,
          acceptedBy: excludeDriverId,
          timestamp: new Date(),
        });
      }
    } catch (error) {
      console.error('❌ Error notifying drivers trip was taken:', error);
    }
  }
}

export default TripNotificationService;
