// lib/subscribers.ts - 订阅者数据库操作

import { workerEnv } from "./env";

export type Subscriber = {
  id: number;
  email: string;
  created_at: string;
  confirmed: number;
  unsubscribe_token: string;
};

function genToken(): string {
  return (
    Array.from(crypto.getRandomValues(new Uint8Array(24)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  );
}

export async function addSubscriber(email: string): Promise<{
  ok: boolean;
  reason?: "duplicate" | "invalid";
  token?: string;
}> {
  const env = workerEnv;
  // 简单 email 校验
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, reason: "invalid" };
  }

  const token = genToken();

  try {
    await env.DB.prepare(
      `INSERT INTO subscribers (email, unsubscribe_token) VALUES (?, ?)`
    )
      .bind(email, token)
      .run();
    return { ok: true, token };
  } catch (e: any) {
    // UNIQUE constraint 违反
    if (e?.message?.includes("UNIQUE")) {
      return { ok: false, reason: "duplicate" };
    }
    throw e;
  }
}

export async function getConfirmedSubscribers(): Promise<Subscriber[]> {
  const env = workerEnv;
  const { results } = await env.DB.prepare(
    `SELECT id, email, created_at, confirmed, unsubscribe_token
     FROM subscribers WHERE confirmed = 1 ORDER BY created_at DESC`
  ).all<Subscriber>();
  return results || [];
}

export async function countSubscribers(): Promise<number> {
  const env = workerEnv;
  const row = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM subscribers WHERE confirmed = 1`
  ).first<{ n: number }>();
  return row?.n ?? 0;
}

export async function unsubscribeByToken(token: string): Promise<boolean> {
  const env = workerEnv;
  const res = await env.DB.prepare(
    `DELETE FROM subscribers WHERE unsubscribe_token = ?`
  )
    .bind(token)
    .run();
  return (res.meta?.changes ?? 0) > 0;
}
