import express from 'express';
import { ENV } from './config/env';
import { connectDB } from './config/db-connection';
import { loadSecrets } from './utils/load-secrets';

const app = express();
app.use(express.json());

declare global {
  namespace Express {
    interface Request {
      sessionID?: string;
      session?: any;
    }
  }
}

async function startServer() {
  try {
    console.log('🚀 Starting server...');

    console.log('📋 Step 1: Loading secrets...');
    await loadSecrets();

    console.log('📋 Step 2: Connecting to database...');
    await connectDB();

    console.log('📋 Step 3: Starting GraphQL server...');
    const { startApolloServer } = await import('./graphql/server');
    const httpServer = await startApolloServer(app);

    console.log('📋 Step 4: Setting up application services...');
    const { setupApp } = await import('./config/app-setup');
    setupApp(app);

    const PORT = 8080;
    httpServer.listen(PORT, () => {
      console.log(`🎉 Server ready at http://localhost:${PORT}/graphql`);
      console.log(
        `📊 Health check available at http://localhost:${PORT}/api/health`
      );
    });
  } catch (error) {
    console.error('💥 Failed to start server:', error);
    process.exit(1);
  }
}

process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully...');
  process.exit(0);
});

startServer();

export default app;
