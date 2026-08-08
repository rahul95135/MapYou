const { getStore } = require('@netlify/blobs');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Keep well under Netlify's synchronous function payload limit —
// base64 encoding inflates file size by ~33%, so cap the raw file conservatively.
const MAX_BYTES = 4 * 1024 * 1024; // 4MB

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'];

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const data = JSON.parse(event.body || '{}');
    const filename = String(data.filename || 'slip').slice(0, 120);
    const mimeType = String(data.mimeType || 'application/octet-stream');
    const base64 = String(data.data || '');

    if (!base64) {
      return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'No file data received.' }) };
    }
    if (!ALLOWED_TYPES.includes(mimeType)) {
      return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Only JPG, PNG, or PDF files are accepted.' }) };
    }

    const buffer = Buffer.from(base64, 'base64');
    if (buffer.length > MAX_BYTES) {
      return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'File is too large — please keep it under 4MB.' }) };
    }

    const store = getStore('payment-slips');
    const extMatch = filename.match(/\.([a-zA-Z0-9]+)$/);
    const ext = extMatch ? extMatch[1] : 'bin';
    const key = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    await store.set(key, buffer, { metadata: { mimeType, originalName: filename } });

    const site = process.env.URL || 'https://mapyou.netlify.app';
    const url = `${site}/api/get-payment-slip?key=${encodeURIComponent(key)}`;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      body: JSON.stringify({ success: true, url, key }),
    };
  } catch (err) {
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Upload failed. Please try again.' }) };
  }
};
