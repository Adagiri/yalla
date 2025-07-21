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

export const pubsub = new RedisPubSub({
  publisher,
  subscriber,
  messageEventName: 'message',
  pmessageEventName: 'pmessage',
});
