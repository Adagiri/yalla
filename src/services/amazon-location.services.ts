import {
  LocationClient,
  SearchPlaceIndexForTextCommand,
  SearchPlaceIndexForPositionCommand,
  CalculateRouteCommand,
  BatchPutGeofenceCommand,
  PutGeofenceCommand,
  BatchEvaluateGeofencesCommand,
  BatchUpdateDevicePositionCommand,
  GetDevicePositionCommand,
  GetMapGlyphsCommand,
  GetMapSpritesCommand,
  GetMapStyleDescriptorCommand,
  GetMapTileCommand,
} from '@aws-sdk/client-location';
import { ENV } from '../config/env';

class AmazonLocationService {
  private client: LocationClient;

  constructor() {
    this.client = new LocationClient({
      region: ENV.AWS_LOCATION_REGION,
      credentials: {
        accessKeyId: ENV.AWS_ACCESS_KEY_ID,
        secretAccessKey: ENV.AWS_SECRET_ACCESS_KEY,
      },
    });
  }

  /**
   * Search for places by text (autocomplete)
   */
  async searchPlacesByText(text: string, biasPosition?: [number, number]) {
    try {
      const command = new SearchPlaceIndexForTextCommand({
        IndexName: ENV.AWS_LOCATION_PLACE_INDEX_NAME,
        Text: text,
        BiasPosition: biasPosition,
        MaxResults: 10,
      });

      const response = await this.client.send(command);
      return response.Results?.map((result) => ({
        placeId: result.PlaceId,
        label: result.Place?.Label,
        address: {
          label: result.Place?.Label,
          addressNumber: result.Place?.AddressNumber,
          street: result.Place?.Street,
          municipality: result.Place?.Municipality,
          region: result.Place?.Region,
          country: result.Place?.Country,
          postalCode: result.Place?.PostalCode,
        },
        geometry: {
          point: result.Place?.Geometry?.Point, // [lng, lat]
        },
        categories: result.Place?.Categories,
      }));
    } catch (error: any) {
      console.error('Error searching places:', error);
      throw new Error(`Failed to search places: ${error.message}`);
    }
  }

  /**
   * Reverse geocode - get address from coordinates
   */
  async reverseGeocode(position: [number, number]) {
    try {
      const command = new SearchPlaceIndexForPositionCommand({
        IndexName: ENV.AWS_LOCATION_PLACE_INDEX_NAME,
        Position: position, // [longitude, latitude]
        MaxResults: 1,
      });

      const response = await this.client.send(command);
      const result = response.Results?.[0];

      if (!result) {
        throw new Error('No address found for the given coordinates');
      }

      return {
        placeId: result.PlaceId,
        address: result.Place?.Label || '',
        details: {
          addressNumber: result.Place?.AddressNumber,
          street: result.Place?.Street,
          municipality: result.Place?.Municipality,
          region: result.Place?.Region,
          country: result.Place?.Country,
          postalCode: result.Place?.PostalCode,
        },
      };
    } catch (error: any) {
      console.error('Error reverse geocoding:', error);
      throw new Error(`Failed to reverse geocode: ${error.message}`);
    }
  }

  /**
   * Calculate route between two points
   */
  async calculateRoute(
    origin: [number, number],
    destination: [number, number],
    options?: {
      avoidTolls?: boolean;
      avoidFerries?: boolean;
    }
  ) {
    try {
      const command = new CalculateRouteCommand({
        CalculatorName: ENV.AWS_LOCATION_ROUTE_CALCULATOR_NAME,
        DeparturePosition: origin, // [longitude, latitude]
        DestinationPosition: destination,
        TravelMode: 'Car',
        DistanceUnit: 'Kilometers',
        CarModeOptions: {
          AvoidTolls: options?.avoidTolls,
          AvoidFerries: options?.avoidFerries,
        },
      });

      const response = await this.client.send(command);

      return {
        distance: response.Summary?.Distance || 0, // in kilometers
        duration: response.Summary?.DurationSeconds || 0, // in seconds
        distanceUnit: response.Summary?.DistanceUnit,
        routeBBox: response.Summary?.RouteBBox, // [minLng, minLat, maxLng, maxLat]
        legs: response.Legs?.map((leg) => ({
          distance: leg.Distance,
          duration: leg.DurationSeconds,
          startPosition: leg.StartPosition,
          endPosition: leg.EndPosition,
          steps: leg.Steps?.map((step) => ({
            distance: step.Distance,
            duration: step.DurationSeconds,
            startPosition: step.StartPosition,
            endPosition: step.EndPosition,
            geometryOffset: step.GeometryOffset,
          })),
        })),
      };
    } catch (error: any) {
      console.error('Error calculating route:', error);
      throw new Error(`Failed to calculate route: ${error.message}`);
    }
  }

