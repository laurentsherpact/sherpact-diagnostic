const { getStore } = require('@netlify/blobs');

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { email } = JSON.parse(event.body);
    if (!email) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing email' }) };

    const store = getStore({ name: 'email-counters', siteID: process.env.SITE_ID, token: process.env.NETLIFY_TOKEN });
    const key = email.toLowerCase().trim();

    const raw = await store.get(key);
    const entry = raw ? JSON.parse(raw) : null;

    if (entry?.state === 'in_progress') {
      return { statusCode: 200, headers, body: JSON.stringify({ allowed: false, reason: 'in_progress' }) };
    }
    if ((entry?.count || 0) >= 2) {
      return { statusCode: 200, headers, body: JSON.stringify({ allowed: false, reason: 'done', count: entry.count }) };
    }

    return { statusCode: 200, headers, body: JSON.stringify({ allowed: true }) };
  } catch (err) {
    console.error('check-email error:', err);
    return { statusCode: 200, headers, body: JSON.stringify({ allowed: true }) };
  }
};
