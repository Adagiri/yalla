import type { CorsOptions } from 'cors';

export const corsConfig: CorsOptions = {
  origin: '*',
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: [
    'X-Total-Docs',
    'X-Docs-Retrieved',
    'X-Has-Next-Page',
    'X-Has-Previous-Page',
    'X-Next-Cursor-FieldValue',
    'X-Next-Cursor-Id',
    'X-Previous-Cursor-FieldValue',
    'X-Previous-Cursor-Id',
  ],
};
