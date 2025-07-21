import Trip, { TripDocument } from './trip.model';
import Driver from '../driver/driver.model';
import { ErrorResponse } from '../../utils/responses';
import AmazonLocationService from '../../services/amazon-location.services';
import Location from '../location/location.model';
import mongoose from 'mongoose';
import NotificationService from '../../services/notification.services';
import TripNotificationService from '../../services/trip-notification.service';
import PaymentService from '../../services/payment.service';
import WalletService from '../../services/wallet.service';
import Transaction from '../transaction/transaction.model';
import Customer from '../customer/customer.model';
import PaymentModelService from '../payment-model/payment-model.services';
import { SubscriptionService } from '../../services/subscription.service';

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
    console.log('user type: ', userType);
    try {
      let query: any = { _id: tripId };

      // If not admin, restrict access to trips the user is involved in
      if (userType && userType !== 'admin') {
        if (userType === 'customer') {
          console.log(userType);
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

      const customer = await Customer.findById(input.customerId);

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

      console.log('pricing: ', pricing);
      console.log('pickup location: ', pickupLocation);
      console.log('destination location: ', destinationLocation);

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

      const driverIds = nearbyDrivers.map((d) => d._id);

      // Publish to subscriptions
      await SubscriptionService.publishNewTripRequest(driverIds, {
        id: trip._id,
        pickup: trip.pickup,
        destination: trip.destination,
        customer: customer,
        pricing: trip.pricing,
        estimatedArrival: trip.estimatedArrival,
      });

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
    try {
      // Validate location
      if (!Array.isArray(location) || location.length !== 2) {
        throw new Error(
          'Invalid location format. Expected [longitude, latitude]'
        );
      }

      // Use $geoWithin with $centerSphere instead of $near
      return await Driver.find({
        isOnline: true,
        isAvailable: true,
        currentLocation: {
          $geoWithin: {
            $centerSphere: [
              location, // [longitude, latitude]
              radiusInMeters / 6378100, // Convert meters to radians (Earth radius in meters)
            ],
          },
        },
      })
        .limit(20)
        .select('id firstname lastname phone currentLocation vehicleId stats')
        .lean(); // Use lean() for better performance
    } catch (error: any) {
      console.error('Error finding nearby drivers:', error);
      throw new Error(`Failed to find nearby drivers: ${error.message}`);
    }
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
        Driver.findById(driverId).populate('vehicle'),
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

      // Publish trip accepted event
      await SubscriptionService.publishTripAccepted(tripId, trip.customerId, {
        id: driver._id,
        name: `${driver.firstname} ${driver.lastname}`,
        phone: driver.phone,
        photo: driver.profilePhoto,
        rating: driver.stats.averageRating,
        vehicle: driver.vehicle,
      });

      // Publish status change
      await SubscriptionService.publishTripStatusChanged(trip);

      await session.commitTransaction();

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
      const trip = await Trip.findById(tripId).populate('driverId customerId');
      if (!trip) {
        throw new ErrorResponse(404, 'Trip not found');
      }

      // Verify authorization
      if (trip.driverId !== driverId) {
        throw new ErrorResponse(403, 'Not authorized to complete this trip');
      }

      // Process payment based on driver's payment model
      const paymentResult = await PaymentModelService.processTripPayment(
        trip.driverId,
        tripId,
        trip.pricing.finalAmount,
        trip.paymentMethod
      );

      // Update trip status
      const updatedTrip = await Trip.findByIdAndUpdate(
        tripId,
        {
          status: 'completed',
          completedAt: new Date(),
          driverEarnings: paymentResult.driverEarnings,
          platformCommission: paymentResult.platformEarnings,
          paymentModel: paymentResult.model,
          $push: {
            timeline: {
              event: 'trip_completed',
              timestamp: new Date(),
              metadata: {
                paymentModel: paymentResult.model,
                driverEarnings: paymentResult.driverEarnings,
                platformEarnings: paymentResult.platformEarnings,
              },
            },
          },
        },
        { new: true }
      );

      // Send notifications

      if (updatedTrip) {
        await NotificationService.sendTripNotification(
          trip.driverId,
          'driver',
          'earnings_received',
          {
            ...updatedTrip.toObject(),
            paymentModel: paymentResult.model,
            message: paymentResult.message,
          }
        );
      }

      return {
        trip: updatedTrip,
        paymentResult,
      };
    } catch (error: any) {
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

  /**
   * Get nearby available trips for driver
   */
  static async getNearbyTrips(
    driverLocation: [number, number],
    radius: number = 5000
  ) {
    try {
      // Use $geoWithin instead of $near
      const trips = await Trip.find({
        status: 'searching',
        'pickup.location': {
          $geoWithin: {
            $centerSphere: [
              driverLocation,
              radius / 6378100, // Convert meters to radians
            ],
          },
        },
      })
        .limit(10)
        .populate('customerId')
        .lean();

      return trips;
    } catch (error: any) {
      throw new Error(`Error fetching nearby trips: ${error.message}`);
    }
  }

  /**
   * Calculate surge pricing multiplier based on demand
   */
  static async calculateSurgeMultiplier(
    location: [number, number]
  ): Promise<number> {
    try {
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
            $geoWithin: {
              $centerSphere: [
                location,
                radius / 6378100, // Convert to radians
              ],
            },
          },
        }),
        Driver.countDocuments({
          isOnline: true,
          isAvailable: true,
          currentLocation: {
            $geoWithin: {
              $centerSphere: [
                location,
                radius / 6378100, // Convert to radians
              ],
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
    } catch (error: any) {
      console.error('Error calculating surge multiplier:', error);
      return 1.0; // Default to no surge on error
    }
  }

  static async completeTripWithPayment(tripId: string, driverId: string) {
    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      const trip = await Trip.findOne({
        _id: tripId,
        driverId,
        status: 'in_progress',
      });

      if (!trip) throw new ErrorResponse(404, 'Active trip not found');

      // Update trip status to completed
      trip.status = 'completed';
      trip.completedAt = new Date();
      await trip.save({ session });

      // Process payment based on payment method
      let paymentResult;

      switch (trip.paymentMethod) {
        case 'wallet':
          paymentResult = await PaymentService.processTripPayment({
            tripId: tripId,
            customerId: trip.customerId,
            driverId: trip.driverId,
            amount: trip.pricing.finalAmount,
            paymentMethod: 'wallet',
          });
          break;

        case 'cash':
          paymentResult = await PaymentService.processTripPayment({
            tripId: tripId,
            customerId: trip.customerId,
            driverId: trip.driverId,
            amount: trip.pricing.finalAmount,
            paymentMethod: 'cash',
          });
          break;

        case 'card':
          // For card payments, we'll initiate the payment and let webhook handle completion
          paymentResult = await PaymentService.processTripPayment({
            tripId: tripId,
            customerId: trip.customerId,
            driverId: trip.driverId,
            amount: trip.pricing.finalAmount,
            paymentMethod: 'card',
          });
          break;

        default:
          throw new ErrorResponse(400, 'Invalid payment method');
      }

      // Update driver statistics
      const driver = await Driver.findById(driverId);
      if (driver) {
        driver.isAvailable = true;
        driver.currentTripId = undefined;
        driver.stats.totalTrips += 1;

        // Only update earnings for wallet and cash payments (card payments are handled by webhook)
        if (trip.paymentMethod === 'wallet' || trip.paymentMethod === 'cash') {
          const driverEarnings = trip.pricing.finalAmount * 0.75; // 75% to driver
          driver.stats.totalEarnings += driverEarnings;
        }

        await driver.save({ session });
      }

      await session.commitTransaction();

      return {
        trip,
        paymentResult,
      };
    } catch (error: any) {
      await session.abortTransaction();
      throw new ErrorResponse(
        500,
        'Error completing trip with payment',
        error.message
      );
    } finally {
      session.endSession();
    }
  }

  /**
   * Check if customer has sufficient wallet balance for trip
   */
  static async checkCustomerBalance(
    customerId: string,
    amount: number
  ): Promise<boolean> {
    try {
      const wallet = await WalletService.getUserWallet(customerId);
      return wallet.balance >= amount * 100; // Convert to kobo for comparison
    } catch (error) {
      return false;
    }
  }

  /**
   * Create trip with payment method validation
   */
  static async createTripWithPaymentValidation(input: CreateTripInput) {
    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      // Validate payment method
      if (input.paymentMethod === 'wallet') {
        const hasSufficientBalance = await this.checkCustomerBalance(
          input.customerId,
          input.priceOffered || 0
        );

        if (!hasSufficientBalance) {
          throw new ErrorResponse(
            400,
            'Insufficient wallet balance. Please top up your wallet or choose a different payment method.'
          );
        }
      }

      // Create trip using existing logic
      const trip = await this.createTrip(input);

      await session.commitTransaction();
      return trip;
    } catch (error: any) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Cancel trip with refund processing
   */
  static async cancelTripWithRefund(
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

      // Check if payment was already processed
      const shouldRefund =
        trip.paymentStatus === 'completed' && trip.paymentMethod === 'wallet';

      // Cancel trip
      trip.status = 'cancelled';
      trip.cancelledAt = new Date();
      trip.cancelledBy = cancelledBy;
      trip.cancellationReason = reason;
      await trip.save({ session });

      // Process refund if applicable
      let refundResult;
      if (shouldRefund) {
        refundResult = await PaymentService.refundTripPayment(
          tripId,
          reason || 'Trip cancelled'
        );
      }

      // Update driver availability if assigned
      if (trip.driverId) {
        const driver = await Driver.findById(trip.driverId);
        if (driver) {
          driver.isAvailable = true;
          driver.currentTripId = undefined;
          await driver.save({ session });
        }
      }

      await session.commitTransaction();

      return {
        trip,
        refundResult,
      };
    } catch (error: any) {
      await session.abortTransaction();
      throw new ErrorResponse(500, 'Error cancelling trip', error.message);
    } finally {
      session.endSession();
    }
  }

  /**
   * Get trip with payment details
   */
  static async getTripWithPaymentDetails(
    tripId: string,
    userId?: string,
    userType?: 'driver' | 'customer' | 'admin'
  ) {
    try {
      const trip = await this.getTripById(tripId, userId, userType);

      if (!trip) return null;

      // Get related transactions if payment was processed
      if (trip.paymentStatus === 'completed') {
        const Transaction = require('../../models/transaction.model').default;
        const transactions = await Transaction.find({
          tripId: trip._id,
          status: 'completed',
        }).sort({ createdAt: -1 });

        return {
          ...trip.toObject(),
          transactions,
        };
      }

      return trip;
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error fetching trip with payment details',
        error.message
      );
    }
  }

  /**
   * Generate payment receipt
   */
  static async generatePaymentReceipt(tripId: string) {
    try {
      const trip = await Trip.findById(tripId).populate('customerId driverId');
      if (!trip) throw new ErrorResponse(404, 'Trip not found');

      if (trip.paymentStatus !== 'completed') {
        throw new ErrorResponse(400, 'Payment not completed for this trip');
      }

      const transactions = await Transaction.find({
        tripId: trip._id,
        status: 'completed',
      });

      const customer = await Customer.findById(trip.customerId).select(
        'firstname lastname phone'
      );

      if (!customer) {
        throw new ErrorResponse(400, 'Customer not found');
      }

      const driver = await Driver.findById(trip.driverId).select(
        'firstname lastname phone'
      );

      if (!driver) {
        throw new ErrorResponse(400, 'Customer not found');
      }

      const receipt = {
        tripDetails: {
          tripNumber: trip.tripNumber,
          date: trip.completedAt,
          pickup: trip.pickup.address,
          destination: trip.destination.address,
          distance: `${(trip.route.distance / 1000).toFixed(2)} km`,
          duration: `${Math.round(trip.route.duration / 60)} mins`,
        },
        paymentDetails: {
          method: trip.paymentMethod,
          amount: trip.pricing.finalAmount,
          breakdown: trip.pricing.breakdown,
          currency: trip.pricing.currency,
          status: trip.paymentStatus,
        },
        customerDetails: {
          name: `${customer.firstname} ${customer.lastname}`,
          phone: customer.phone.fullPhone,
        },
        driverDetails: {
          name: `${driver.firstname} ${driver.lastname}`,
          phone: driver.phone.fullPhone,
        },
        transactions,
        receiptNumber: `RCP-${trip.tripNumber}-${Date.now()}`,
        generatedAt: new Date(),
      };

      return receipt;
    } catch (error: any) {
      throw new ErrorResponse(500, 'Error generating receipt', error.message);
    }
  }
}

export default TripService;