  /**
   * Create or update a geofence (for estate boundaries)
   */
  async createGeofence(
    geofenceId: string,
    geometry: {
      polygon: number[][][]; // Array of linear rings
    }
  ) {
    try {
      const command = new PutGeofenceCommand({
        CollectionName: ENV.AWS_LOCATION_GEOFENCE_COLLECTION_NAME,
        GeofenceId: geofenceId,
        Geometry: {
          Polygon: geometry.polygon,
        },
      });

      await this.client.send(command);
      return { success: true, geofenceId };
    } catch (error: any) {
      console.error('Error creating geofence:', error);
      throw new Error(`Failed to create geofence: ${error.message}`);
    }
  }

  /**
   * Check if a position is within any geofences
   */
  async evaluateGeofences(deviceId: string, position: [number, number]) {
    try {
      const command = new BatchEvaluateGeofencesCommand({
        CollectionName: ENV.AWS_LOCATION_GEOFENCE_COLLECTION_NAME,
        DevicePositionUpdates: [
          {
            DeviceId: deviceId,
            Position: position,
            SampleTime: new Date(),
          },
        ],
      });

      const response = await this.client.send(command);
      const errors = response.Errors;

      if (errors && errors.length > 0) {
        console.error('Geofence evaluation errors:', errors);
      }

      // Note: Geofence events are typically delivered via EventBridge
      return response;
    } catch (error: any) {
      console.error('Error evaluating geofences:', error);
      throw new Error(`Failed to evaluate geofences: ${error.message}`);
    }
  }

  /**
   * Update driver location
   */
  async updateDriverLocation(
    driverId: string,
    position: [number, number],
    metadata?: {
      heading?: number;
      speed?: number;
      accuracy?: number;
    }
  ) {
    try {
      // Build PositionProperties ensuring all values are strings
      const positionProperties: Record<string, string> = {};

      if (metadata?.heading !== undefined) {
        positionProperties.heading = metadata.heading.toString();
      }

      if (metadata?.speed !== undefined) {
        positionProperties.speed = metadata.speed.toString();
      }

      // Additional properties you might want to track
      positionProperties.timestamp = new Date().toISOString();
      positionProperties.driverId = driverId;

      const command = new BatchUpdateDevicePositionCommand({
        TrackerName: ENV.AWS_LOCATION_TRACKER_NAME,
        Updates: [
          {
            DeviceId: driverId,
            Position: position,
            SampleTime: new Date(),
            Accuracy: metadata?.accuracy
              ? {
                  Horizontal: metadata.accuracy,
                }
              : undefined,
            PositionProperties:
              Object.keys(positionProperties).length > 0
                ? positionProperties
                : undefined,
          },
        ],
      });

      const response = await this.client.send(command);

      if (response.Errors && response.Errors.length > 0) {
        console.error('Position update errors:', response.Errors);
        // You might want to handle specific errors here
        const error = response.Errors[0];

        console.log(`Error occured ${error}`);
        // if (error.Error === 'DeviceNotFound') {
        //   // Device needs to be created first
        //   console.log(`Device ${driverId} not found, creating...`);
        //   // You might want to auto-create the device here
        // }
      }

      return {
        success: true,
        errors: response.Errors || [],
      };
    } catch (error: any) {
      console.error('Error updating driver location:', error);
      throw new Error(`Failed to update driver location: ${error.message}`);
    }
  }

  /**
   * Get driver's current location
   */
  async getDriverLocation(driverId: string) {
    try {
      const command = new GetDevicePositionCommand({
        TrackerName: ENV.AWS_LOCATION_TRACKER_NAME,
        DeviceId: driverId,
      });

      const response = await this.client.send(command);

      return {
        position: response.Position, // [longitude, latitude]
        accuracy: response.Accuracy?.Horizontal,
        receivedTime: response.ReceivedTime,
        sampleTime: response.SampleTime,
        properties: response.PositionProperties,
      };
    } catch (error: any) {
      console.error('Error getting driver location:', error);
      throw new Error(`Failed to get driver location: ${error.message}`);
    }
  }

  /**
   * Generate map credentials for frontend
   */
  async getMapCredentials() {
    // This would typically involve AWS Cognito or IAM roles
    // For production, use Amazon Cognito identity pools
    return {
      mapName: ENV.AWS_LOCATION_MAP_NAME,
      region: ENV.AWS_LOCATION_REGION,

      // Credentials should be temporary and scoped
    };
  }


}


export default new AmazonLocationService();
