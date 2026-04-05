import { config } from "../config";
import { getToken } from "../auth";

export const API_BASE = config.apiBaseUrl;

async function authHeaders(body?: unknown): Promise<Record<string, string>> {
  const token = await getToken();
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

export async function apiGet<T = unknown>(path: string): Promise<T> {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}${path}`, { headers });
  if (!res.ok) throw new Error(`${path} failed: ${res.status}`);
  return res.json();
}

export async function apiPost<T = unknown>(path: string, body?: unknown): Promise<T> {
  const headers = await authHeaders(body);
  const options: RequestInit = { method: "POST", headers };
  if (body !== undefined) options.body = JSON.stringify(body);
  try {
    const res = await fetch(`${API_BASE}${path}`, options);
    if (!res.ok) throw new Error(`${path} failed: ${res.status}`);
    const text = await res.text();
    return text ? JSON.parse(text) : ({} as T);
  } catch (e) {
    if (!navigator.onLine) {
      queueMutation("POST", `${API_BASE}${path}`, headers, body);
      return {} as T;
    }
    throw e;
  }
}

export async function apiPut(path: string, body?: unknown): Promise<void> {
  const headers = await authHeaders(body);
  const options: RequestInit = { method: "PUT", headers };
  if (body !== undefined) options.body = JSON.stringify(body);
  try {
    const res = await fetch(`${API_BASE}${path}`, options);
    if (!res.ok) throw new Error(`${path} failed: ${res.status}`);
  } catch (e) {
    if (!navigator.onLine) {
      queueMutation("PUT", `${API_BASE}${path}`, headers, body);
      return;
    }
    throw e;
  }
}

export async function apiDelete(path: string): Promise<void> {
  const headers = await authHeaders();
  const options: RequestInit = { method: "DELETE", headers };
  try {
    const res = await fetch(`${API_BASE}${path}`, options);
    if (!res.ok) throw new Error(`${path} failed: ${res.status}`);
  } catch (e) {
    if (!navigator.onLine) {
      queueMutation("DELETE", `${API_BASE}${path}`, headers);
      return;
    }
    throw e;
  }
}

// ── Offline sync queue ─────────────────────────────────────

function queueMutation(
  method: string,
  url: string,
  headers: Record<string, string>,
  body?: unknown
) {
  const sw = navigator.serviceWorker?.controller;
  if (sw) {
    sw.postMessage({
      type: "QUEUE_MUTATION",
      mutation: { method, url, headers, body },
    });
    // Request background sync if supported
    navigator.serviceWorker.ready.then((reg) => {
      if ("sync" in reg) {
        (reg as unknown as { sync: { register: (tag: string) => Promise<void> } }).sync.register(
          "dosekit-sync"
        );
      }
    });
  }
}

export function flushOfflineQueue() {
  const sw = navigator.serviceWorker?.controller;
  if (sw) sw.postMessage({ type: "FLUSH_QUEUE" });
}
