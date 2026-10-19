# HOUSE OF FAVÉ — Render starter

A classic burgundy/ivory storefront with a Google-login admin area, PostgreSQL product storage, and WhatsApp order links.

## Important first-version notes
- Product create/edit/delete endpoints are protected by Firebase ID-token verification on the server.
- Only `favouranigbogu44@gmail.com` and `whitefrostff@gmail.com` are authorized.
- Product photos are currently entered as public image URLs. Direct image upload needs a persistent image host (e.g. Cloudinary) and should be added before launch.
- WhatsApp ordering pre-fills a message; the customer must press Send.
- This starter does not yet include order storage, appointment booking, or payments.

## 1. Create the GitHub repository
Create a new **private** repository named `house-of-fave` if you prefer not to expose the source publicly. Upload all files/folders in this project to the repository root.

## 2. Create a PostgreSQL database
Create a PostgreSQL database (Neon is supported) and copy its connection string. Keep it private.

## 3. Configure Firebase Google login
1. Open Firebase Console and create/select a project.
2. Add a Web App and copy its `apiKey`, `authDomain`, `projectId`, and `appId`.
3. Authentication → Sign-in method → enable **Google**.
4. Authentication settings → Authorized domains: add the exact Render hostname, e.g. `house-of-fave.onrender.com`.
5. Project settings → Service accounts → Generate new private key. Keep this JSON secret. Do not commit it to GitHub.

## 4. Deploy to Render
1. Render → New → Web Service → connect the GitHub repository.
2. Build command: `npm install`
3. Start command: `npm start`
4. Add these environment variables in Render (Dashboard → your service → Environment):
   - `DATABASE_URL` = PostgreSQL connection string
   - `FIREBASE_SERVICE_ACCOUNT_JSON` = the full contents of the Firebase service-account JSON file, all on one line is fine
   - `FIREBASE_PROJECT_ID` = Firebase project ID
   - `FIREBASE_API_KEY` = Firebase Web App API key
   - `FIREBASE_AUTH_DOMAIN` = Firebase Web App auth domain
   - `FIREBASE_APP_ID` = Firebase Web App app ID
   - `WHATSAPP_NUMBER` = business WhatsApp number in international digits only, e.g. `2348012345678` (replace with the real number)
5. Deploy. On first start the app creates the `products` table.

## 5. Before launch
- Test both approved Google accounts and verify any third-party account is denied.
- Test adding/editing/deleting products and WhatsApp links.
- Add direct image uploads using persistent image hosting.
- Add order/appointment storage if those features are required.
- Review Firebase/Render/PostgreSQL billing and free-tier limits.
- Never commit `.env`, service-account JSON, database strings, or other secrets to GitHub.

## Local development
Requires Node.js 20+ and a PostgreSQL database. Set the environment variables listed above, then run `npm install` and `npm start`.
