# SCC Donations System Overview

## Components

1. **Frontend (CivicPlus Website)**
    * **Purpose:** User interface for initiating donations.
    * **Technologies:** HTML, JavaScript, Tailwind CSS (for styling).
    * **Key Integration:** Leverages the **Blackbaud Checkout JavaScript SDK** to securely capture payment information via an embedded iframe and generate a `transactionToken` (no sensitive credit card data touches the frontend).
    * **Hosting:** Hosted by CivicPlus (on CloudFlare).

2. **Backend (Node.js Server)**
    * **Purpose:** Securely manages communication with Blackbaud SKY API to authorize and process payments, and provides dynamic frontend configuration.
    * **Technologies:** Node.js, Express.js, Axios, Upstash Redis (@upstash/redis SDK).
    * **Hosting Location:** Vercel (serverless functions).
    * **Key Responsibilities:**
        * Manages **OAuth access tokens** and **refresh tokens** for continuous, headless API access, with refresh tokens securely stored in Upstash Redis (Vercel KV).
        * Receives the `transactionToken` from the frontend.
        * Initiates the final payment processing API call to Blackbaud Merchant Services (BBMS) using the `transactionToken` and its securely stored OAuth tokens.
        * Serves Blackbaud `publicKey` and `paymentConfig` dynamically to the frontend based on the deployment environment (Production/Preview) via the `/api/config` endpoint.
        * **Crucially**, no sensitive credit card data is ever stored or processed directly by this server **(PCI compliance via tokenization).**

## System Flow (High-Level)

1. **User Interaction:** Donor enters donation amount on the Frontend (CivicPlus Website).
2. **Config Fetch:** Frontend makes a request to the Backend's `/api/config` endpoint to retrieve environment-appropriate Blackbaud `publicKey` and `paymentConfig`.
3. **Checkout Form:** Blackbaud Checkout SDK loads a secure payment iframe for card details.
4. **Token Generation:** Upon successful card entry, Blackbaud generates a `transactionToken` and sends it back to the Frontend.
5. **Server Communication:** The Frontend sends this `transactionToken` to the Backend (Node.js serverless function on Vercel).
6. **Payment Processing:** The Backend uses its securely managed OAuth tokens (retrieved from Upstash Redis if needed) and the `transactionToken` to call the BBMS API and complete the donation.
7. **Confirmation:** Backend sends a response back to the Frontend (e.g., success/failure).

## Maintenance Requirements

1. **Server Monitoring**
    * Monitor Vercel deployment health and serverless function invocations.
    * Monitor application logs (accessible via Vercel Dashboard) for errors or unusual activity.
    * Monitor API call success/failure rates.

2. **Credentials & Token Management**
    * Securely store Blackbaud API credentials (including environment-specific `BB_PUBLIC_KEY` and `BB_PAYMENT_CONFIG`) as **Vercel Environment Variables**.
    * The **Upstash Redis (Vercel KV)** instance will securely store and manage the OAuth refresh token.
    * Implement a strategy for **refreshing OAuth access tokens** automatically before they expire (already handled by `server.js`).
    * Plan for annual API key rotation (client ID/secret) as a security best practice.
    * Maintain Blackbaud organizational authentication for manual authorization/re-authorization when necessary (e.g., initial setup, major scope changes, refresh token invalidation).

3. **Regular Updates**
    * Apply Node.js security updates.
    * Regularly update npm packages (including `@upstash/redis`, `axios`, `express`) to patch vulnerabilities and leverage improvements.
    * Monitor Vercel platform updates and Upstash Redis service announcements.
    * Monitor Blackbaud API updates and deprecations.