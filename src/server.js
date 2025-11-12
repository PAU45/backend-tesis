require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const pinoHttp = require('pino-http');
const swaggerUi = require('swagger-ui-express');
const path = require('path');

const { apiRouter } = require('./web/router');
const { requestLogger } = require('./web/secure/requestLogger');
const createError = require('http-errors');

const app = express();
const isDev = process.env.NODE_ENV !== 'production';

app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS || 1));

// Helper: set CORS headers for a specific origin (used for early responses)
function setCorsHeadersForOrigin(res, origin) {
  try {
    if (!origin) return;
    const localhostRegex = /^https?:\/\/localhost(?::\d+)?$/i;
    if (localhostRegex.test(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Headers', 'Authorization,Content-Type,Accept');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
  } catch (e) {
    // ignore
  }
}

// --- 0) Early middleware: attempt to recover malformed multipart requests
app.use((req, res, next) => {
  // If the client set Content-Type: multipart/form-data but omitted boundary,
  // try to peek the first chunk to extract the boundary (development-only helper).
  try {
    const ct = String(req.headers['content-type'] || '');
    if (ct.includes('multipart/form-data') && !/boundary=/.test(ct)) {
      const origin = req.headers.origin;
      if (req.method === 'OPTIONS') {
        if (origin) setCorsHeadersForOrigin(res, origin);
        return res.sendStatus(204);
      }

      const MAX_PEEK = 1024 * 1024; // 1MB
      let received = Buffer.alloc(0);
      let settled = false;

      function fail(msg) {
        if (settled) return;
        settled = true;
        if (origin) setCorsHeadersForOrigin(res, origin);
        res.status(400).json({ error: msg });
      }

      function cleanup() {
        req.removeListener('data', onData);
        req.removeListener('end', onEnd);
        req.removeListener('error', onError);
        req.removeListener('close', onClose);
      }

      function onData(chunk) {
        if (settled) return;
        received = Buffer.concat([received, chunk]);
        if (received.length > MAX_PEEK) {
          cleanup();
          return fail('Uploaded data too large to auto-recover; please fix the client Content-Type header.');
        }
        const idx = received.indexOf('\r\n');
        if (idx !== -1) {
          const firstLine = received.slice(0, idx).toString('latin1');
          if (firstLine.startsWith('--')) {
            const boundary = firstLine.slice(2).trim();
            if (boundary && boundary.length > 0) {
              req.headers['content-type'] = `multipart/form-data; boundary=${boundary}`;
              try {
                if (typeof req.unshift === 'function') req.unshift(received);
              } catch (e) {
                cleanup();
                return fail('Could not re-insert request body for parsing.');
              }
              cleanup();
              settled = true;
              return next();
            }
          }
          cleanup();
          return fail('Invalid multipart body: could not detect boundary. Fix client to not set Content-Type manually.');
        }
      }

      function onEnd() {
        if (settled) return;
        cleanup();
        return fail('Request ended before boundary could be detected; please fix client Content-Type.');
      }

      function onError(err) {
        if (settled) return;
        cleanup();
        return fail('Error reading request body: ' + String(err));
      }

      function onClose() {
        if (settled) return;
        cleanup();
        return fail('Connection closed before body could be read');
      }

      req.on('data', onData);
      req.on('end', onEnd);
      req.on('error', onError);
      req.on('close', onClose);
      req.resume();
      return;
    }
  } catch (e) {
    // ignore and continue
  }
  next();
});
// Minimal OpenAPI stub so swagger-ui can mount in dev without requiring the
// project to carry a full generated spec. If you have a real OpenAPI JSON file
// please replace this with a proper import.
const openapi = {
  openapi: '3.0.0',
  info: { title: 'SoulSpace API', version: '1.0.0' },
  paths: {},
};

app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapi));
app.get('/health', (_req, res) => res.json({ ok: true }));

// --- CORS: configurar antes de montar routers y statics --------------------
// Permitimos orígenes localhost en desarrollo y soportamos credenciales.
const corsOptions = {
  origin: (origin, callback) => {
    // permitir requests sin Origin (ej. curl, server-side)
    if (!origin) return callback(null, true);
    const localhostRegex = /^https?:\/\/localhost(?::\d+)?$/i;
    if (localhostRegex.test(origin)) return callback(null, true);
    // Denegar otros orígenes por defecto (puedes añadir más si lo necesitas)
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
};

// Aplicar CORS globalmente antes de montar rutas
app.use(cors(corsOptions));
// Handle preflight OPTIONS for any path without registering a route pattern
// that could trigger path-to-regexp parsing errors. We invoke the CORS
// middleware directly for OPTIONS requests.
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    return cors(corsOptions)(req, res, next);
  }
  next();
});

