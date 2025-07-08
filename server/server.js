/**
 * SCC Donation App Backend
 * - Serves static files and handles BBMS Payments API calls.
 * - Handles OAuth 2.0 Authorization Code flow and refresh token storage.
 */

require("dotenv").config();
const express = require("express");
const axios = require("axios");
const path = require("path");
const fs = require("fs");
const querystring = require("querystring");

const app = express();
const port = process.env.PORT || 3000;

// Environment/config variables
const { appID, appSecret, payAPIkey, tokenURL, authURL, redirectURL } =
  process.env;

// Store token and expiry in memory (for production, use a file or DB if needed)
let accessToken = null;
let tokenExpiresAt = 0;

// Path to store refresh token (for demo, use a file; for production, use secure storage)
const REFRESH_TOKEN_PATH = path.join(__dirname, "refresh_token.txt");

// Helper to read/write refresh token
function saveRefreshToken(token) {
  try {
    fs.writeFileSync(REFRESH_TOKEN_PATH, token, "utf8");
    console.log("Refresh token successfully saved to file."); // Log success
  } catch (error) {
    console.error("Error saving refresh token to file:", error.message); // Log error
  }
}

function loadRefreshToken() {
  try {
    if (fs.existsSync(REFRESH_TOKEN_PATH)) {
      const token = fs.readFileSync(REFRESH_TOKEN_PATH, "utf8");
      console.log("Refresh token successfully loaded from file."); // Log success
      return token;
    }
  } catch (error) {
    console.error("Error loading refresh token from file:", error.message); // Log error
  }
  console.log("No refresh token file found or could not be loaded."); // Log if not found
  return null;
}

// Helper to get a valid access token using Authorization Code or Refresh Token
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
      console.log(
        "Access token obtained via refresh. Expires in:",
        response.data.expires_in,
        "seconds"
      );
      // Update refresh token if a new one is provided (optional, but good practice)
      if (
        response.data.refresh_token &&
        response.data.refresh_token !== currentRefreshToken
      ) {
        saveRefreshToken(response.data.refresh_token);
        console.log("New refresh token saved during refresh process.");
      }
      return accessToken;
    } catch (error) {
      console.error(
        "Failed to refresh access token:",
        error.response?.data || error.message
      );
      // If refresh fails, clear invalid token and throw error to prompt re-auth
      accessToken = null;
      tokenExpiresAt = 0;
      throw new Error(
        "Failed to refresh access token. Please (re)authorize the application."
      );
    }
  } else {
    console.log("No refresh token found. Initial authorization required.");
    throw new Error(
      "No valid refresh token. Please (re)authorize the application."
    );
  }
}

app.use(express.json());
// Serve static files from the 'public' directory, which is one level up from 'server'
app.use(express.static(path.join(__dirname, "..", "public")));

// Payment transaction endpoint
app.post("/api/payments/v1/checkout/transaction", async (req, res) => {
  const transactionToken = req.body?.transactionToken;
  const amount = req.body?.amount;

  if (!transactionToken) {
    console.error("Transaction token is missing in request body."); // Log missing token
    return res.status(400).json({ error: "Missing transactionToken" });
  }
  if (!amount) {
    console.error("Amount is missing in request body."); // Log missing amount
    return res.status(400).json({ error: "Missing amount" });
  }

  try {
    const token = await getAccessToken();
    console.log(
      "Access token retrieved for transaction:",
      token ? "Exists" : "Does NOT exist"
    );
    // Log first few characters of token for verification, but not the full token for security
    console.log(
      "Making request to Blackbaud Payments API with token starting with:",
      token ? token.substring(0, 10) + "..." : "N/A"
    );

    const response = await axios.post(
      "https://api.sky.blackbaud.com/payments/v1/checkout/transaction",
      {
        transaction_token: transactionToken,
        amount: parseFloat(amount), // Ensure amount is a number
      },
      {
        headers: {
          Authorization: `Bearer ${token}`, // Use the retrieved token
          "Bb-Api-Subscription-Key": payAPIkey,
          "Content-Type": "application/json",
        },
      }
    );
    console.log("Blackbaud transaction successful:", response.data); // Log successful response
    res.json(response.data);
  } catch (err) {
    console.error(
      "Error completing checkout:",
      err.response?.data || err.message
    );
    res
      .status(500)
      .json({
        error: "Error completing checkout",
        details: err.response?.data || err.message,
      });
  }
});

// Admin login endpoint: redirect to Blackbaud for authorization
app.get("/auth/login", (req, res) => {
  console.log(
    "Received request for /auth/login. Redirecting to Blackbaud for authorization."
  ); // Log request
  const params = querystring.stringify({
    response_type: "code",
    client_id: appID,
    redirect_uri: redirectURL,
    scope: "payments",
    state: "scc_auth_state",
  });
  res.redirect(`${authURL}?${params}`);
});

// OAuth2 callback endpoint: exchange code for tokens and store refresh token
app.get("/auth/callback", async (req, res) => {
  console.log("Received callback from Blackbaud."); // Log callback
  const { code, state, error } = req.query;

  if (error) {
    console.error("Authorization error received in callback:", error); // Log error from Blackbaud
    return res.status(400).send(`Authorization error: ${error}`);
  }
  if (!code || state !== "scc_auth_state") {
    console.error(
      "Invalid authorization response: Missing code or state mismatch."
    ); // Log invalid response
    return res.status(400).send("Invalid authorization response.");
  }

  try {
    console.log("Attempting to exchange authorization code for tokens..."); // Log attempt
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
    console.log(
      "Initial access token obtained. Expires in:",
      response.data.expires_in,
      "seconds"
    );
    if (response.data.refresh_token) {
      saveRefreshToken(response.data.refresh_token);
      console.log("Refresh token saved during initial authorization callback.");
    }
    res.send("Authorization successful! You may now close this window.");
  } catch (err) {
    console.error(
      "Error during initial authorization callback:",
      err.response?.data || err.message
    );
    res.status(500).send("Authorization failed.");
  }
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});