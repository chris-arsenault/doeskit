import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { flushOfflineQueue } from "./data/api";
import { useStore } from "./data/store";
import { getNotificationSettings } from "./data/notifications";
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
    // SW energy quick-reply: log the score via store
    if (event.data?.type === "LOG_ENERGY") {
      useStore.getState().logEnergy(event.data.period, event.data.value);
    }
  });

  // Check notifications every 5 minutes while the app is open
  setInterval(sendStateToSW, 5 * 60 * 1000);
  // Also check shortly after load
  setTimeout(sendStateToSW, 10_000);
}

async function sendStateToSW() {
  const sw = navigator.serviceWorker?.controller;
  if (!sw) return;
  try {
    const settings = await getNotificationSettings();
    if (!settings.enabled) return;
    const state = useStore.getState();
    sw.postMessage({
      type: "CHECK_NOTIFICATIONS",
      settings,
      today: {
        energy: state.energy,
        sleep: state.sleep,
        workoutDone: state.workoutDone,
        untakenCount: state.doses.filter((d) => !state.taken[d.supplement_type.id]).length,
      },
    });
  } catch {
    // Settings not loaded yet, skip
  }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
