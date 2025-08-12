import Redis from 'ioredis';
import { ENV } from '../config/env';

export interface Job {
  id: string;
  type: string;
  data: any;
  priority: number;
  attempts: number;
  maxAttempts: number;
  delay?: number;
  createdAt: Date;
  processedAt?: Date;
  completedAt?: Date;
  failedAt?: Date;
  error?: string;
}

export class RedisQueueService {
  private redis: Redis;
  private subscribers: Map<string, (job: Job) => Promise<void>> = new Map();
  private isProcessing = false;

  constructor() {
    this.redis = new Redis({
      host: ENV.REDIS_HOST,
      port: parseInt(ENV.REDIS_PORT),
      password: ENV.REDIS_PASSWORD,
      db: 1, // Use different DB for queue
    });

    this.redis.on('connect', () => {
      console.log('✅ Redis Queue connected');
    });

    this.redis.on('error', (error) => {
      console.error('❌ Redis Queue error:', error);
    });
  }

  /**
   * Add job to queue
   */
  async addJob(
    type: string,
    data: any,
    options: {
      priority?: number;
      delay?: number;
      maxAttempts?: number;
    } = {}
  ): Promise<string> {
    const job: Job = {
      id: `${type}:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`,
      type,
      data,
      priority: options.priority || 0,
      attempts: 0,
      maxAttempts: options.maxAttempts || 3,
      delay: options.delay,
      createdAt: new Date(),
    };

    const score = options.delay
      ? Date.now() + options.delay
      : Date.now() - (options.priority || 0) * 1000;

    await this.redis.zadd('jobs:queue', score, JSON.stringify(job));

    console.log(`📋 Job added: ${job.id} (${type})`);
    console.log(`📋 Job data: (${data})`);
    return job.id;
  }

  /**
   * Register job processor
   */
  onJob(type: string, processor: (job: Job) => Promise<void>) {
    this.subscribers.set(type, processor);
    console.log(`🔧 Registered processor for: ${type}`);
  }

  /**
   * Start processing jobs
   */
  async start() {
    if (this.isProcessing) return;

    this.isProcessing = true;
    console.log('🚀 Started job processing');

    this.processJobs();
  }

  /**
   * Stop processing jobs
   */
  stop() {
    this.isProcessing = false;
    console.log('⏹️ Stopped job processing');
  }

  /**
   * Process jobs from queue
   */
  private async processJobs() {
    while (this.isProcessing) {
      try {
        // Get next job (FIFO with priority)
        const result = await this.redis.bzpopmin('jobs:queue', 1);

        if (!result) continue;

        const jobData = JSON.parse(result[1]);
        console.log(jobData, "job data")
        const job: Job = {
          ...jobData,
          createdAt: new Date(jobData.createdAt),
          processedAt: new Date(),
        };

        // Check if delayed
        if (
          job.delay &&
          Date.now() < new Date(job.createdAt).getTime() + job.delay
        ) {
          // Re-queue with delay
          await this.redis.zadd(
            'jobs:queue',
            Date.now() + 1000,
            JSON.stringify(job)
          );
          continue;
        }

        console.log('job: ', job);
        console.log(`⚡ Processing job: ${job.id} (${job.type})`);

        const processor = this.subscribers.get(job.type);
        if (!processor) {
          console.error(`❌ No processor for job type: ${job.type}`);
          continue;
        }

        try {
          await processor(job);
          job.completedAt = new Date();

          // Store completed job for tracking
          await this.redis.hset('jobs:completed', job.id, JSON.stringify(job));
          await this.redis.expire('jobs:completed', 86400); // Keep for 24 hours

          console.log(`✅ Job completed: ${job.id}`);
        } catch (error: any) {
          job.attempts++;
          job.error = error.message;

          if (job.attempts < job.maxAttempts) {
            // Retry with exponential backoff
            const delay = Math.pow(2, job.attempts) * 1000;
            await this.redis.zadd(
              'jobs:queue',
              Date.now() + delay,
              JSON.stringify(job)
            );
            console.log(
              `🔄 Job retry ${job.attempts}/${job.maxAttempts}: ${job.id}`
            );
          } else {
            job.failedAt = new Date();
            await this.redis.hset('jobs:failed', job.id, JSON.stringify(job));
            console.error(`❌ Job failed: ${job.id} - ${error.message}`);
          }
        }
      } catch (error: any) {
        console.error('Error processing jobs:', error);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }

  /**
   * Get queue stats
   */
  async getStats() {
    const queueLength = await this.redis.zcard('jobs:queue');
    const completedCount = await this.redis.hlen('jobs:completed');
    const failedCount = await this.redis.hlen('jobs:failed');

    return {
      pending: queueLength,
      completed: completedCount,
      failed: failedCount,
    };
  }

  /**
   * Clear completed jobs
   */
  async clearCompleted() {
    await this.redis.del('jobs:completed');
  }

  /**
   * Clear failed jobs
   */
  async clearFailed() {
    await this.redis.del('jobs:failed');
  }
}

// Singleton instance
export const queueService = new RedisQueueService();
