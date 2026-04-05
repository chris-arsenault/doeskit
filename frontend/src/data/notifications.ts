import { apiGet, apiPut } from "./api";

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

export async function requestNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  const result = await Notification.requestPermission();
  return result === "granted";
}
