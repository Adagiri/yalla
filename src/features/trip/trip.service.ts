import Trip, { TripDocument } from './trip.model';
import Driver from '../driver/driver.model';
import { ErrorResponse } from '../../utils/responses';
import AmazonLocationService from '../../services/amazon-location.services';
import Location from '../location/location.model';
import mongoose from 'mongoose';
import NotificationService from '../../services/notification.services';

interface CreateTripInput {
  customerId: string;
  pickup: {
    address: string;
    coordinates: [number, number];
  };
  destination: {
    address: string;
    coordinates: [number, number];
  };
  paymentMethod: 'cash' | 'card' | 'wallet';
  priceOffered?: number; // Customer can offer higher price
}

class TripService {
  /**
   * Get single trip by ID
   */
  static async getTripById(
    tripId: string,
    userId?: string,
    userType?: 'customer' | 'driver' | 'admin'
  ) {
    try {
      let query: any = { _id: tripId };

      // If not admin, restrict access to trips the user is involved in
      if (userType && userType !== 'admin') {
        if (userType === 'customer') {
          query.customerId = userId;
        } else if (userType === 'driver') {
          query.driverId = userId;
        }
      }

      const trip = await Trip.findOne(query)
        .populate(
          'driverId',
          'firstname lastname phone profilePhoto stats vehicle currentLocation'
        )
        .populate('customerId', 'firstname lastname phone profilePhoto')
        .populate('pickup.estateId', 'name address')
        .populate('destination.estateId', 'name address');

      if (!trip) {
        throw new ErrorResponse(404, 'Trip not found or access denied');
      }

      return trip;
    } catch (error: any) {
      throw new ErrorResponse(500, 'Error fetching trip', error.message);
    }
  }
  
  /**
   * Calculate trip pricing based on distance and time
   */
  static calculatePricing(
    distance: number,
    duration: number,
    surgeMultiplier: number = 1
  ) {
    const baseFare = 500; // Base fare in Naira
    const perKmRate = 120; // Rate per kilometer
    const perMinuteRate = 50; // Rate per minute

    const distanceCharge = Math.round(distance * perKmRate);
    const timeCharge = Math.round((duration / 60) * perMinuteRate);
    const subtotal = baseFare + distanceCharge + timeCharge;
    const surgeFee = Math.round(subtotal * surgeMultiplier - subtotal);
    const total = subtotal + surgeFee;

    return {
      baseFare,
      distanceCharge,
      timeCharge,
      surgeFee,
      subtotal,
      total,
      breakdown: {
        baseFare,
        distanceCharge,
        timeCharge,
        surgeFee,
        discount: 0,
      },
    };
  }

