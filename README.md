# SCC Donations

This application enables the Sutton Conservation Commission (SCC) to accept donations using Blackbaud Checkout and the Blackbaud Payments API.

---

## How it Works

- The frontend (`public/index.html`) is served directly by Vercel and displays a donation form using the Blackbaud Checkout SDK to securely capture payment information.
- The frontend dynamically fetches Blackbaud `publicKey` and `paymentConfig` from the Vercel-hosted backend's `/api/config` endpoint. The backend uses Vercel's environment variables to provide the correct keys (test or production) based on the deployment environment.
- When a donation is completed via the Blackbaud iFrame, the frontend receives a `transactionToken` and the selected amount.
- The frontend sends this `transactionToken` and amount to the Vercel-hosted Node.js backend (`server/server.js`).
- The backend uses the Blackbaud OAuth 2.0 Authorization Code flow to obtain and manage an access token.
- Using this access token and the `transactionToken` (which acts as an `authorization_token` for the Payments API), the backend calls the Blackbaud Merchant Services (BBMS) Payments API to complete the transaction.
- Token refresh is handled automatically by the backend, with the refresh token securely stored in Upstash Redis (Vercel KV), ensuring continuous API access across serverless function invocations.
- The frontend dynamically displays the current deployment environment (e.g., "Preview Environment") for clarity during testing.

---

## Setup

1. **Clone the repository and install dependencies:**
    ```sh
    git clone https://github.com/charlesbolducGIS/scc-donations.git
    cd sccDonations
    npm install
    ```

2. **Configure your `.env` file for local development:**
    - Copy `.env.example` to `.env` and fill in your `redirectURL` for local testing (e.g., with Ngrok).
    - Fill in your Blackbaud API credentials (`appID`, `appSecret`, `payAPIkey`, `BB_PUBLIC_KEY`, `BB_PAYMENT_CONFIG`).
    - **Note:** In deployed environments, all Blackbaud API credentials are managed via Vercel Environment Variables and are not neccessary to include in this local `.env` file.

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

This section details how the application is deployed to Vercel, serving both the frontend and backend.

