import { useServer } from 'graphql-ws/use/ws';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { WebSocketServer } from 'ws';
import express from 'express';
import http from 'http';
import cors from 'cors';
import schema from './schema';
import { context } from './context';
import { formatError } from '../utils/error-handler';
import { corsConfig } from './cors';
import { getUserInfo } from '../utils/auth-middleware';

export const startApolloServer = async (app: express.Application) => {
  const httpServer = http.createServer(app);

  // Create WebSocket server for subscriptions
  const wsServer = new WebSocketServer({
    server: httpServer,
    path: '/graphql',
  });

  // Set up WebSocket server
  const serverCleanup = useServer(
    {
      schema,
      context: async (ctx: any, msg: any, args: any) => {
        // Get auth token from connection params
        const token = ctx.connectionParams?.authToken;
        if (token) {
          const user = getUserInfo(token);
          return { user };
        }
        return {};
      },
    },
    wsServer
  );

  const server = new ApolloServer({
    schema: schema,
    formatError: formatError,
    plugins: [
      ApolloServerPluginDrainHttpServer({ httpServer }),
      {
        async serverWillStart() {
          return {
            async drainServer() {
              await serverCleanup.dispose();
            },
          };
        },
      },
    ],
    introspection: true,
  });

  await server.start();

  const apolloMiddleware = expressMiddleware(server, {
    context,
  }) as unknown as express.RequestHandler;

  app.use('/graphql', cors(corsConfig), express.json(), apolloMiddleware);

  return httpServer;
};
