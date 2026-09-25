// Loads server/.env by absolute path instead of relying on dotenv's
// default cwd-relative lookup (which only finds .env when Node happens
// to be launched from the project root). Must be the FIRST import in
// index.js -- in ES modules all imports are evaluated before any other
// top-level code runs, so this has to be its own module to guarantee
// it runs before db.js (or anything else) reads process.env.
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });
