<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/63c3df9f-852d-4ef8-bea7-45d59e8baa17

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in `.env.local` if you want live AI responses.
3. Set `API_GATEWAY_URL=http://localhost:1912` in `.env.local` when the backend stack is exposed through the gateway on port `1912`.
4. Run the app:
   `npm run dev`

The frontend dev server proxies `/api/auth`, `/api/catalog`, `/api/cart`, `/api/orders`, `/api/payments`, `/api/reviews`, and `/api/admin` to `API_GATEWAY_URL`.
