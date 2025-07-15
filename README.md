# SCC Donations

This application enables the Sutton Conservation Commission (SCC) to accept donations using Blackbaud Checkout and the Blackbaud Payments API.

---

## How it Works

- The frontend (`public/index.html`) displays a donation form and uses the Blackbaud Checkout SDK to securely capture payment information.
- When a donation is completed via the Blackbaud iFrame, the frontend receives a `transactionToken` and the selected amount.
- The frontend sends this `transactionToken` and amount to the custom Node.js backend (`server/server.js`).
- The backend uses the Blackbaud OAuth 2.0 Authorization Code flow to obtain and manage an access token.
- Using this access token and the `transactionToken` (which acts as an `authorization_token` for the Payments API), the backend calls the Blackbaud Merchant Services (BBMS) Payments API to complete the transaction.
- Token refresh is handled automatically by the backend, with the refresh token securely stored in Upstash Redis (Vercel KV), ensuring continuous API access across serverless function invocations.
- Blackbaud `publicKey` and `paymentConfig` are dynamically provided to the frontend by the backend's `/api/config` endpoint, allowing easy switching between test and production environments via Vercel environment variables.
- The frontend dynamically displays the current deployment environment (e.g., "Preview Environment") for clarity during testing.

---

## Setup

1. **Clone the repository and install dependencies:**
    ```sh
    git clone https://github.com/charlesbolducGIS/scc-donations-dev.git
    cd sccDonationsDev
    npm install
    ```

2. **Configure your `.env` file for local development:**
    - Copy `.env.example` to `.env` and fill in your actual Blackbaud credentials.
    - For local testing, the `redirectURL` in your `.env` will typically point to `http://localhost:3000/auth/callback` or your Ngrok URL.
    - **Note:** Vercel deployment uses environment variables configured directly in the Vercel dashboard, not this local `.env` file.

3. **Vercel Configuration File (`vercel.json`):**
    - This project includes a `vercel.json` file in the root directory. This file is crucial for Vercel to correctly identify your `server/server.js` as a serverless function and `public/` as static assets.
    - No manual changes are needed to `vercel.json` for deployment.

---

## Local Development & Testing (Using Ngrok)

This section details how to run and test the application locally using Ngrok to simulate a public HTTPS environment for Blackbaud's OAuth flow.

>   **Note on Ngrok URLs:** Ngrok free tier URLs are dynamic and change each time you restart the Ngrok tunnel. You will need to update the `redirectURL` in your Blackbaud application settings and your local `.env` file accordingly for each new Ngrok session.

1. **Start the Backend Server:**
    ```sh
    cd server
    npm start
    ```
    Your server will start and listen on the port defined in your `.env` (e.g., 3000). Keep this terminal running.

2. **Ngrok Setup:**

    - Download and install [ngrok](`https://ngrok.com/`) for your system.
    - Authenticate Ngrok with your authtoken: `ngrok authtoken <YOUR_AUTH_TOKEN_HERE>`
    - Create a public HTTPS tunnel to your local backend:
        ```sh
        ngrok http 3000
        ```
    - Ngrok will provide a public HTTPS forwarding URL (e.g., `https://xxxx-xxxx-xxxx-xxxx.ngrok-free.app`). **Copy this URL.**

3. **Update Blackbaud Application Redirect URI (for Ngrok):**
    - Log in to your Blackbaud Developer account.
    - Go to your application's settings and find the "Redirect URIs" section.
    - **Add your Ngrok HTTPS forwarding URL** with the `/auth/callback` path (e.g., `https://xxxx-xxxx-xxxx-xxxx.ngrok-free.app/auth/callback`) to the list of allowed URIs.
    >   **Important:** Ngrok free tier URLs change each time you restart Ngrok. You will need to update this in Blackbaud *every time* you start a new Ngrok tunnel for testing.

4. **Update Local `.env` for Ngrok Testing:**
    - Temporarily change the `redirectURL` in your local `.env` file to match your current Ngrok HTTPS URL:
        ```
        redirectURL=https://xxxx-xxxx-xxxx-xxxx.ngrok-free.app/auth/callback
        ```
    - Save your `.env` file and **RESTART** your Node.js backend server (`Ctrl + C` then `npm start`) for the change to take effect.

5. **Initial Admin Authorization (Local Ngrok):**
    - Visit the authorization endpoint in your browser (using your current Ngrok URL):  
        `https://xxxx-xxxx-xxxx-xxxx.ngrok-free.app/auth/login`
    - Log in with your Blackbaud admin account and authorize the application.
    - After successful authorization, you will see a message:  
        _"Authorization successful! You may now close this window."_
    - The backend will now have obtained an access token and stored the refresh token in Upstash Redis (if connected locally, or in memory/file if not).

6. **Testing the Donation Flow (Local Ngrok):**
    - Open your browser and go to your Ngrok forwarding URL:
        `https://xxxx-xxxx-xxxx-xxxx.ngrok-free.app`
    - Select a donation amount and click **"Donate now!"**
    - The Blackbaud Checkout iFrame should appear. Use Blackbaud's provided test credit card numbers (e.g., Visa: `4242...4242`, Exp: `01/30`, CSC: `123`) to complete the transaction.
    - Observe the success message in the browser and check your Blackbaud Merchant Services (BBMS) account for the "Approved" transaction.

---

## Cloud Deployment (Vercel)

This section details how to deploy the application to Vercel for a stable, public hosting environment.

