import { AccountLevel, AuthChannel } from '../../constants/general';

// Trip-related types
export interface CreateTripInput {
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
  priceOffered?: number;
}

export interface UpdateDriverLocationInput {
  tripId: string;
  location: [number, number];
  metadata?: {
    heading?: number;
    speed?: number;
  };
}

export interface StartTripInput {
  tripId: string;
  pin: string;
}

export interface RateTripInput {
  tripId: string;
  rating: number;
  review?: string;
}

export interface CancelTripInput {
  tripId: string;
  reason?: string;
}

export interface TripFilter {
  ids?: string[];
  customerId?: string;
  driverId?: string;
  status?:
    | 'searching'
    | 'driver_assigned'
    | 'driver_arrived'
    | 'in_progress'
    | 'completed'
    | 'cancelled';
  paymentMethod?: 'cash' | 'card' | 'wallet';
  tripType?: 'within_estate' | 'outside_estate';
  dateFrom?: Date;
  dateTo?: Date;
  estateId?: string;
}

export interface TripSort {
  field: 'requestedAt' | 'completedAt' | 'finalAmount' | 'distance' | 'status';
  direction: 'ASC' | 'DESC';
}

export interface LocationInput {
  address: string;
  coordinates: CoordinatesInput;
}

export interface CoordinatesInput {
  lat: number;
  lng: number;
}

export interface TripEstimate {
  distance: number;
  duration: number;
  pricing: TripPricing;
  surgeActive: boolean;
  surgeMultiplier: number;
}

export interface TripPricing {
  baseAmount: number;
  surgeMultiplier: number;
  finalAmount: number;
  currency: string;
  breakdown: {
    baseFare: number;
    distanceCharge: number;
    timeCharge: number;
    surgeFee: number;
    discount: number;
  };
}

export interface DriverEarnings {
  totalEarnings: number;
  driverShare: number;
  platformCommission: number;
  totalTrips: number;
  cashCollected: number;
  cardPayments: number;
  averagePerTrip?: number;
}

export interface NearbyDriver {
  id: string;
  firstname: string;
  lastname: string;
  phone: string;
  currentLocation: {
    type: 'Point';
    coordinates: [number, number];
  };
  vehicleId?: string;
  stats: {
    totalTrips: number;
    averageRating: number;
    totalEarnings: number;
  };
}

// Driver-related types (keeping existing ones and adding missing)
export interface RegisterDriverInput {
  email: string;
  phone: { countryCode: string; localNumber: string; fullPhone: string };
  password: string;
  authChannel: AuthChannel;
}

export interface AddDriverInput {
  name: string;
  unitId: string;
  email?: string;
  phone?: { countryCode: string; localNumber: string; fullPhone: string };
  authChannel: AuthChannel;
  level: AccountLevel;
}

export interface DriverFilter {
  ids?: string[];
  firstName?: string;
  lastName?: string;
  email?: string;
  locationId?: string;
  isMFAEnabled?: boolean;
  authChannels?: AuthChannel[];
  isOnline?: boolean;
  isAvailable?: boolean;
  currentLocation?: {
    coordinates: [number, number];
    radius: number; // in meters
  };
}

export interface DriverSort {
  field:
    | 'firstName'
    | 'lastName'
    | 'email'
    | 'createdAt'
    | 'updatedAt'
    | 'totalTrips'
    | 'averageRating';
  direction: 'ASC' | 'DESC';
}

export interface UpdateDriverPersonalInfoInput {
  firstName: string;
  lastName: string;
  locationId: string;
}

export interface UpdateDriverLicenseInput {
  driverLicenseFront: string;
  driverLicenseBack: string;
}

export interface UpdateProfilePhotoInput {
  src: string;
}

// Additional driver-related types for trip operations
export interface UpdateDriverStatusInput {
  isOnline: boolean;
  currentLocation?: {
    coordinates: [number, number];
    heading?: number;
    speed?: number;
  };
}

export interface DriverLocationUpdate {
  driverId: string;
  coordinates: [number, number];
  heading?: number;
  speed?: number;
  timestamp: Date;
}

// Admin-specific types
export interface AssignTripInput {
  tripId: string;
  driverId: string;
  reason?: string;
}

export interface TripStats {
  totalTrips: number;
  completedTrips: number;
  cancelledTrips: number;
  totalRevenue: number;
  averageRating: number;
  averageTripDuration: number;
  averageDistance: number;
}

// Subscription payload types
export interface TripUpdatedPayload {
  tripId: string;
  trip: any; // Trip document
  previousStatus?: string;
  newStatus: string;
}

export interface DriverLocationUpdatedPayload {
  tripId: string;
  driverId: string;
  location: {
    coordinates: [number, number];
    heading?: number;
    speed?: number;
  };
  timestamp: Date;
}

export interface NewTripRequestPayload {
  tripId: string;
  trip: any; // Trip document
  driverIds: string[]; // Drivers who should receive this notification
}

// Timeline event types
export interface TimelineEvent {
  event:
    | 'created'
    | 'driver_assigned'
    | 'driver_arrived'
    | 'trip_started'
    | 'trip_completed'
    | 'cancelled';
  timestamp: Date;
  metadata?: any;
}

// Route calculation types
export interface RouteCalculationInput {
  origin: [number, number];
  destination: [number, number];
  departureTime?: Date;
  travelMode?: 'Car' | 'Pedestrian' | 'Truck';
}

export interface RouteResult {
  distance: number; // in meters
  duration: number; // in seconds
  polyline?: string;
  legs?: Array<{
    distance: number;
    duration: number;
    startAddress: string;
    endAddress: string;
  }>;
}

// Geofence types for estate boundaries
export interface GeofenceEvent {
  eventType: 'enter' | 'exit';
  geofenceId: string;
  deviceId: string;
  location: [number, number];
  timestamp: Date;
}

// Surge pricing types
export interface SurgeArea {
  location: [number, number];
  radius: number;
  multiplier: number;
  activeTrips: number;
  availableDrivers: number;
  estimatedWaitTime: number;
}

// Payment types
export interface PaymentProcessInput {
  tripId: string;
  amount: number;
  currency: string;
  paymentMethod: 'card' | 'wallet';
  paymentToken?: string;
}

export interface PaymentResult {
  success: boolean;
  transactionId?: string;
  errorMessage?: string;
  paymentStatus: 'completed' | 'failed' | 'pending';
}
