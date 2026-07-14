process.env.NETLIFY = 'true';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../server/.env') });

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = process.env.NETLIFY_JWT_SECRET || 'framecut-netlify-prod-jwt-2026-secure-key';
}

if (!process.env.ADMIN_EMAIL) {
  process.env.ADMIN_EMAIL = 'jlet9lra123321@gmail.com';
}

const serverless = require('serverless-http');
const app = require('../../server/app');

exports.handler = serverless(app);