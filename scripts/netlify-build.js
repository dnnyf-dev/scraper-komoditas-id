const fs = require('fs');
const path = require('path');

const apiBase = String(process.env.API_BASE_URL || '').trim().replace(/\/$/, '');
if (!apiBase) {
  throw new Error('API_BASE_URL belum diisi di Netlify (Site configuration > Environment variables).');
}

const config = `window.KOMODITAS_API_BASE = ${JSON.stringify(apiBase + '/api')};\n`;
const target = path.join(__dirname, '..', 'frontend', 'js', 'runtime-config.js');
fs.writeFileSync(target, config, 'utf8');
console.log(`Generated ${target} -> ${apiBase}/api`);
