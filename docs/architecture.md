# SCC Donations System Overview

## Components

1.  **Frontend (CivicPlus Website)**
    * **Purpose:** User interface for initiating donations.
    * **Technologies:** HTML, JavaScript.
    * **Key Integration:** Leverages the **Blackbaud Checkout JavaScript SDK** to securely capture payment information via an embedded iframe and generate a `transactionToken` (no sensitive credit card data touches our frontend).
    * **Hosting:** Hosted by CivicPlus (on CloudFlare).

2.  **Backend (Node.js Server)**
    * **Purpose:** Securely manages communication with Blackbaud SKY API to authorize and process payments.
    * **Technologies:** Node.js, Express.js (or similar framework).
    * **Hosting Location:** [location TBD - e.g., "CivicPlus managed secure server," "Azure App Service," etc.]
    * **Key Responsibilities:**
        * Manages **OAuth access tokens and refresh tokens** for continuous, headless API access.
        * Receives the `transactionToken` from the frontend.
        * Initiates the final payment processing API call to Blackbaud Merchant Services (BBMS) using the `transactionToken` and its securely stored OAuth tokens.
        * **Crucially, no sensitive credit card data is ever stored or processed directly by this server (PCI compliance via tokenization).**

## System Flow (High-Level)

1.  **User Interaction:** Donor enters donation amount on the Frontend (CivicPlus Website).
2.  **Checkout Form:** Blackbaud Checkout SDK loads a secure payment iframe for card details.
3.  **Token Generation:** Upon successful card entry, Blackbaud generates a `transactionToken` and sends it back to our Frontend.
4.  **Server Communication:** The Frontend sends this `transactionToken` to our Backend (Node.js server).
5.  **Payment Processing:** The Backend uses its securely managed OAuth tokens and the `transactionToken` to call the BBMS API and complete the donation.
6.  **Confirmation:** Backend sends a response back to the Frontend (e.g., success/failure).

## Maintenance Requirements

1.  **Server Monitoring**
    * Check server health and availability.
    * Monitor application logs for errors or unusual activity.
    * Monitor API call success/failure rates.

2.  **Credentials & Token Management**
    * Securely store `.env` file (or equivalent environment variables) on the server.
    * Implement a strategy for **refreshing OAuth access tokens** automatically before they expire.
    * Ensure **refresh tokens are securely stored and handled** (e.g., encrypted at rest, rotated periodically).
    * Plan for annual API key rotation (client ID/secret) as a security best practice.
    * Maintain Blackbaud organizational authentication for manual authorization/re-authorization when necessary (e.g., initial setup, major scope changes, refresh token invalidation).

3.  **Regular Updates**
    * Apply Node.js security updates.
    * Regularly update npm packages to patch vulnerabilities and leverage improvements.
    * Ensure SSL/TLS certificate renewal for the production server (managed by CivicPlus/CloudFlare).
    * Monitor Blackbaud API updates and deprecations.