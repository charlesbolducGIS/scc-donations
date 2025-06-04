/**
 * SCC Donation App Backend
 * - Serves static files and handles BBMS Payments API calls.
 * - Handles OAuth 2.0 Authorization Code flow and refresh token storage.
 */

require('dotenv').config();
const express = require('express');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const querystring = require('querystring');

const app = express();
const port = process.env.PORT || 3000;

// Environment/config variables
const {
  appID,
  appSecret,
  payAPIkey,
  tokenURL,
  authURL,
  redirectURL
} = process.env;

// Store token and expiry in memory (for production, use a file or DB if needed)
let accessToken = null;
let tokenExpiresAt = 0;

// Path to store refresh token (for demo, use a file; for production, use secure storage)
const REFRESH_TOKEN_PATH = path.join(__dirname, 'refresh_token.txt');

// Helper to read/write refresh token
function saveRefreshToken(token) {
  fs.writeFileSync(REFRESH_TOKEN_PATH, token, 'utf8');
}
function loadRefreshToken() {
  if (fs.existsSync(REFRESH_TOKEN_PATH)) {
    return fs.readFileSync(REFRESH_TOKEN_PATH, 'utf8');
  }
  return null;
}

// Helper to get a valid access token using Authorization Code or Refresh Token
async function getAccessToken() {
  const now = Date.now();
  if (accessToken && tokenExpiresAt > now + 60000) {
    return accessToken;
  }

  // Try to use refresh token if available
  const refreshToken = loadRefreshToken();
  if (refreshToken) {
    try {
      const response = await axios.post(
        tokenURL,
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: appID,
          client_secret: appSecret,
        }),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );
      accessToken = response.data.access_token;
      tokenExpiresAt = now + response.data.expires_in * 1000;
      if (response.data.refresh_token) {
        saveRefreshToken(response.data.refresh_token);
      }
      return accessToken;
    } catch (err) {
      console.error('Failed to refresh access token:', err.response?.data || err.message);
      // If refresh fails, fall through to require re-auth
    }
  }
  throw new Error('No valid refresh token. Please (re)authorize the application.');
}

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// Payment transaction endpoint
app.post('/api/payments/v1/checkout/transaction', async (req, res) => {
  const transactionToken = req.body?.transactionToken;
  if (!transactionToken) {
    return res.status(400).json({ error: 'Missing transactionToken' });
  }

  try {
    const token = await getAccessToken();
    const response = await axios.post(
      'https://api.sky.blackbaud.com/payments/v1/checkout/transaction',
      { transaction_token: transactionToken },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Bb-Api-Subscription-Key': payAPIkey,
          'Content-Type': 'application/json',
        },
      }
    );
    res.json(response.data);
  } catch (err) {
    console.error('Error completing checkout:', err.response?.data || err.message);
    res.status(500).json({ error: 'Error completing checkout', details: err.response?.data || err.message });
  }
});

// Admin login endpoint: redirect to Blackbaud for authorization
app.get('/auth/login', (req, res) => {
  const params = querystring.stringify({
    response_type: 'code',
    client_id: appID,
    redirect_uri: redirectURL,
    scope: 'payments',
    state: 'scc_auth_state'
  });
  res.redirect(`${authURL}?${params}`);
});

// OAuth2 callback endpoint: exchange code for tokens and store refresh token
app.get('/auth/callback', async (req, res) => {
  const { code, state, error } = req.query;
  if (error) {
    return res.status(400).send(`Authorization error: ${error}`);
  }
  if (!code || state !== 'scc_auth_state') {
    return res.status(400).send('Invalid authorization response.');
  }
  try {
    const response = await axios.post(
      tokenURL,
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectURL,
        client_id: appID,
        client_secret: appSecret,
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    accessToken = response.data.access_token;
    tokenExpiresAt = Date.now() + response.data.expires_in * 1000;
    if (response.data.refresh_token) {
      saveRefreshToken(response.data.refresh_token);
    }
    res.send('Authorization successful! You may now close this window.');
  } catch (err) {
    console.error('Failed to exchange code for tokens:', err.response?.data || err.message);
    res.status(500).send('Failed to exchange code for tokens.');
  }
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});