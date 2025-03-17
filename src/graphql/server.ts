import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import express from 'express';
import http from 'http';
import cors, { CorsOptions } from 'cors';
import schema from './schema';
import { context } from './context';
import { formatError } from '../utils/error-handler';
import { corsConfig } from './cors';

export const startApolloServer = async (app: express.Application) => {
  const httpServer = http.createServer(app);

  const server = new ApolloServer({
    schema: schema,
    formatError: formatError,
    plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
    introspection: true
  });

  await server.start();

  const apolloMiddleware = expressMiddleware(server, {
    context,
  }) as unknown as express.RequestHandler;

  app.use('/graphql', cors(corsConfig), express.json(), apolloMiddleware);

  return httpServer;
};
