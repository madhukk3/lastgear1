import React from "react";
import ReactDOM from "react-dom/client";
import * as Sentry from "@sentry/react";
import { GoogleOAuthProvider } from "@react-oauth/google";
import "@/index.css";
import App from "@/App";

const sentryDsn = import.meta.env.VITE_SENTRY_DSN;

if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0.05,
  });
}

const root = ReactDOM.createRoot(document.getElementById("root"));

root.render(
  <React.StrictMode>
    <Sentry.ErrorBoundary fallback={null}>
      <GoogleOAuthProvider
        clientId={
          import.meta.env.VITE_GOOGLE_CLIENT_ID || "YOUR_GOOGLE_CLIENT_ID"
        }
      >
        <App />
      </GoogleOAuthProvider>
    </Sentry.ErrorBoundary>
  </React.StrictMode>,
);