// --- 4) Normalize malformed client URLs (compat layer) ---------------------
// Algunos frontends concatenan mal la base y terminan con rutas como:
//   /apihttp://localhost:3000/api/usuario/perfil/foto
// Esta middleware intenta detectar y normalizar a la parte pathname+search.
app.use((req, res, next) => {
  try {
    const orig = req.originalUrl || req.url || '';
    // buscaremos si existe algo como 'http://' o 'https://' dentro de la url y si comienza por '/api'
    if (orig.startsWith('/api') && (orig.includes('http://') || orig.includes('https://'))) {
      const httpIndex = orig.indexOf('http');
      if (httpIndex !== -1) {
        const urlStr = orig.slice(httpIndex);
        try {
          const parsed = new URL(urlStr);
          req.url = parsed.pathname + (parsed.search || '');
          req.originalUrl = req.url;
          console.warn('Normalized malformed frontend URL', orig, '->', req.url);
        } catch (e) {
          // fallback: quitar el primer '/api' y usar el resto
          req.url = orig.replace(/^\/api/, '');
          req.originalUrl = req.url;
          console.warn('Fallback-normalized malformed frontend URL', orig, '->', req.url);
        }
      }
    }
  } catch (e) {
    console.error('Error normalizing URL', e);
  }
  next();
});

// Monta router principal de la API
// Parse JSON and urlencoded bodies before routes so req.body is defined
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

app.use('/api', apiRouter);
// Compatibilidad dev: aceptar /api/api/* si frontend está roto temporalmente
app.use('/api/api', apiRouter);

// --- 5) Servir archivos subidos con CORS correcto ---------------------------
// Asegurarse que las respuestas a /uploads contengan Access-Control-Allow-Origin.
// Usamos un middleware específico antes de express.static para fijar headers.
// Además, express.static puede usar setHeaders para respuesta final.
const uploadsPath = path.join(__dirname, '..', 'uploads');
app.use(
  '/uploads',
  (req, res, next) => {
    const origin = req.headers.origin;
    setCorsHeadersForOrigin(res, origin);
    next();
  },
  express.static(uploadsPath, {
    // Añadir un header por si algunas infra no respetan el middleware anterior
    setHeaders: (res, _filePath, _stat) => {
      // No sobrescribimos si ya se estableció un Access-Control-Allow-Origin
      // (el middleware anterior para /uploads lo puede fijar a un origen concreto).
      if (!res.getHeader('Access-Control-Allow-Origin')) {
        // Fallback permissive header para infra que no ejecuten el middleware anterior
        res.setHeader('Access-Control-Allow-Origin', '*');
      }
    },
  })
);

// --- 6) Manejo rutas no encontradas ----------------------------------------
app.use((req, res, next) => {
  next(createError(404, 'No encontrado'));
});

// --- 7) Middleware de errores centralizado ---------------------------------
// Este middleware se asegura de devolver headers CORS incluso en errores,
// y de producir mensajes de error amigables para problemas de multipart/form-data.
app.use((err, req, res, next) => {
  try {
    const origin = req.headers.origin;
    setCorsHeadersForOrigin(res, origin);

    const contentType = String(req.headers['content-type'] || '');
    // Detectar errores de parseo que pueden venir de body-parser intentando
    // parsear un multipart mal formado como JSON
    if (err instanceof SyntaxError && /Unexpected token/.test(String(err.message))) {
      if (contentType.includes('multipart/form-data') || /----/.test(String(err.message))) {
        console.error(
          'Body parse error likely due to multipart payload with incorrect Content-Type header'
        );
        return res.status(400).json({
          error:
            'Invalid request body: parece que se envió un multipart/form-data pero el Content-Type es incorrecto. Cuando uses FormData NO pongas manualmente el header Content-Type; deja que el navegador lo añada con el boundary.',
          code: 400,
        });
      }
    }

    // Log completo (truncate body to avoid leaks)
    console.error('Unhandled error in request', {
      method: req.method,
      url: req.originalUrl || req.url,
      body: req.body ? (JSON.stringify(req.body).slice(0, 200) + (JSON.stringify(req.body).length > 200 ? '... (truncated)' : '')) : undefined,
      err: err && err.stack ? err.stack : err,
    });
  } catch (e) {
    console.error('Error while logging error', e);
  }

  res.status(err.status || 500).json({
    error: err.message || 'Error interno',
    code: err.status || 500,
  });
});

// Start server
const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log(`API running on http://localhost:${port} (docs at /docs)`);
});