SCC Donations (Development Version)
This application enables the Sutton Conservation Commission (SCC) to accept donations using Blackbaud Checkout and the Blackbaud Payments API.

How it works
The frontend (public/index.html) displays a donation form and uses the Blackbaud Checkout SDK to securely capture payment information.

When a donation is completed via the Blackbaud iFrame, the frontend receives a transactionToken and the selected amount.

The frontend sends this transactionToken and amount to the custom Node.js backend (server/server.js).

The backend uses the Blackbaud OAuth 2.0 Authorization Code flow to obtain and manage an access token.

Using this access token and the transactionToken (which acts as an authorization_token for the Payments API), the backend calls the Blackbaud Merchant Services (BBMS) Payments API to complete the transaction.

Token refresh is handled automatically by the backend to maintain continuous API access.

Setup
Clone the repository and install dependencies:

git clone https://github.com/charlesbolducGIS/scc-donations-dev.git
cd sccDonationsDev
npm install

Configure your .env file:

Copy .env.example to .env and fill in your actual credentials and URLs:

appID=your_client_id
appSecret=your_client_secret
payAPIkey=your_payments_api_subscription_key
authURL=https://app.blackbaud.com/oauth/authorize
tokenURL=https://oauth2.sky.blackbaud.com/token
redirectURL=http://localhost:3000/auth/callback  # Default for local development
PORT=3000

The publicKey and paymentConfig ID are hardcoded in public/index.html for this development environment.

Start the backend:

Navigate to the server directory in your terminal: cd server

Run: npm start

Your server will start and listen on the port defined in your .env (e.g., 3000). Keep this terminal running.

Local Testing with Ngrok
Since the frontend is hosted on CivicPlus (which requires HTTPS) and Blackbaud's OAuth callback needs a public HTTPS URL, we use ngrok to create a secure tunnel to your local backend.

Download and Install Ngrok:

Download the appropriate version for your Windows 11 Pro VM (ARM 64-bit is recommended if available) from https://ngrok.com/download.

Unzip ngrok.exe and place it in a directory that is in your system's PATH (e.g., C:\dev_tools). Remember to restart your terminal after updating PATH.

Authenticate Ngrok:

Sign up for a free Ngrok account at https://dashboard.ngrok.com/signup.

Copy your authtoken command from the Ngrok dashboard.

In a new terminal (separate from your running Node.js server), run: ngrok authtoken <YOUR_AUTH_TOKEN_HERE>

Create the Ngrok Tunnel:

In the same new terminal, run Ngrok, specifying your backend's port (e.g., 3000):

ngrok http 3000

Ngrok will provide a public HTTPS forwarding URL (e.g., https://xxxx-xxxx-xxxx-xxxx.ngrok-free.app). Copy this HTTPS URL.

Update Blackbaud Application Redirect URI:

Log in to your Blackbaud Developer account.

Go to your application's settings and find the "Redirect URIs" (or "OAuth redirect URI" / "Callback URL") section.

Add your Ngrok HTTPS forwarding URL with the /auth/callback path (e.g., https://xxxx-xxxx-xxxx-xxxx.ngrok-free.app/auth/callback) to the list of allowed URIs.

Important: Ngrok free tier URLs change each time you restart Ngrok. You will need to update this in Blackbaud every time you start a new Ngrok tunnel for testing.

Update .env for Ngrok Testing:

Temporarily change the redirectURL in your local .env file to match your current Ngrok HTTPS URL:

redirectURL=https://xxxx-xxxx-xxxx-xxxx.ngrok-free.app/auth/callback

Save your .env file and RESTART your Node.js backend server (Ctrl + C then npm start) for the change to take effect.

Initial Admin Authorization (OAuth Handshake)
Before processing donations, your backend needs to obtain initial OAuth tokens from Blackbaud.

Visit the authorization endpoint in your browser (using your current Ngrok URL):
https://xxxx-xxxx-xxxx-xxxx.ngrok-free.app/auth/login

Log in with your Blackbaud admin account and authorize the application.

After successful authorization, you will see a message: Authorization successful! You may now close this window.

The backend will store a refresh token in server/refresh_token.txt for unattended operation. This file is excluded from Git via .gitignore.

Testing the Donation Flow
Once your backend is running, Ngrok is tunneling, and initial authorization is complete:

Open your browser (within your Windows VM) and go to your Ngrok forwarding URL:
https://xxxx-xxxx-xxxx-xxxx.ngrok-free.app

Select a donation amount and click "Donate now!".

The Blackbaud Checkout iFrame should appear. Use Blackbaud's provided test credit card numbers (e.g., Visa: 4242...4242, Exp: 01/30, CSC: 123) to complete the transaction.

Observe the success message in the browser and check your Blackbaud Merchant Services (BBMS) account for the "Approved" transaction.

Production Deployment (Future State)
This is the development version.

For production, the backend (server.js) needs to be hosted on a cloud platform (e.g., Vercel, Render, AWS, Azure, Google Cloud) that provides a stable, public HTTPS URL.

The redirectURL in your production .env (or environment variables) must match your production domain (e.g., https://donations.yourfinaldomain.org/auth/callback).

The refresh_token.txt file must be replaced with a secure, persistent storage solution (e.g., encrypted database, cloud secrets manager).

The frontend (public/index.html) will be embedded on the CivicPlus site, making calls to the stable production backend URL.

Apple Pay and Digital Wallets
Apple Pay and Google Pay are enabled via configuration in the Blackbaud Merchant Services portal and your payment configuration.

No code changes are required; if enabled, these options will appear automatically in the BBMS Checkout form for supported browsers/devices.

Notes
All sensitive credentials are kept on the backend (.env file, not committed to Git).

The backend will automatically refresh tokens as needed.

The public key and payment configuration ID are safe to expose in the frontend.

License
This project is licensed under the MIT License