1. **Vercel Project Setup:**
    - Sign up for Vercel and connect your GitHub account: [vercel.com/signup](https://vercel.com/signup)
    - Import your `scc-donations-dev` GitHub repository as a new project in Vercel.
    >   **Crucial Setting:** In Vercel Project Settings, ensure the **"Root Directory" is left empty** (or set to `./`) so that Vercel correctly uses the `vercel.json` file to manage your serverless function and static assets.

2. **Connect Upstash Redis (Vercel KV):**
    - In your Vercel project dashboard, go to the **"Storage"** tab.
    - Click **"Connect Store"** or **"Create KV Database"** and choose **"Upstash for Redis"** from the Marketplace.
    - Follow the prompts to create a new Upstash Redis database (e.g., `scc-refresh-token-kv`) and connect it to your `scc-donations-dev` Vercel project.
    - Vercel will automatically add the necessary environment variables (`KV_URL`, `KV_REST_API_URL`, `KV_REST_API_TOKEN`, etc.) to your project's settings.

3. **Configure Vercel Environment Variables:**
    - Go to your Vercel Project **"Settings"** and then **"Environment Variables"**.
    - Add your Blackbaud API credentials (`appID`, `appSecret`, `payAPIkey`, `authURL`, `tokenURL`) here.
    - **Add/Configure Blackbaud `publicKey` and `paymentConfig` for each environment:**
        - **`BB_PUBLIC_KEY`**: Your universal Blackbaud Public Key.
            - **Scope:** All Environments.
        - **`BB_PAYMENT_CONFIG`**: Your Blackbaud Payment Configuration ID.
            - **Scope:** Set one for **Production** (with your production Config ID) and another for **Preview** (with your test Config ID). Vercel will automatically pick the correct one based on the deployment environment.
    - **Configure `redirectURL` for both Production and Preview environments:**
        - **Production:** `redirectURL` = `https://scc-donations-dev.vercel.app/auth/callback`
        - **Preview:** `redirectURL` = `https://scc-donations-dev-preview.vercel.app/auth/callback` (or the dynamic Vercel preview URL if you don't use a custom preview domain).
    - Ensure all these variables are set to apply to the correct environments (Development, Preview, Production).

4. **Update Blackbaud Application Redirect URIs (for Vercel):**
    - Log in to your Blackbaud Developer account.
    - Go to your application's settings and find the "Redirect URIs" section.
    - **Add both your Vercel Production and Preview `redirectURL`s** (e.g., `https://scc-donations-dev.vercel.app/auth/callback` and `https://scc-donations-dev-preview.vercel.app/auth/callback`) to the list.

5. **Initial Admin Authorization (Vercel Deployment):**
    - After Vercel has deployed your application (triggered by pushing changes to GitHub or updating environment variables), you need to perform the initial OAuth handshake on the deployed app.
    - Visit the authorization endpoint in your browser for your **Vercel domain**:
      `https://scc-donations-dev.vercel.app/auth/login` (for production)
      `https://scc-donations-dev-preview.vercel.app/auth/login` (for preview)
    - Log in with your Blackbaud admin account and authorize the application. This will securely store the refresh token in your connected Upstash Redis database.

6. **Testing the Donation Flow (Vercel Deployment):**
    - Open your browser and go to your Vercel application URL:
      `https://scc-donations-dev.vercel.app` (for production)
      `https://scc-donations-dev-preview.vercel.app` (for preview)
    - Select a donation amount and click **"Donate now!"**
    - Use Blackbaud's provided test credit card numbers to complete the transaction.
    - Verify the success message in the browser and confirm the "Approved" transaction in your BBMS account. This test should now consistently work due to persistent token storage.

---

## Production Deployment & Keys

- The application is ready for production deployment on Vercel.
- The Blackbaud `publicKey` and `paymentConfig` are dynamically loaded from the backend based on the Vercel environment (Production vs. Preview).
- To perform live transactions, ensure your Vercel Production environment variables (appID, appSecret, payAPIkey, BB_PUBLIC_KEY, BB_PAYMENT_CONFIG) are set to your production Blackbaud keys.
- Perform a small, real donation using a real credit card to verify the end-to-end live transaction.

---

## Apple Pay and Digital Wallets

To display Apple Pay, Apple requires you to host a file to validate merchant domains. The integrating application hosts this file at the root of the domain where you launch Blackbaud Checkout.

**Host Apple Pay file**
1. Download the zipped folder that contains the Apple Pay file that Blackbaud hosts: [Download Apple Pay file](https://sky.blackbaudcdn.net/static/payments-web-content/1/assets/apple-developer-merchantid-domain-association.zip)
2. Unzip the folder and host the Apple Pay file publicly in the domain where your organization launches its Blackbaud Checkout form. The complete file path should look like `[top-level domain]/.well-known/apple-developer-merchantid-domain-association`.
3. Repeat the previous step for any domains or subdomains where Apple Pay should appear. For example, the Apple Pay file path for `https://domainexample.com/donation/page.html` is `https://domainexample.com/.well-known/apple-developer-merchantid-domain-association`.

**No Code Changes Needed**
- Apple Pay is enabled in `/public/index.html` where the `transactionData` object is created.
- If the Apple Pay file is properly hosted, the **Apple Pay** button will appear automatically in the BBMS Checkout form for supported browsers/devices.

---

## Notes

- All sensitive credentials are kept on the backend via Vercel Environment Variables.
- The backend automatically refreshes tokens as needed, stored persistently in Upstash Redis.

---

## License

This project is licensed under the MIT License.