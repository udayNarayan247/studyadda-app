import { storage } from "@/src/utils/storage";

const TOKEN_KEY = "sa_session_token";

export async function saveToken(token: string) {
  await storage.secureSet(TOKEN_KEY, token);
}
export async function readToken(): Promise<string | null> {
  return (await storage.secureGet(TOKEN_KEY, null)) as string | null;
}
export async function clearToken() {
  await storage.secureRemove(TOKEN_KEY);
}

export const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || "";

let inMemoryToken: string | null = null;
export function setApiToken(t: string | null) { inMemoryToken = t; }
export function getApiToken() { return inMemoryToken; }

export async function api<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as any || {}),
  };
  if (inMemoryToken) headers["Authorization"] = `Bearer ${inMemoryToken}`;
  const res = await fetch(`${BACKEND_URL}/api${path}`, { ...options, headers });
  if (res.status === 401) {
    inMemoryToken = null;
    await clearToken();
    const err: any = new Error("Unauthorized");
    err.status = 401;
    throw err;
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return res.json();
  return (await res.text()) as any;
}
