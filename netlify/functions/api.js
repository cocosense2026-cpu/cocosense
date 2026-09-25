// Wraps the SAME Express app used by `npm run server` / Render, so
// every route in server/routes/*.js works here unchanged. This is one
// Netlify Function handling all of /api/* -- not one function per
// route -- which keeps the existing Express routing, middleware
// (express-async-errors, the CORS header block, the JSON body parser)
// and error handler exactly as they are.
//
// Path note: netlify.toml redirects "/api/*" to
// "/.netlify/functions/api/api/:splat" (the "/api" appears twice on
// purpose -- see the comment there). Netlify hands this function the
// FULL rewritten path, so `basePath` below strips just the
// "/.netlify/functions/api" part, leaving "/api/:splat" -- exactly what
// server/index.js's `app.use('/api', ...)` mounts already expect.
import serverless from 'serverless-http';
import { app } from '../../server/index.js';

export const handler = serverless(app, {
  basePath: '/.netlify/functions/api',
});
