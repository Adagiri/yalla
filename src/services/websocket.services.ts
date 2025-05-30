// src/services/websocket.services.ts
import { Server } from 'socket.io';
import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';
import { ENV } from '../config/env';
import amazonLocationServices from './amazon-location.services';
import Trip from '../features/trip/trip.model';
import NotificationService from './notification.services';
import TripService from '../features/trip/trip.service';
import Driver from '../features/driver/driver.model';
import { LocationType, PhoneType } from '../types/general';

class WebSocketService {
  private io!: Server;
  private userSockets: Map<string, string[]> = new Map();

  initialize(httpServer: HTTPServer) {
    this.io = new Server(httpServer, {
      cors: {
        origin: ENV.ALLOWED_ORIGINS?.split(',') || '*',
        credentials: true,
      },
    });

    this.setupMiddleware();
    this.setupEventHandlers();
  }

  private setupMiddleware() {
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token;
        const decoded = jwt.verify(token, ENV.JWT_SECRET_KEY) as any;
        socket.data.userId = decoded.id;
        socket.data.userType = decoded.accountType;
        next();
      } catch (err) {
        next(new Error('Authentication failed'));
      }
    });
  }

  private setupEventHandlers() {
    this.io.on('connection', (socket) => {
      const userId = socket.data.userId;

      // Track user sockets
      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, []);
      }
      this.userSockets.get(userId)!.push(socket.id);

      // Join user-specific room
      socket.join(`user:${userId}`);

      // Driver-specific events
      if (socket.data.userType === 'DRIVER') {
        socket.on('update_location', (data) => {
          this.handleDriverLocationUpdate(socket, data);
        });

        socket.on('accept_trip', (data) => {
          this.handleTripAcceptance(socket, data);
        });
      }

      // Customer-specific events
      if (socket.data.userType === 'CUSTOMER') {
        socket.on('track_driver', (data) => {
          this.handleDriverTracking(socket, data);
        });
      }

      socket.on('disconnect', () => {
        const sockets = this.userSockets.get(userId);
        if (sockets) {
          const index = sockets.indexOf(socket.id);
          if (index > -1) sockets.splice(index, 1);
          if (sockets.length === 0) this.userSockets.delete(userId);
        }
      });
    });
  }

  // Send trip request to nearby drivers
  async sendTripRequestToDrivers(driverIds: string[], tripData: any) {
    driverIds.forEach((driverId) => {
      this.io.to(`user:${driverId}`).emit('new_trip_request', tripData);
    });
  }

  // Notify customer of trip updates
  async notifyCustomer(customerId: string, event: string, data: any) {
    this.io.to(`user:${customerId}`).emit(event, data);
  }

  // Broadcast driver location to customer
  async broadcastDriverLocation(tripId: string, location: any) {
    this.io.to(`trip:${tripId}`).emit('driver_location_update', location);
  }

  /**
   * Handle driver location update
   */
  private async handleDriverLocationUpdate(socket: any, data: any) {
    try {
      const {
        tripId,
        coordinates,
        heading,
        speed,
        accuracy,
      }: {
        tripId: string;
        coordinates: [number, number];
        heading: number;
        speed: number;
        accuracy: number;
      } = data;
      const driverId = socket.data.userId;

      // Validate input
      if (
        !coordinates ||
        !Array.isArray(coordinates) ||
        coordinates.length !== 2
      ) {
        socket.emit('error', { message: 'Invalid coordinates provided' });
        return;
      }

      // Update location in Amazon Location Service
      await amazonLocationServices.updateDriverLocation(driverId, coordinates, {
        heading,
        speed,
        accuracy,
      });

      // Update driver's current location in database
      await Driver.findByIdAndUpdate(driverId, {
        currentLocation: {
          type: 'Point',
          coordinates,
          heading,
          updatedAt: new Date(),
        },
      });

      // If driver is on an active trip, update trip location
      if (tripId) {
        const trip = await TripService.updateDriverLocation(
          tripId,
          driverId,
          coordinates,
          { heading, speed }
        );

        // Broadcast location to customer tracking this trip
        if (trip && trip.customerId) {
          this.io.to(`user:${trip.customerId}`).emit('driver_location_update', {
            tripId,
            driverLocation: {
              coordinates,
              heading,
              speed,
              updatedAt: new Date(),
            },
            // Calculate ETA based on current location
            estimatedArrival: await this.calculateNewETA(
              coordinates,
              trip.status === 'driver_assigned'
                ? trip.pickup.location.coordinates
                : trip.destination.location.coordinates
            ),
          });

          // Check if driver has arrived at pickup
          if (trip.status === 'driver_assigned') {
            const distanceToPickup = this.calculateDistance(
              coordinates,
              trip.pickup.location.coordinates
            );

            if (distanceToPickup < 50) {
              // Within 50 meters
              // Notify customer that driver has arrived
              await NotificationService.sendTripNotification(
                trip.customerId,
                'customer',
                'driver_arrived',
                {
                  ...trip.toObject(),
                  driverName: socket.data.driverName,
                  vehicleNumber: socket.data.vehicleNumber,
                }
              );

              socket.emit('arrived_at_pickup', {
                tripId,
                message: 'You have arrived at the pickup location',
              });
            } else if (distanceToPickup < 200) {
              // Within 200 meters
              // Send "driver arriving soon" notification once
              if (!socket.data[`notified_arriving_${tripId}`]) {
                this.io
                  .to(`user:${trip.customerId}`)
                  .emit('driver_arriving_soon', {
                    tripId,
                    distance: Math.round(distanceToPickup),
                    estimatedTime: Math.round(distanceToPickup / 50), // Rough estimate in minutes
                  });
                socket.data[`notified_arriving_${tripId}`] = true;
              }
            }
          }
        }
      } else {
        // Driver is online but not on a trip - update availability for nearby trip matching
        // Emit location to admin dashboard for monitoring
        this.io.to('admin_dashboard').emit('driver_location_update', {
          driverId,
          location: {
            coordinates,
            heading,
            speed,
            updatedAt: new Date(),
          },
          isAvailable: socket.data.isAvailable,
        });
      }

      // Acknowledge successful update
      socket.emit('location_update_success', {
        timestamp: new Date(),
        coordinates,
      });
    } catch (error: any) {
      console.error('Error handling driver location update:', error);
      socket.emit('error', {
        type: 'location_update_failed',
        message: 'Failed to update location',
        error: error.message,
      });
    }
  }

  /**
   * Handle trip acceptance by driver
   */
  private async handleTripAcceptance(socket: any, data: any) {
    try {
      const { tripId } = data;
      const driverId = socket.data.userId;

      if (!tripId) {
        socket.emit('error', { message: 'Trip ID is required' });
        return;
      }

      // Check if driver is available
      const driver = await Driver.findById(driverId);
      if (!driver || !driver.isAvailable) {
        socket.emit('error', {
          type: 'driver_unavailable',
          message: 'You are not available to accept trips',
        });
        return;
      }

      // Attempt to accept the trip
      const trip = await TripService.acceptTrip(tripId, driverId);

      interface VehicleDetails {
        plateNumber: string;
        brand: string;
        modelName: string;
        color: string;
      }
      interface DriverDetails {
        id: string;
        name: string;
        phone: PhoneType;
        photo: string;
        rating: number;
        totalTrips: number;
        vehicle: VehicleDetails;
        currentLocation?: LocationType;
      }
      // Get driver details for customer notification
      const driverDetails: DriverDetails = {
        id: driver._id,
        name: `${driver.firstname} ${driver.lastname}`,
        phone: driver.phone,
        photo: driver.profilePhoto,
        rating: driver.stats.averageRating,
        totalTrips: driver.stats.totalTrips,
        vehicle: await driver.populate('vehicle'),
        currentLocation: driver.currentLocation,
      };

      if (trip !== null) {
        // Notify the customer
        await NotificationService.sendTripNotification(
          trip.customerId,
          'customer',
          'trip_accepted',
          {
            ...trip.toObject(),
            driverName: driverDetails.name,
            driverPhone: driverDetails.phone.fullPhone,
            driverPhoto: driverDetails.photo,
            driverRating: driverDetails.rating,
            vehicleNumber: driverDetails.vehicle?.plateNumber,
            vehicleBrand: driverDetails.vehicle?.brand,
            vehicleModel: driverDetails.vehicle?.modelName,
            vehicleColor: driverDetails.vehicle?.color,
            estimatedArrival: trip.estimatedArrival,
          }
        );

        // Send real-time update to customer
        this.io.to(`user:${trip.customerId}`).emit('trip_accepted', {
          tripId: trip._id,
          driver: driverDetails,
          estimatedArrival: trip.estimatedArrival,
          message: 'Your trip has been accepted!',
        });

        // Notify other drivers that the trip is no longer available
        this.io.emit('trip_no_longer_available', { tripId });

        // Join trip-specific room for location sharing
        socket.join(`trip:${tripId}`);

        // Send success response to the accepting driver
        socket.emit('trip_acceptance_success', {
          trip: {
            id: trip._id,
            pickup: trip.pickup,
            destination: trip.destination,
            //   customer: {
            //     name: trip.name,
            //     phone: trip.customerPhone,
            //     rating: trip.customerRating,
            //   },
            pricing: trip.pricing,
            paymentMethod: trip.paymentMethod,
            verificationPin: trip.verificationPin,
            estimatedArrival: trip.estimatedArrival,
          },
          message: 'Trip accepted successfully!',
        });

        // Start location tracking for this trip
        socket.emit('start_location_tracking', {
          tripId,
          updateInterval: 5000, // Update every 5 seconds
        });
      }
    } catch (error: any) {
      console.error('Error handling trip acceptance:', error);

      // Handle specific errors
      if (error.message === 'Trip is no longer available') {
        socket.emit('error', {
          type: 'trip_already_taken',
          message: 'This trip has already been accepted by another driver',
        });
      } else if (error.message === 'Driver is not available') {
        socket.emit('error', {
          type: 'driver_busy',
          message: 'You already have an active trip',
        });
      } else {
        socket.emit('error', {
          type: 'trip_acceptance_failed',
          message: 'Failed to accept trip. Please try again.',
          error: error.message,
        });
      }
    }
  }

  /**
   * Handle customer tracking driver
   */
  private async handleDriverTracking(socket: any, data: any) {
    try {
      const { tripId } = data;
      const customerId = socket.data.userId;

      // Verify customer owns this trip
      const trip = await Trip.findOne({
        _id: tripId,
        customerId,
        status: { $in: ['driver_assigned', 'driver_arrived', 'in_progress'] },
      });

      if (!trip) {
        socket.emit('error', {
          type: 'invalid_trip',
          message: 'Trip not found or not active',
        });
        return;
      }

      // Join trip room to receive location updates
      socket.join(`trip:${tripId}`);

      // Send current driver location if available
      if (trip.driverLocation) {
        socket.emit('driver_location_update', {
          tripId,
          driverLocation: trip.driverLocation,
          tripStatus: trip.status,
        });
      }

      // Get driver's last known location from Amazon Location Service
      if (trip.driverId) {
        try {
          const driverLocation = await amazonLocationServices.getDriverLocation(
            trip.driverId
          );
          socket.emit('driver_location_update', {
            tripId,
            driverLocation: {
              coordinates: driverLocation.position,
              updatedAt: driverLocation.sampleTime,
            },
            tripStatus: trip.status,
          });
        } catch (error) {
          console.error('Error fetching driver location from Amazon:', error);
        }
      }

      socket.emit('tracking_started', {
        tripId,
        message: 'Now tracking driver location',
      });
    } catch (error: any) {
      console.error('Error handling driver tracking:', error);
      socket.emit('error', {
        type: 'tracking_failed',
        message: 'Failed to start driver tracking',
        error: error.message,
      });
    }
  }

  /**
   * Send notification to specific user
   */
  async sendToUser(userId: string, event: string, data: any) {
    this.io.to(`user:${userId}`).emit(event, data);
  }

  /**
   * Calculate distance between two coordinates (Haversine formula)
   */
  private calculateDistance(
    coord1: [number, number],
    coord2: [number, number]
  ): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (coord1[1] * Math.PI) / 180;
    const φ2 = (coord2[1] * Math.PI) / 180;
    const Δφ = ((coord2[1] - coord1[1]) * Math.PI) / 180;
    const Δλ = ((coord2[0] - coord1[0]) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  }

  /**
   * Calculate new ETA based on current position
   */
  private async calculateNewETA(
    currentPosition: [number, number],
    destination: [number, number]
  ): Promise<Date> {
    try {
      const route = await amazonLocationServices.calculateRoute(
        currentPosition,
        destination
      );
      return new Date(Date.now() + route.duration * 1000);
    } catch (error) {
      // Fallback to rough estimate
      const distance = this.calculateDistance(currentPosition, destination);
      const estimatedMinutes = Math.round(distance / 500); // Rough estimate: 500m per minute
      return new Date(Date.now() + estimatedMinutes * 60 * 1000);
    }
  }

  /**
   * Broadcast message to all connected users
   */
  public broadcastToAll(event: string, data: any): void {
    try {
      this.io.emit(event, {
        ...data,
        timestamp: new Date(),
      });
      console.log(`📡 Broadcasted ${event} to all connected users`);
    } catch (error) {
      console.error('Error broadcasting to all users:', error);
    }
  }

  /**
   * Broadcast to all drivers only
   */
  public broadcastToDrivers(event: string, data: any): void {
    try {
      // Get all connected driver sockets
      this.io.sockets.sockets.forEach((socket) => {
        if (socket.data.userType === 'DRIVER') {
          socket.emit(event, {
            ...data,
            timestamp: new Date(),
          });
        }
      });
      console.log(`📡 Broadcasted ${event} to all connected drivers`);
    } catch (error) {
      console.error('Error broadcasting to drivers:', error);
    }
  }

  /**
   * Broadcast to all customers only
   */
  public broadcastToCustomers(event: string, data: any): void {
    try {
      // Get all connected customer sockets
      this.io.sockets.sockets.forEach((socket) => {
        if (socket.data.userType === 'CUSTOMER') {
          socket.emit(event, {
            ...data,
            timestamp: new Date(),
          });
        }
      });
      console.log(`📡 Broadcasted ${event} to all connected customers`);
    } catch (error) {
      console.error('Error broadcasting to customers:', error);
    }
  }

  /**
   * Get connected users count by type
   */
  public getConnectedUsersCount(): {
    drivers: number;
    customers: number;
    total: number;
  } {
    let drivers = 0;
    let customers = 0;

    this.io.sockets.sockets.forEach((socket) => {
      if (socket.data.userType === 'DRIVER') drivers++;
      else if (socket.data.userType === 'CUSTOMER') customers++;
    });

    return {
      drivers,
      customers,
      total: drivers + customers,
    };
  }

  /**
   * Check if user is connected
   */
  public isUserConnected(userId: string): boolean {
    return (
      this.userSockets.has(userId) &&
      (this.userSockets.get(userId)?.length || 0) > 0
    );
  }
}

declare global {
  var websocketService: WebSocketService;
}

export default WebSocketService;
