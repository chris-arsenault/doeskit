import { config } from "../config";
import { getToken } from "../auth";

export const API_BASE = config.apiBaseUrl;

export async function apiPost<T = unknown>(path: string, body?: unknown): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const options: RequestInit = { method: "POST", headers };
  if (body !== undefined) options.body = JSON.stringify(body);
  const res = await fetch(`${API_BASE}${path}`, options);
  if (!res.ok) throw new Error(`${path} failed: ${res.status}`);
  const text = await res.text();
  return text ? JSON.parse(text) : ({} as T);
}

export async function apiGet<T = unknown>(path: string): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { headers });
  if (!res.ok) throw new Error(`${path} failed: ${res.status}`);
  return res.json();
}

export async function apiPut(path: string): Promise<void> {
  const token = await getToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { method: "PUT", headers });
  if (!res.ok) throw new Error(`${path} failed: ${res.status}`);
}

export async function apiDelete(path: string): Promise<void> {
  const token = await getToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { method: "DELETE", headers });
  if (!res.ok) throw new Error(`${path} failed: ${res.status}`);
}
