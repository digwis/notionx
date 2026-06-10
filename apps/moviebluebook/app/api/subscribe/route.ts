// POST /api/subscribe - 接受订阅邮箱
// GET  /api/unsubscribe?token=... - 退订

import { NextResponse } from "next/server";
import { addSubscriber, unsubscribeByToken } from "@/lib/subscribers";
import { sendEmail, welcomeEmailHtml } from "@vinext/foundation/email";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { email?: string };
  const email = body.email;

  if (!email || typeof email !== "string" || !email.trim()) {
    return NextResponse.json({ error: "Email required" }, { status: 400 });
  }

  const result = await addSubscriber(email.trim().toLowerCase());
  if (!result.ok) {
    if (result.reason === "duplicate") {
      return NextResponse.json(
        { ok: false, message: "This email is already subscribed" },
        { status: 200 }
      );
    }
    return NextResponse.json(
      { ok: false, error: "Invalid email" },
      { status: 400 }
    );
  }

  // 异步发欢迎邮件（失败也不阻塞响应）
  const siteUrl = `${request.headers.get("x-forwarded-proto") ?? "https"}://${request.headers.get("host")}`;
  const unsubUrl = `${siteUrl}/api/unsubscribe?token=${result.token}`;

  sendEmail({
    to: email,
    subject: "Welcome to vinext Blog",
    html: welcomeEmailHtml({
      email,
      unsubscribeUrl: unsubUrl,
      siteUrl,
    }),
  }).catch((e) => console.error("[subscribe email error]", e));

  return NextResponse.json({ ok: true, message: "Subscribed!" });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Token required" }, { status: 400 });
  }
  const removed = await unsubscribeByToken(token);
  return NextResponse.json({ ok: true, removed });
}
