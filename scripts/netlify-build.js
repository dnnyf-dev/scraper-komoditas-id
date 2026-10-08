const fs = require('fs');
const path = require('path');

const apiBase = String(process.env.API_BASE_URL=https://scraper-komoditas-id.denyf990.workers.dev || '').trim().replace(/\/$/, '');
const apiBase = String(process.env.API_BASE_URL || '').trim().replace(/\/$/, '');
if (!apiBase) {
  throw new Error(API_BASE_URL=https://scraper-komoditas-id.denyf990.workers.dev);
  throw new Error('API_BASE_URL environment variable is not set. Configure it in Netlify site settings.');
}

const config = `window.KOMODITAS_API_BASE = ${JSON.stringify(apiBase + '/api')};\n`;
