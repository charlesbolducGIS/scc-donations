/**
 * SCC Donation App Backend
 * - Serves static files and handles Blackbaud Merchant Services (BBMS) Payments API calls.
 * - Implements OAuth 2.0 Authorization Code flow for secure API access.
 * - Stores and retrieves refresh tokens securely using Upstash Redis (Vercel KV).
 */

require("dotenv").config();
const express = require("express");
const axios = require("axios");
const path = require("path");
const querystring = require("querystring");

// Import Upstash Redis SDK
const { Redis } = require("@upstash/redis");

// Initialize Upstash Redis client
// Redis.fromEnv() automatically picks up KV_URL, KV_REST_API_URL, KV_REST_API_TOKEN from Vercel environment variables.
const redis = Redis.fromEnv();

const app = express();
const port = process.env.PORT || 3000;

// Environment/config variables loaded from .env file
const { appID, appSecret, payAPIkey, tokenURL, authURL, redirectURL } =
  process.env;

// In-memory storage for the OAuth access token and its expiry.
// This is still used for the current request cycle to avoid repeated KV reads.
let accessToken = null;
let tokenExpiresAt = 0;

// Define a fixed key for storing the app's single refresh token in Upstash Redis.
const REFRESH_TOKEN_KEY = "bbms_refresh_token";

/**
 * Saves the refresh token to Upstash Redis.
 * @param {string} token - The refresh token to save.
 */
async function saveRefreshToken(token) {
  try {
    // Set the token with no expiry (or a very long one if desired)
    await redis.set(REFRESH_TOKEN_KEY, token);
    console.log("Refresh token successfully saved to Upstash Redis.");
  } catch (error) {
    console.error(
      "Error saving refresh token to Upstash Redis:",
      error.message
    );
  }
}

/**
 * Loads the refresh token from Upstash Redis.
 * @returns {Promise<string|null>} The loaded refresh token, or null if not found/error.
 */
async function loadRefreshToken() {
  try {
    const token = await redis.get(REFRESH_TOKEN_KEY);
    if (token) {
      console.log("Refresh token successfully loaded from Upstash Redis.");
      return token;
    }
  } catch (error) {
    console.error(
      "Error loading refresh token from Upstash Redis:",
      error.message
    );
  }
  return null; // Return null if not found or error
}

/**
 * Retrieves a valid Blackbaud OAuth access token.
 * Prioritizes using an existing, non-expired token.
 * If expired, attempts to refresh using the stored refresh token from Upstash Redis.
 * If no refresh token or refresh fails, throws an error prompting re-authorization.
 * @returns {Promise<string>} The valid access token.
 * @throws {Error} If no valid token can be obtained.
 */
async function getAccessToken() {
  const now = Date.now();
  // Check if existing token is valid for at least 1 minute to avoid expiry during use
  if (accessToken && tokenExpiresAt > now + 60000) {
    console.log("Using existing, non-expired access token.");
    return accessToken;
  }

  console.log("Attempting to get new access token...");

  let currentRefreshToken = await loadRefreshToken(); // AWAIT the async call
  if (currentRefreshToken) {
    console.log("Refresh token found. Attempting to refresh access token.");
    try {
      const response = await axios.post(
        tokenURL,
        new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: currentRefreshToken,
          client_id: appID,
          client_secret: appSecret,
        }),
        { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
      );
      accessToken = response.data.access_token;
      tokenExpiresAt = Date.now() + response.data.expires_in * 1000;
      console.log("Access token obtained via refresh.");
      // Update refresh token if a new one is provided (optional, but good practice)
      if (
        response.data.refresh_token &&
        response.data.refresh_token !== currentRefreshToken
      ) {
        await saveRefreshToken(response.data.refresh_token); // AWAIT the async call
      }
      return accessToken;
    } catch (error) {
      console.error(
        "Failed to refresh access token:",
        error.response?.data || error.message
      );
      accessToken = null; // Clear invalid token
      tokenExpiresAt = 0;
      throw new Error(
        "Failed to refresh access token. Please (re)authorize the application."
      );
    }
  } else {
    console.error("No refresh token found. Initial authorization required.");
    throw new Error(
      "No valid refresh token. Please (re)authorize the application."
    );
  }
}

app.use(express.json());
// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, "..", "public")));

/**
 * Endpoint to provide frontend configuration based on Vercel environment.
 * This allows the frontend to dynamically load Blackbaud public key and payment config.
 * It also provides the current Vercel environment for display purposes.
 */
