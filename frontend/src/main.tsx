import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { getToken } from "./auth";
import { flushOfflineQueue } from "./data/api";
import "./index.css";

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });

  window.addEventListener("online", () => flushOfflineQueue());

  navigator.serviceWorker.addEventListener("message", (event) => {
    if (event.data?.type === "SYNC_COMPLETE") {
      window.dispatchEvent(new Event("dosekit-synced"));
    }
    // SW requests auth token for notification actions
    if (event.data?.type === "GET_AUTH_TOKEN" && event.ports?.[0]) {
      getToken().then((token) => event.ports[0].postMessage({ token }));
    }
  });
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