  /**
   * Create a new trip request
   */
  static async createTrip(input: CreateTripInput) {
    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      // Calculate route
      const route = await AmazonLocationService.calculateRoute(
        input.pickup.coordinates,
        input.destination.coordinates
      );

      // Check if pickup/destination are within any estate
      const [pickupLocation, destinationLocation] = await Promise.all([
        Location.findOne({
          locationType: 'estate',
          boundary: {
            $geoIntersects: {
              $geometry: {
                type: 'Point',
                coordinates: input.pickup.coordinates,
              },
            },
          },
        }),
        Location.findOne({
          locationType: 'estate',
          boundary: {
            $geoIntersects: {
              $geometry: {
                type: 'Point',
                coordinates: input.destination.coordinates,
              },
            },
          },
        }),
      ]);

      // Determine trip type
      const tripType =
        pickupLocation &&
        destinationLocation &&
        pickupLocation._id === destinationLocation._id
          ? 'within_estate'
          : 'outside_estate';

      // Calculate pricing (with potential surge)
      const surgeMultiplier = await this.calculateSurgeMultiplier(
        input.pickup.coordinates
      );
      const pricing = this.calculatePricing(
        route.distance,
        route.duration,
        surgeMultiplier
      );

      // Apply customer's offered price if higher
      if (input.priceOffered && input.priceOffered > pricing.total) {
        pricing.total = input.priceOffered;
      }

      // Create trip
      const trip = new Trip({
        customerId: input.customerId,
        pickup: {
          address: input.pickup.address,
          location: {
            type: 'Point',
            coordinates: input.pickup.coordinates,
          },
          estateId: pickupLocation?._id,
        },
        destination: {
          address: input.destination.address,
          location: {
            type: 'Point',
            coordinates: input.destination.coordinates,
          },
          estateId: destinationLocation?._id,
        },
        route: {
          distance: route.distance,
          duration: route.duration,
        },
        pricing: {
          baseAmount: pricing.subtotal,
          surgeMultiplier,
          finalAmount: pricing.total,
          currency: 'NGN',
          breakdown: pricing.breakdown,
        },
        paymentMethod: input.paymentMethod,
        tripType,
        estimatedArrival: new Date(Date.now() + route.duration * 1000),
      });

      await trip.save({ session });

      // Find nearby available drivers
      const nearbyDrivers = await this.findNearbyDrivers(
        input.pickup.coordinates,
        tripType === 'within_estate' ? 2000 : 5000 // Search radius in meters
      );

      // Send trip request to drivers (implement real-time notification)
      // This would use WebSocket or push notifications

      await session.commitTransaction();

      return trip;
    } catch (error: any) {
      await session.abortTransaction();
      throw new ErrorResponse(500, 'Error creating trip', error.message);
    } finally {
      session.endSession();
    }
  }

  /**
   * Find nearby available drivers
   */
  static async findNearbyDrivers(
    location: [number, number],
    radiusInMeters: number
  ) {
    return await Driver.find({
      isOnline: true,
      isAvailable: true,
      currentLocation: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: location,
          },
          $maxDistance: radiusInMeters,
        },
      },
    })
      .limit(20)
      .select('id firstname lastname phone currentLocation vehicleId stats');
  }

  /**
   * Calculate surge pricing multiplier based on demand
   */
  static async calculateSurgeMultiplier(
    location: [number, number]
  ): Promise<number> {
    // Count active trips and available drivers in the area
    const radius = 5000; // 5km radius
    const now = new Date();
    const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);

    const [activeTrips, availableDrivers] = await Promise.all([
      Trip.countDocuments({
        status: {
          $in: [
            'searching',
            'driver_assigned',
            'driver_arrived',
            'in_progress',
          ],
        },
        requestedAt: { $gte: thirtyMinutesAgo },
        'pickup.location': {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: location,
            },
            $maxDistance: radius,
          },
        },
      }),
      Driver.countDocuments({
        isOnline: true,
        isAvailable: true,
        currentLocation: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: location,
            },
            $maxDistance: radius,
          },
        },
      }),
    ]);

    const demandRatio =
      availableDrivers > 0 ? activeTrips / availableDrivers : 3;

    // Surge pricing logic
    if (demandRatio >= 3) return 2.0;
    if (demandRatio >= 2) return 1.5;
    if (demandRatio >= 1.5) return 1.25;
    return 1.0;
  }

  /**
   * Driver accepts trip
   */
  static async acceptTrip(tripId: string, driverId: string) {
    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      const [trip, driver] = await Promise.all([
        Trip.findById(tripId),
        Driver.findById(driverId),
      ]);

      if (!trip) throw new ErrorResponse(404, 'Trip not found');
      if (!driver) throw new ErrorResponse(404, 'Driver not found');

      if (trip.status !== 'searching') {
        throw new ErrorResponse(400, 'Trip is no longer available');
      }

      if (!driver.isAvailable) {
        throw new ErrorResponse(400, 'Driver is not available');
      }

      // Update trip
      trip.driverId = driverId;
      trip.status = 'driver_assigned';
      trip.acceptedAt = new Date();

      // Calculate ETA to pickup
      const routeToPickup = await AmazonLocationService.calculateRoute(
        driver.currentLocation!.coordinates,
        trip.pickup.location.coordinates
      );

      trip.estimatedArrival = new Date(
        Date.now() + routeToPickup.duration * 1000
      );

      await trip.save({ session });

      // Update driver availability
      driver.isAvailable = false;
      driver.currentTripId = tripId;
      await driver.save({ session });

      await session.commitTransaction();

      // Notify customer (implement real-time notification)

      return trip;
    } catch (error: any) {
      await session.abortTransaction();
      throw new ErrorResponse(500, 'Error accepting trip', error.message);
    } finally {
      session.endSession();
    }
  }

  /**
   * Update driver location during trip
   */
  static async updateDriverLocation(
    tripId: string,
    driverId: string,
    location: [number, number],
    metadata?: { heading?: number; speed?: number }
  ) {
    try {
      // Update in Amazon Location Service
      await AmazonLocationService.updateDriverLocation(
        driverId,
        location,
        metadata
      );

      // Update in database
      const trip = await Trip.findOneAndUpdate(
        {
          _id: tripId,
          driverId,
          status: { $in: ['driver_assigned', 'driver_arrived', 'in_progress'] },
        },
        {
          driverLocation: {
            type: 'Point',
            coordinates: location,
            heading: metadata?.heading,
            speed: metadata?.speed,
            updatedAt: new Date(),
          },
          $push: {
            actualPath: {
              type: 'Point',
              coordinates: location,
              timestamp: new Date(),
            },
          },
        },
        { new: true }
      );

      if (!trip) throw new ErrorResponse(404, 'Active trip not found');

      // Check if driver has arrived at pickup
      if (trip.status === 'driver_assigned') {
        const distance = this.calculateDistance(
          location,
          trip.pickup.location.coordinates
        );

        if (distance < 50) {
          // Within 50 meters
          trip.status = 'driver_arrived';
          await trip.save();
        }
      }

      return trip;
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error updating driver location',
        error.message
      );
    }
  }

  /**
   * Start trip with PIN verification
   */
  static async startTrip(tripId: string, driverId: string, pin: string) {
    try {
      const trip = await Trip.findOne({
        _id: tripId,
        driverId,
        status: 'driver_arrived',
      });

      if (!trip)
        throw new ErrorResponse(404, 'Trip not found or not ready to start');

      if (trip.verificationPin !== pin) {
        throw new ErrorResponse(400, 'Invalid PIN');
      }

      trip.status = 'in_progress';
      trip.startedAt = new Date();
      await trip.save();

      return trip;
    } catch (error: any) {
      throw new ErrorResponse(500, 'Error starting trip', error.message);
    }
  }

  /**
   * Complete trip
   */
  static async completeTrip(tripId: string, driverId: string) {
    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      const trip = await Trip.findOne({
        _id: tripId,
        driverId,
        status: 'in_progress',
      });

      if (!trip) throw new ErrorResponse(404, 'Active trip not found');

      trip.status = 'completed';
      trip.completedAt = new Date();

      // Update payment status if cash
      if (trip.paymentMethod === 'cash') {
        trip.paymentStatus = 'completed';
      }

      await trip.save({ session });

      // Update driver
      const driver = await Driver.findById(driverId);
      if (driver) {
        driver.isAvailable = true;
        driver.currentTripId = undefined;
        driver.stats.totalTrips += 1;
        driver.stats.totalEarnings += trip.pricing.finalAmount * 0.75; // 75% to driver
        await driver.save({ session });
      }

      await session.commitTransaction();

      return trip;
    } catch (error: any) {
      await session.abortTransaction();
      throw new ErrorResponse(500, 'Error completing trip', error.message);
    } finally {
      session.endSession();
    }
  }

  /**
   * Cancel trip
   */
  static async cancelTrip(
    tripId: string,
    cancelledBy: 'customer' | 'driver',
    reason?: string
  ) {
    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      const trip = await Trip.findById(tripId);
      if (!trip) throw new ErrorResponse(404, 'Trip not found');

      if (trip.status === 'completed' || trip.status === 'cancelled') {
        throw new ErrorResponse(400, 'Trip cannot be cancelled');
      }

      trip.status = 'cancelled';
      trip.cancelledAt = new Date();
      await trip.save({ session });

      // If driver had accepted, make them available again
      if (trip.driverId) {
        const driver = await Driver.findById(trip.driverId);
        if (driver) {
          driver.isAvailable = true;
          driver.currentTripId = undefined;
          await driver.save({ session });
        }
      }

      await session.commitTransaction();

      return trip;
    } catch (error: any) {
      await session.abortTransaction();
      throw new ErrorResponse(500, 'Error cancelling trip', error.message);
    } finally {
      session.endSession();
    }
  }

  /**
   * Rate trip
   */
  static async rateTrip(
    tripId: string,
    ratedBy: 'customer' | 'driver',
    rating: number,
    review?: string
  ) {
    try {
      const trip = await Trip.findById(tripId);
      if (!trip) throw new ErrorResponse(404, 'Trip not found');

      if (trip.status !== 'completed') {
        throw new ErrorResponse(400, 'Can only rate completed trips');
      }

      if (ratedBy === 'customer') {
        trip.driverRating = rating;
        trip.driverReview = review;
      } else {
        trip.customerRating = rating;
        trip.customerReview = review;
      }

      await trip.save();

      // Update driver's average rating
      if (ratedBy === 'customer' && trip.driverId) {
        const driver = await Driver.findById(trip.driverId);
        if (driver) {
          // Recalculate average rating
          const driverTrips = await Trip.find({
            driverId: trip.driverId,
            status: 'completed',
            driverRating: { $exists: true },
          }).select('driverRating');

          const totalRating = driverTrips.reduce(
            (sum, t) => sum + (t.driverRating || 0),
            0
          );
          driver.stats.averageRating = totalRating / driverTrips.length;
          await driver.save();
        }
      }

      return trip;
    } catch (error: any) {
      throw new ErrorResponse(500, 'Error rating trip', error.message);
    }
  }

  /**
   * Get trip history
   */
  static async getTripHistory(
    userId: string,
    userType: 'customer' | 'driver',
    pagination: { page: number; limit: number }
  ) {
    try {
      const filter =
        userType === 'customer' ? { customerId: userId } : { driverId: userId };

      const trips = await Trip.find(filter)
        .sort({ createdAt: -1 })
        .limit(pagination.limit)
        .skip((pagination.page - 1) * pagination.limit)
        .populate('driverId', 'firstname lastname phone')
        .populate('customerId', 'firstname lastname phone');

      const total = await Trip.countDocuments(filter);

      return {
        trips,
        total,
        page: pagination.page,
        totalPages: Math.ceil(total / pagination.limit),
      };
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error fetching trip history',
        error.message
      );
    }
  }

  /**
   * Helper: Calculate distance between two points
   */
  private static calculateDistance(
    point1: [number, number],
    point2: [number, number]
  ): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (point1[1] * Math.PI) / 180;
    const φ2 = (point2[1] * Math.PI) / 180;
    const Δφ = ((point2[1] - point1[1]) * Math.PI) / 180;
    const Δλ = ((point2[0] - point1[0]) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  }

  /**
   * Get active trip for driver
   */
  static async getActiveTrip(driverId: string) {
    try {
      const trip = await Trip.findOne({
        driverId,
        status: { $in: ['driver_assigned', 'driver_arrived', 'in_progress'] },
      }).populate('customerId pickup.estate destination.estate');

      return trip;
    } catch (error: any) {
      throw new ErrorResponse(500, 'Error fetching active trip', error.message);
    }
  }

  /**
   * Get nearby available trips for driver
   */
  static async getNearbyTrips(
    driverLocation: [number, number],
    radius: number = 5000
  ) {
    try {
      const trips = await Trip.find({
        status: 'searching',
        'pickup.location': {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: driverLocation,
            },
            $maxDistance: radius,
          },
        },
      })
        .limit(10)
        .populate('customerId');

      return trips;
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error fetching nearby trips',
        error.message
      );
    }
  }

  /**
   * Mark driver as arrived at pickup location
   */
  static async arrivedAtPickup(tripId: string, driverId: string) {
    try {
      const trip = await Trip.findOneAndUpdate(
        {
          _id: tripId,
          driverId,
          status: 'driver_assigned',
        },
        {
          status: 'driver_arrived',
          $push: {
            timeline: {
              event: 'driver_arrived',
              timestamp: new Date(),
            },
          },
        },
        { new: true }
      );

      if (!trip) {
        throw new ErrorResponse(404, 'Trip not found or invalid status');
      }

      return trip;
    } catch (error: any) {
      throw new ErrorResponse(500, 'Error updating trip status', error.message);
    }
  }

  /**
   * Calculate driver earnings for a period
   */
  static async calculateDriverEarnings(
    driverId: string,
    period: 'today' | 'week' | 'month' | 'all'
  ) {
    try {
      let dateFilter = {};
      const now = new Date();

      switch (period) {
        case 'today':
          dateFilter = {
            completedAt: {
              $gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
              $lt: new Date(
                now.getFullYear(),
                now.getMonth(),
                now.getDate() + 1
              ),
            },
          };
          break;
        case 'week':
          const weekStart = new Date(now);
          weekStart.setDate(now.getDate() - now.getDay());
          weekStart.setHours(0, 0, 0, 0);
          dateFilter = {
            completedAt: {
              $gte: weekStart,
              $lt: now,
            },
          };
          break;
        case 'month':
          dateFilter = {
            completedAt: {
              $gte: new Date(now.getFullYear(), now.getMonth(), 1),
              $lt: new Date(now.getFullYear(), now.getMonth() + 1, 1),
            },
          };
          break;
        case 'all':
          // No date filter
          break;
      }

      const trips = await Trip.aggregate([
        {
          $match: {
            driverId,
            status: 'completed',
            ...dateFilter,
          },
        },
        {
          $group: {
            _id: null,
            totalEarnings: { $sum: '$pricing.finalAmount' },
            totalTrips: { $sum: 1 },
            cashCollected: {
              $sum: {
                $cond: [
                  { $eq: ['$paymentMethod', 'cash'] },
                  '$pricing.finalAmount',
                  0,
                ],
              },
            },
            cardPayments: {
              $sum: {
                $cond: [
                  { $eq: ['$paymentMethod', 'card'] },
                  '$pricing.finalAmount',
                  0,
                ],
              },
            },
          },
        },
      ]);

      if (trips.length === 0) {
        return {
          totalEarnings: 0,
          driverShare: 0,
          platformCommission: 0,
          totalTrips: 0,
          cashCollected: 0,
          cardPayments: 0,
        };
      }

      const result = trips[0];
      const driverSharePercentage = 0.75; // 75% to driver
      const driverShare = Math.round(
        result.totalEarnings * driverSharePercentage
      );
      const platformCommission = result.totalEarnings - driverShare;

      return {
        totalEarnings: result.totalEarnings,
        driverShare,
        platformCommission,
        totalTrips: result.totalTrips,
        cashCollected: result.cashCollected,
        cardPayments: result.cardPayments,
        averagePerTrip: Math.round(result.totalEarnings / result.totalTrips),
      };
    } catch (error: any) {
      throw new ErrorResponse(500, 'Error calculating earnings', error.message);
    }
  }

  /**
   * Admin: Manually assign trip to driver
   */
  static async assignTripToDriver(
    tripId: string,
    driverId: string,
    adminId: string
  ) {
    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      const [trip, driver] = await Promise.all([
        Trip.findById(tripId),
        Driver.findById(driverId),
      ]);

      if (!trip) throw new ErrorResponse(404, 'Trip not found');
      if (!driver) throw new ErrorResponse(404, 'Driver not found');

      if (trip.status !== 'searching') {
        throw new ErrorResponse(400, 'Trip has already been assigned');
      }

      if (!driver.isAvailable || !driver.isOnline) {
        throw new ErrorResponse(400, 'Driver is not available');
      }

      // Update trip
      trip.driverId = driverId;
      trip.status = 'driver_assigned';
      trip.acceptedAt = new Date();
      trip.assignedBy = adminId;

      await trip.save({ session });

      // Update driver
      driver.isAvailable = false;
      driver.currentTripId = tripId;
      await driver.save({ session });

      await session.commitTransaction();

      // Send notifications
      await NotificationService.sendTripNotification(
        trip.customerId,
        'customer',
        'trip_accepted',
        {
          ...trip.toObject(),
          driverName: `${driver.firstname} ${driver.lastname}`,
          adminAssigned: true,
        }
      );

      return trip;
    } catch (error: any) {
      await session.abortTransaction();
      throw new ErrorResponse(500, 'Error assigning trip', error.message);
    } finally {
      session.endSession();
    }
  }
}

export default TripService;
