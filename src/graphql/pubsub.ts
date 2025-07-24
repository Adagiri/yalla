import { RedisPubSub } from 'graphql-redis-subscriptions';
import Redis from 'ioredis';
import { ENV } from '../config/env';

const publisher = new Redis({
  host: ENV.REDIS_HOST,
  port: parseInt(ENV.REDIS_PORT),
  password: ENV.REDIS_PASSWORD,
  db: 4,
});

const subscriber = new Redis({
  host: ENV.REDIS_HOST,
  port: parseInt(ENV.REDIS_PORT),
  password: ENV.REDIS_PASSWORD,
  db: 4,
});

// Connection event handlers
publisher.on('connect', () => {
  console.log('✅ Redis Publisher connected for GraphQL subscriptions');
});

subscriber.on('connect', () => {
  console.log('✅ Redis Subscriber connected for GraphQL subscriptions');
});

publisher.on('error', (error) => {
  console.error('❌ Redis Publisher error:', error);
});

subscriber.on('error', (error) => {
  console.error('❌ Redis Subscriber error:', error);
});

export const pubsub = new RedisPubSub({
  publisher,
  subscriber,
  messageEventName: 'message',
  pmessageEventName: 'pmessage',
});
