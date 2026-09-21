import { cookies } from "next/headers";

const BACKEND_INTERNAL_URL = process.env.BACKEND_INTERNAL_URL || "http://localhost:8000";
const SESSION_COOKIE_NAME = "tr7_session";

/** Server-side backend call, forwarding the incoming request's session
 * cookie manually — server components can't rely on the browser-only
 * same-origin proxy in next.config.ts, so this hits the backend directly. */
export async function serverApiFetch(path: string, init?: RequestInit) {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE_NAME);

  return fetch(`${BACKEND_INTERNAL_URL}/api${path}`, {
    ...init,
    headers: {
      ...(session ? { cookie: `${SESSION_COOKIE_NAME}=${session.value}` } : {}),
      ...init?.headers,
    },
    cache: "no-store",
  });
}

export interface SessionUser {
  id: number;
  email: string;
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const res = await serverApiFetch("/auth/me");
  if (!res.ok) return null;
  return res.json();
}
