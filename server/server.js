/**
 * SCC Donation App Backend
 * - Serves static files and handles Blackbaud Merchant Services (BBMS) Payments API calls.
 * - Implements OAuth 2.0 Authorization Code flow for secure API access and refresh token storage.
 */

require("dotenv").config();
const express = require("express");
const axios = require("axios");
const path = require("path");
const fs = require("fs"); // Using synchronous FS for simplicity in this demo/dev setup
const querystring = require("querystring");

const app = express();
const port = process.env.PORT || 3000;

// Environment/config variables loaded from .env file
const { appID, appSecret, payAPIkey, tokenURL, authURL, redirectURL } =
  process.env;

// In-memory storage for the OAuth access token and its expiry.
// For production, this should be replaced with a secure, persistent storage mechanism (e.g., encrypted database).
let accessToken = null;
let tokenExpiresAt = 0;

// Path to store the refresh token.
// IMPORTANT: For production, this file should NOT be used.
// A secure database or cloud secrets manager is required.
const REFRESH_TOKEN_PATH = path.join(__dirname, "refresh_token.txt");

/**
 * Saves the refresh token to a local file.
 * In a production environment, this should be stored securely (e.g., encrypted in a database).
 * @param {string} token - The refresh token to save.
 */
function saveRefreshToken(token) {
  try {
    fs.writeFileSync(REFRESH_TOKEN_PATH, token, "utf8");
    console.log("Refresh token successfully saved to file.");
  } catch (error) {
    console.error("Error saving refresh token to file:", error.message);
  }
}

/**
 * Loads the refresh token from a local file.
 * @returns {string|null} The loaded refresh token, or null if not found/error.
 */
function loadRefreshToken() {
  try {
    if (fs.existsSync(REFRESH_TOKEN_PATH)) {
      const token = fs.readFileSync(REFRESH_TOKEN_PATH, "utf8");
      console.log("Refresh token successfully loaded from file.");
      return token;
    }
  } catch (error) {
    console.error("Error loading refresh token from file:", error.message);
  }
  return null; // Return null if file not found or error
}

/**
 * Retrieves a valid Blackbaud OAuth access token.
 * Prioritizes using an existing, non-expired token.
 * If expired, attempts to refresh using the stored refresh token.
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

  let currentRefreshToken = loadRefreshToken();
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
        saveRefreshToken(response.data.refresh_token);
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

// Middleware to parse JSON request bodies
app.use(express.json());
// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, "..", "public")));

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
    res.json(response.data); // Send Blackbaud's response back to the frontend
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
      saveRefreshToken(response.data.refresh_token);
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