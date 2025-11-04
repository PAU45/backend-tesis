require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const pinoHttp = require('pino-http');
const swaggerUi = require('swagger-ui-express');

const { apiRouter } = require('./web/router');
const createError = require('http-errors');

const app = express();
const isDev = process.env.NODE_ENV !== 'production';

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(helmet());
app.use(morgan('dev'));
app.use(pinoHttp(isDev ? {
  transport: {
    target: 'pino-pretty',
    options: { colorize: true, singleLine: true, levelFirst: true }
  },
  level: process.env.LOG_LEVEL || 'info'
} : {
  level: process.env.LOG_LEVEL || 'info'
}));

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200 });
app.use(limiter);

// Desactivar ETag si quieres evitar 304 y forzar 200 + cuerpo
app.set('etag', false);

// Evitar caché en todas las rutas /api (útil en dev para ver siempre contenido)
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

// Minimal OpenAPI stub for Swagger UI
const openapi = {
  openapi: '3.0.0',
  info: { title: 'SoulSpace API', version: '1.0.0' },
};
app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapi));

app.get('/health', (_req, res) => res.json({ ok: true }));


// Mount API router at /api
app.use('/api', apiRouter);
// Some frontends accidentally prefix the base url with `/api` producing `/api/api/...`.
// Add a compatibility mount so requests to `/api/api/*` still work in dev while frontend is fixed.
app.use('/api/api', apiRouter);

// Manejo de rutas no encontradas con http-errors
app.use((req, res, next) => {
  next(createError(404, 'No encontrado'));
});

// Middleware de errores para respuestas cortas
app.use((err, req, res, next) => {
  res.status(err.status || 500).json({
    error: err.message || 'Error interno',
    code: err.status || 500
  });
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`API running on http://localhost:${port} (docs at /docs)`);
});
