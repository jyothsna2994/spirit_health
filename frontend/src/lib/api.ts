import { router } from "expo-router";
import { Platform } from "react-native";

import { API_URL } from "../constants/api";
import { clearSession, getSession } from "./session";

export class ApiError extends Error {
  status: number;
  body: any;
  constructor(message: string, status: number, body: any = {}) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

async function request<T>(
  method: string,
  path: string,
  opts: { json?: unknown; form?: FormData } = {}
): Promise<T> {
  const session = await getSession();
  const headers: Record<string, string> = {};
  if (session?.token) headers.Authorization = `Bearer ${session.token}`;
  if (opts.json !== undefined) headers["Content-Type"] = "application/json";

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: opts.form ?? (opts.json !== undefined ? JSON.stringify(opts.json) : undefined),
    });
  } catch {
    throw new ApiError("Could not reach the Spirit Health server. Check your connection.", 0);
  }

  const body = await res.json().catch(() => ({}));

  if (res.status === 401 && session) {
    /* Token expired or revoked: back to the login screen. */
    await clearSession();
    router.replace("/auth");
  }
  if (!res.ok) {
    throw new ApiError(body?.message || `Request failed (${res.status})`, res.status, body);
  }
  return body as T;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, json?: unknown) => request<T>("POST", path, { json: json ?? {} }),
  patch: <T>(path: string, json: unknown) => request<T>("PATCH", path, { json }),
  del: <T>(path: string) => request<T>("DELETE", path),
  upload: <T>(path: string, form: FormData) => request<T>("POST", path, { form }),
};

/** Build the multipart field for a picked file (React Native needs a {uri,name,type} object; web needs a real File). */
export async function filePart(uri: string, name: string, type: string): Promise<any> {
  if (Platform.OS === "web") {
    const blob = await (await fetch(uri)).blob();
    return new File([blob], name, { type: type || "image/jpeg" });
  }
  return { uri, name, type: type || "image/jpeg" };
}