app.get("/api/config", (req, res) => {
  const environment = process.env.VERCEL_ENV || "development"; // 'development' for local runs
  const isProduction = environment === "production";

  const publicKey = process.env.BB_PUBLIC_KEY;
  const paymentConfig = process.env.BB_PAYMENT_CONFIG; // Vercel's scoping handles PROD vs TEST value

  console.log('Config request received:', {
    environment,
    isProduction,
    hasPublicKey: !!publicKey,
    hasPaymentConfig: !!paymentConfig,
    requestHeaders: req.headers
  });

  if (!publicKey || !paymentConfig) {
    console.error(`Missing Blackbaud config for VERCEL_ENV: ${environment}`, {
      publicKey: !!publicKey,
      paymentConfig: !!paymentConfig
    });
    return res.status(500).json({
      error: "Missing Blackbaud configuration.",
      environment
    });
  }

  const config = { publicKey, paymentConfig, environment };
  console.log("Sending config to frontend:", {
    ...config,
    publicKeyLength: publicKey.length,
    paymentConfigLength: paymentConfig.length
  });

  res.json(config);
});

/**
 * Handles the POST request for processing a Blackbaud Checkout transaction.
 * Receives transactionToken and amount from the frontend, then calls Blackbaud Payments API.
 */
app.post("/api/payments/v1/checkout/transaction", async (req, res) => {
  const transactionToken = req.body?.transactionToken;
  let amount = req.body?.amount; // Use 'let' as amount will be modified

  if (!transactionToken) {
    console.error("Error: Missing transactionToken in request body.");
    return res.status(400).json({ error: "Missing transactionToken" });
  }
  if (!amount) {
    console.error("Error: Missing amount in request body.");
    return res.status(400).json({ error: "Missing amount" });
  }

  try {
    const token = await getAccessToken(); // Get the OAuth Bearer token

    // Convert amount from dollars (string/float) to cents (integer) as required by Blackbaud API
    amount = Math.round(parseFloat(amount) * 100);
    console.log(
      `Processing transaction: Amount ${amount} cents, Token: ${transactionToken.substring(
        0,
        8
      )}...`
    );

    const response = await axios.post(
      "https://api.sky.blackbaud.com/payments/v1/checkout/transaction",
      {
        authorization_token: transactionToken, // This is the token from Blackbaud Checkout
        amount: amount,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`, // OAuth Bearer token for API authentication
          "Bb-Api-Subscription-Key": payAPIkey, // Your Payments API subscription key
          "Content-Type": "application/json",
        },
      }
    );
    console.log("Blackbaud transaction successfully processed.");
    res.json(response.data); // Send Blackbaud's full response data back to the frontend
  } catch (err) {
    console.error(
      "Error completing checkout transaction:",
      err.response?.data || err.message
    );
    // Provide a generic error message to the frontend, avoid exposing raw API errors
    res.status(500).json({
      error: "An error occurred while processing your donation.",
      details: "Please try again or contact support.", // More user-friendly detail
    });
  }
});

/**
 * Initiates the Blackbaud OAuth authorization flow.
 * Redirects the user's browser to Blackbaud's login/authorization page.
 */
app.get("/auth/login", (req, res) => {
  console.log("Initiating Blackbaud OAuth authorization flow.");
  const params = querystring.stringify({
    response_type: "code",
    client_id: appID,
    redirect_uri: redirectURL,
    scope: "payments", // Requesting 'payments' scope
    state: "scc_auth_state", // State parameter for CSRF protection
  });
  res.redirect(`${authURL}?${params}`);
});

/**
 * Blackbaud OAuth callback endpoint.
 * Exchanges the authorization code for access and refresh tokens.
 * Stores the refresh token for future use.
 */
app.get("/auth/callback", async (req, res) => {
  console.log("Received OAuth callback from Blackbaud.");
  const { code, state, error } = req.query;

  if (error) {
    console.error("OAuth callback error:", error);
    return res.status(400).send(`Authorization error: ${error}`);
  }
  if (!code || state !== "scc_auth_state") {
    console.error("Invalid OAuth callback: Missing code or state mismatch.");
    return res.status(400).send("Invalid authorization response.");
  }

  try {
    console.log("Exchanging authorization code for tokens...");
    const response = await axios.post(
      tokenURL,
      new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectURL,
        client_id: appID,
        client_secret: appSecret,
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );
    accessToken = response.data.access_token;
    tokenExpiresAt = Date.now() + response.data.expires_in * 1000;
    console.log("Initial access token obtained successfully.");
    if (response.data.refresh_token) {
      await saveRefreshToken(response.data.refresh_token); // AWAIT the async call
    }
    res.send("Authorization successful! You may now close this window.");
  } catch (err) {
    console.error(
      "Error during initial OAuth authorization callback:",
      err.response?.data || err.message
    );
    res.status(500).send("Authorization failed.");
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});