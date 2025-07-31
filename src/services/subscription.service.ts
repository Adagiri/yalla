import { pubsub } from '../graphql/pubsub';
import { SUBSCRIPTION_EVENTS } from '../graphql/subscription-events';

export class SubscriptionService {
  /**
   * Trip-related events
   */
  static async publishNewTripRequest(driverIds: string[], tripData: any) {
    // Publish to each driver individually for targeted filtering
    for (const driverId of driverIds) {
      await pubsub.publish(SUBSCRIPTION_EVENTS.NEW_TRIP_REQUEST, {
        newTripRequest: {
          ...tripData,
          targetDriverId: driverId,
        },
      });
    }
  }

  static async publishTripAccepted(
    tripId: string,
    customerId: string,
    driverData: any
  ) {
    await pubsub.publish(SUBSCRIPTION_EVENTS.TRIP_ACCEPTED, {
      tripAccepted: {
        tripId,
        customerId,
        driver: driverData,
      },
    });
  }

  static async publishTripStatusChanged(tripData: any) {
    await pubsub.publish(SUBSCRIPTION_EVENTS.TRIP_STATUS_CHANGED, {
      tripStatusChanged: tripData,
    });
  }

  static async publishDriverLocationUpdate(locationData: any) {
    await pubsub.publish(SUBSCRIPTION_EVENTS.DRIVER_LOCATION_UPDATE, {
      driverLocationUpdate: locationData,
    });
  }

  /**
   * Admin-related events
   */
  static async publishAdminNotification(notification: any) {
    await pubsub.publish(SUBSCRIPTION_EVENTS.ADMIN_NOTIFICATION, {
      adminNotificationReceived: notification,
    });
  }

  static async publishSystemHealthUpdate(healthData: any) {
    await pubsub.publish(SUBSCRIPTION_EVENTS.SYSTEM_HEALTH_UPDATE, {
      systemHealthUpdated: healthData,
    });
  }

  static async publishAuditLogCreated(auditData: any) {
    await pubsub.publish(SUBSCRIPTION_EVENTS.AUDIT_LOG_CREATED, {
      auditLogCreated: auditData,
    });
  }

  /**
   * Driver-related events
   */
  static async publishDriverStatusChanged(driverData: any) {
    await pubsub.publish(SUBSCRIPTION_EVENTS.DRIVER_STATUS_CHANGED, {
      driverStatusChanged: driverData,
    });
  }

  /**
   * System events
   */
  static async publishSystemConfigUpdated(configData: any) {
    await pubsub.publish(SUBSCRIPTION_EVENTS.SYSTEM_CONFIG_UPDATED, {
      systemConfigUpdated: configData,
    });
  }

  static async publishEmergencyAlert(alertData: any) {
    await pubsub.publish(SUBSCRIPTION_EVENTS.EMERGENCY_ALERT, {
      emergencyAlert: alertData,
    });
  }

  /**
   * Publish trip lifecycle updates
   */
  static async publishTripLifecycleUpdate(data: {
    tripId: string;
    status: string;
    message?: string;
    timestamp: Date;
    [key: string]: any;
  }) {
    await pubsub.publish(SUBSCRIPTION_EVENTS.TRIP_LIFECYCLE_UPDATE, {
      tripLifecycleUpdate: data,
    });
  }
}
