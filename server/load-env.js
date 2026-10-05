// Loads server/.env by absolute path instead of relying on dotenv's
// default cwd-relative lookup (which only finds .env when Node happens
// to be launched from the project root). Must be the FIRST import in
// index.js -- in ES modules all imports are evaluated before any other
// top-level code runs, so this has to be its own module to guarantee
// it runs before db.js (or anything else) reads process.env.
//
// Netlify bundles the function with esbuild as CommonJS, where
// `import.meta.url` is empty -- calling fileURLToPath() on it throws at
// cold start and every request returns 502. db.js uses the same
// `typeof __dirname` guard for the same reason. On Netlify the values
// come from the site's environment variables, so a missing .env file
// is fine and must never crash the function.
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

try {
  const here =
    typeof __dirname !== 'undefined'
      ? __dirname
      : path.dirname(fileURLToPath(import.meta.url));
  dotenv.config({ path: path.join(here, '.env') });
} catch {
  // No resolvable location (bundled build) -- rely on real env vars.
}
