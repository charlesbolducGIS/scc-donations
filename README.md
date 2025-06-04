# SCC Donations (Development Version)

This application enables the Sutton Conservation Commission (SCC) to accept donations using Blackbaud Checkout and the Blackbaud Payments API.

## How it works

- The frontend displays a donation form and uses the Blackbaud Checkout SDK.
- When a donation is completed, the frontend receives a transaction token and sends it to the backend.
- The backend uses the Blackbaud OAuth 2.0 Authorization Code flow to obtain an access token and calls the Payments API to complete the transaction.
- Token refresh is handled automatically by the backend.

## Setup

1. **Clone the repository and install dependencies:**
   ```bash
   git clone <repository-url>
   cd sccDonationsDev
   npm install
   ```

2. **Configure your `.env` file:**
   - Copy `.env.example` to `.env` and fill in your actual credentials and URLs:
     ```
     appID=your_client_id
     appSecret=your_client_secret
     payAPIkey=your_payments_api_subscription_key
     authURL=https://app.blackbaud.com/oauth/authorize
     tokenURL=https://oauth2.sky.blackbaud.com/token
     redirectURL=https://yourfinaldomain.org/auth/callback
     PORT=3000
     ```
   - The public key and **payment configuration ID are hardcoded in `public/index.html`** for the development environment.

3. **Start the backend:**
   ```bash
   npm start
   ```

4. **Open the app in your browser:**
   ```
   http://localhost:3000
   ```

## Initial Admin Authorization

1. Visit `http://localhost:3000/auth/login` in your browser.
2. Log in with your Blackbaud admin account and authorize the application.
3. After successful authorization, you will see a message:  
   `Authorization successful! You may now close this window.`
4. The backend will store a refresh token in `server/refresh_token.txt` for unattended operation.

## Re-authorization

- If the server is rebooted and the refresh token is lost or becomes invalid, repeat the initial admin authorization process by visiting `/auth/login` again.

## Production Deployment

- **This is the development version.**
- To create a production version:
  - Update the `paymentConfig` ID in `public/index.html` to use the values from your live Blackbaud environment.
  - Update the `redirectURL` in your `.env` to match your production domain, e.g.:
    ```
    redirectURL=https://yourfinaldomain.org/auth/callback
    ```
  - Ensure your production Blackbaud app settings include the correct redirect URI.
  - Serve the app over HTTPS (required for Blackbaud Checkout).
  - For production, consider storing the refresh token in a secure database or encrypted file.

## Apple Pay and Digital Wallets

- Apple Pay and Google Pay are enabled via configuration in the Blackbaud Merchant Services portal and your payment configuration.
- No code changes are required; if enabled, these options will appear automatically in the BBMS Checkout form for supported browsers/devices.

## Notes

- All sensitive credentials are kept on the backend.
- The backend will automatically refresh tokens as needed.
- For production, consider persisting tokens and logs for auditing.
- The public key and payment configuration ID are safe to expose in the frontend.

## License

[Add your license here, if applicable]