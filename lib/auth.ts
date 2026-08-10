import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { readState } from "./store";
import { Role, User } from "./types";

const COOKIE_NAME = "recsgps_session";
const MAX_AGE_SECONDS = 60 * 60 * 12; // 12時間

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (s && s.length >= 16) return s;
  if (process.env.NODE_ENV === "production") {
    console.warn(
      "[recsgps] AUTH_SECRET が未設定です。Vercelの環境変数に十分な長さのランダム文字列を設定してください。"
    );
  }
  return "recsgps-development-only-secret-please-change";
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createSessionToken(userId: string): string {
  const expires = Date.now() + MAX_AGE_SECONDS * 1000;
  const payload = `${userId}.${expires}`;
  return `${Buffer.from(payload).toString("base64url")}.${sign(payload)}`;
}

function verifySessionToken(token: string): string | null {
  const idx = token.lastIndexOf(".");
  if (idx < 0) return null;
  const encoded = token.slice(0, idx);
  const signature = token.slice(idx + 1);
  let payload: string;
  try {
    payload = Buffer.from(encoded, "base64url").toString("utf8");
  } catch {
    return null;
  }
  const expectedSig = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  const [userId, expiresRaw] = payload.split(".");
  const expires = Number(expiresRaw);
  if (!userId || !Number.isFinite(expires) || Date.now() > expires) return null;
  return userId;
}

export function setSessionCookie(userId: string): void {
  cookies().set(COOKIE_NAME, createSessionToken(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS
  });
}

export function clearSessionCookie(): void {
  cookies().set(COOKIE_NAME, "", { httpOnly: true, path: "/", maxAge: 0 });
}

/** ログイン中のユーザーを返す。未ログインなら null */
export async function getCurrentUser(): Promise<User | null> {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;
  const userId = verifySessionToken(token);
  if (!userId) return null;
  const state = await readState();
  const user = state.users.find((u) => u.id === userId && u.active);
  return user ?? null;
}

/** ログイン必須。役割が合わなければ相手側のトップへ送る */
export async function requireUser(role?: Role): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (role && user.role !== role) {
    redirect(user.role === "admin" ? "/admin" : "/orders");
  }
  return user;
}