1. **Vercel Project Setup:**
    - Sign up for Vercel and connect your GitHub account: [vercel.com/signup](https://vercel.com/signup)
    - Import your `scc-donations` GitHub repository as a new project in Vercel.
    >   **Crucial Setting:** In Vercel Project Settings, ensure the **"Root Directory" is left empty** (or set to `./`) so that Vercel correctly uses the `vercel.json` file to manage your serverless function and static assets.

2. **Connect Upstash Redis (Vercel KV):**
    - In your Vercel project dashboard, go to the **"Storage"** tab.
    - Click **"Connect Store"** or **"Create KV Database"** and choose **"Upstash for Redis"** from the Marketplace.
    - Follow the prompts to create a new Upstash Redis database (e.g., `scc-refresh-token-kv`) and connect it to your `scc-donations` Vercel project.
    - Vercel will automatically add the necessary environment variables (`KV_URL`, `KV_REST_API_URL`, `KV_REST_API_TOKEN`, etc.) to your project's settings.

3. **Configure Vercel Environment Variables:**
    - Go to your Vercel Project **"Settings"** and then **"Environment Variables"**.
    - For variables scoped to **All Environments** (universal Blackbaud App credentials):
        - **Scope**: Set these variables to **"All Environments"**.
        - `appID`: Your Blackbaud Application ID (`OAuth client_id`).
        - `appSecret`: Your Blackbaud Application's Primary or Secondary application secret (`OAuth client_secret`).
        - `payAPIkey`: Your Blackbaud Developer Payments API Subscription Primary or Secondary access key.
        - `BB_PUBLIC_KEY`: Your Blackbaud `public_key` from `https://api.sky.blackbaud.com/payments/v1/checkout/publickey`.
        - `authURL`: `https://app.blackbaud.com/oauth/authorize`
        - `tokenURL`: `https://oauth2.sky.blackbaud.com/token`

    - For the **`main`** branch (**Production Deployment** - `https://scc-donations.vercel.app`):
        - **Scope**: Set these variables to apply only to **"Production"** Environment.
        - `redirectURL`: `https://scc-donations.vercel.app/auth/callback`.
        - `BB_PAYMENT_CONFIG`: Your Blackbaud Payment Configuration ID with `process_mode`: `Live`(**Charges Card**).
    - For the **`dev`** branch (**Preview Deployment** - `https://scc-donations-dev.vercel.app`):        
        - **Scope**: Set these variables to apply only to **"Preview"** Environment.
        - `redirectURL`: `https://scc-donations-dev.vercel.app/auth/callback`.
        - `BB_PAYMENT_CONFIG`: Your Blackbaud Payment Configuration ID with `process_mode`: `Test`.
    - Ensure all these variables are set to apply to the correct environments.

4. **Update Blackbaud Application Redirect URIs:**
    - Log in to your Blackbaud Developer account.
    - Go to your application's settings and find the "Redirect URIs" section.
    - **Add both your Vercel Production and Preview `redirectURL`s** (e.g., `https://scc-donations.vercel.app/auth/callback` and `https://scc-donations-dev.vercel.app/auth/callback`) to the list.

5. **Configure Vercel Deployment Protection (for Preview, if desired):**
    - Go to Vercel Project Settings -> "Deployment Protection".
    - Under "Git Branch Protection", find your `dev` branch.
    - You can disable "Password Protection" or "Vercel Authentication" if you want the preview URL to be publicly accessible without a Vercel login.
    - **Warning:** If disabled, your test environment will be publicly accessible. Ensure your test Blackbaud credentials are truly for testing and don't process live payments.

6. **Initial Admin Authorization (Vercel Deployment):**
    - After Vercel has deployed your application (triggered by pushing changes to GitHub or updating environment variables), you need to perform the initial OAuth handshake on the deployed app.
        - **For Production**: Visit `https://scc-donations.vercel.app/auth/login` and authorize with your Production Blackbaud Admin Account.
        - **For Preview/Test**: Visit `https://scc-donations-dev.vercel.app/auth/login` and authorize with your Test Blackbaud Admin Account.
    - This will securely store the refresh token in your connected Upstash Redis database for each environment.

7. **Testing the Donation Flow (Vercel Deployment):**
    - Open your browser and go to your Vercel application URL:
      `https://scc-donations.vercel.app` (for **Production**)
      `https://scc-donations-dev.vercel.app` (for **Preview/Test**)
    - Select a donation amount and click **"Donate now!"**
    - Use Blackbaud's provided test credit card numbers to complete the transaction.
    - Verify the success message in the browser and confirm the "Approved" transaction in your BBMS account. This test should now consistently work due to persistent token storage.

---

## Production Deployment & Switching

- The production application is deployed from your `main` branch to `https://scc-donations.vercel.app`.
- The test/preview application is deployed from your `dev` branch to `https://scc-donations-dev.vercel.app`.
- Go to the **Sutton Conservation Commission Donations** web page at `https://www.suttonnh.gov/conservation-commission/page/donations`
- **Login with your CivicPlus account** to enable editing.
- **To go live:** Update the link on the page to point to `https://scc-donations.vercel.app`.
- **To switch back to test/preview:** Change the link back to `https://scc-donations-dev.vercel.app`.

---

## Apple Pay and Digital Wallets

To display Apple Pay, Apple requires you to host a file to validate merchant domains. The integrating application hosts this file at the root of the domain where you launch Blackbaud Checkout.

**Host Apple Pay file**
1. Download the zipped folder that contains the Apple Pay file that Blackbaud hosts: [Download Apple Pay file](https://sky.blackbaudcdn.net/static/payments-web-content/1/assets/apple-developer-merchantid-domain-association.zip)
2. Unzip the folder and host the Apple Pay file publicly in the domain where your organization launches its Blackbaud Checkout form. The complete file path should look like `[top-level domain]/.well-known/apple-developer-merchantid-domain-association`.
3. Repeat the previous step for any domains or subdomains where Apple Pay should appear. For example, the Apple Pay file path for `https://domainexample.com/donation/page.html` is `https://domainexample.com/.well-known/apple-developer-merchantid-domain-association`.

Apple Pay is enabled in `/public/index.html` where the `transactionData` object is created.

If the Apple Pay file is properly hosted, the **Apple Pay** button will appear automatically in the BBMS Checkout form for supported browsers/devices.

---

## Notes

- All sensitive credentials are kept on the backend via Vercel Environment Variables.
- The backend automatically refreshes tokens as needed, stored persistently in Upstash Redis.

---

## License

This project is licensed under the MIT License.

<!-- Triggering Vercel dev deployment -->