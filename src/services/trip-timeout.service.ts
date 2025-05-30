import Trip from '../features/trip/trip.model';
import TripNotificationService from './trip-notification.service';

class TripTimeoutService {
  private static timeouts = new Map<string, NodeJS.Timeout>();

  /**
   * Schedule trip timeout
   */
  static scheduleTimeout(
    tripId: string,
    timeoutMs: number = 5 * 60 * 1000
  ): void {
    // Clear existing timeout if any
    this.clearTimeout(tripId);

    const timeout = setTimeout(async () => {
      try {
        await this.handleTimeout(tripId);
      } catch (error) {
        console.error('Error handling trip timeout:', error);
      } finally {
        this.timeouts.delete(tripId);
      }
    }, timeoutMs);

    this.timeouts.set(tripId, timeout);
    console.log(
      `⏰ Timeout scheduled for trip ${tripId} in ${timeoutMs / 1000}s`
    );
  }

  /**
   * Clear trip timeout
   */
  static clearTimeout(tripId: string): void {
    const timeout = this.timeouts.get(tripId);
    if (timeout) {
      clearTimeout(timeout);
      this.timeouts.delete(tripId);
      console.log(`⏰ Timeout cleared for trip ${tripId}`);
    }
  }

  /**
   * Handle trip timeout
   */
  private static async handleTimeout(tripId: string): Promise<void> {
    const trip = await Trip.findById(tripId);

    if (trip && trip.status === 'searching') {
      trip.status = 'cancelled';
      trip.cancelledAt = new Date();
      await trip.save();

      console.log(`⏰ Trip ${trip.tripNumber} timed out and cancelled`);

      // Notify customer through notification service
      // This could be moved to TripNotificationService
      if (trip.customerId) {
        await TripNotificationService.notifyCustomerTripCancelled(
          trip,
          'Request timed out - no drivers available'
        );
      }
    }
  }

  /**
   * Get active timeouts (for debugging)
   */
  static getActiveTimeouts(): string[] {
    return Array.from(this.timeouts.keys());
  }
}

export default TripTimeoutService;
