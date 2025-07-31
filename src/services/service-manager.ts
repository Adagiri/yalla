import { queueService } from './redis-queue.service';
import { cacheService } from './redis-cache.service';
import { JobProcessors } from './job-processors.service';

export class ServiceManager {
  private static isInitialized = false;

  /**
   * Initialize all services
   */
  static async initialize() {
    if (this.isInitialized) {
      console.log('⚠️ Services already initialized');
      return;
    }

    try {
      console.log('🚀 Initializing services...');

      // Initialize job processors
      JobProcessors.initialize();

      // Start queue processing
      await queueService.start();

      // Start periodic maintenance jobs
      JobProcessors.startPeriodicJobs();

      this.isInitialized = true;
      console.log('✅ All services initialized successfully');

      // Log service status
      this.logServiceStatus();
    } catch (error) {
      console.error('❌ Failed to initialize services:', error);
      throw error;
    }
  }

  /**
   * Gracefully shutdown all services
   */
  static async shutdown() {
    try {
      console.log('🛑 Shutting down services...');

      // Stop queue processing
      queueService.stop();

      console.log('✅ Services shut down successfully');
    } catch (error) {
      console.error('❌ Error during service shutdown:', error);
    }
  }

  /**
   * Check service health
   */
  static async healthCheck() {
    try {
      const queueStats = await queueService.getStats();

      return {
        status: 'healthy',
        timestamp: new Date(),
        services: {
          queue: {
            status: 'running',
            stats: queueStats,
          },
          cache: {
            status: 'connected',
          },
        },
      };
    } catch (error: any) {
      return {
        status: 'unhealthy',
        timestamp: new Date(),
        error: error.message,
      };
    }
  }

  /**
   * Log current service status
   */
  private static async logServiceStatus() {
    try {
      const health = await this.healthCheck();
      console.log('📊 Service Status:', JSON.stringify(health, null, 2));
    } catch (error) {
      console.error('Error getting service status:', error);
    }
  }
}