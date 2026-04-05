import { apiGet, apiPost, apiPut } from "./api";

export type NotificationSettings = {
  enabled: boolean;
  morning_doses: string;
  energy_morning: string;
  energy_afternoon: string;
  energy_evening: string;
  missed_dose_nudge: string;
  evening_wrapup: string;
};

const DEFAULT_SETTINGS: NotificationSettings = {
  enabled: false,
  morning_doses: "07:00",
  energy_morning: "10:00",
  energy_afternoon: "14:00",
  energy_evening: "20:00",
  missed_dose_nudge: "12:00",
  evening_wrapup: "21:30",
};

export async function getNotificationSettings(): Promise<NotificationSettings> {
  try {
    return await apiGet<NotificationSettings>("/notifications/settings");
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function updateNotificationSettings(settings: NotificationSettings): Promise<void> {
  await apiPut("/notifications/settings", settings);
}

export async function subscribeToPush(): Promise<boolean> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return false;

  const reg = await navigator.serviceWorker.ready;

  // Get VAPID public key from backend
  const { key } = await apiGet<{ key: string }>("/notifications/vapid-public");
  if (!key) return false;

  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(key) as BufferSource,
  });

  const json = sub.toJSON();
  await apiPost("/push/subscribe", {
    endpoint: json.endpoint,
    p256dh: json.keys?.p256dh ?? "",
    auth: json.keys?.auth ?? "",
  });

  return true;
}

export async function unsubscribeFromPush(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (sub) {
    const endpoint = sub.endpoint;
    await sub.unsubscribe();
    await apiPost("/push/unsubscribe", { endpoint });
  }
}

export async function isPushSubscribed(): Promise<boolean> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  return sub !== null;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
