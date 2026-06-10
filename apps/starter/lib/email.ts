// lib/email.ts - 通过 Resend HTTP API 发送邮件
// Cloudflare Workers 不能用 SMTP（无长连接），所以走 Resend HTTP API
// 免费：resend.com → 3000 封/月

import { Resend } from "resend";
import { workerEnv } from "./env";

let resendClient: Resend | null = null;

function getResend(): Resend | null {
  if (resendClient) return resendClient;
  const env = workerEnv;
  if (!env.RESEND_API_KEY) return null;
  resendClient = new Resend(env.RESEND_API_KEY);
  return resendClient;
}

type SendArgs = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
};

/**
 * 发送邮件。如果 RESEND_API_KEY 没配（dev 默认），自动 noop + log，不报错。
 * 返回 resend 提供的 message id，失败时 throw。
 */
export async function sendEmail(args: SendArgs): Promise<string | null> {
  const env = workerEnv;
  const resend = getResend();

  // dev 模式没配 key → 静默跳过
  if (!resend) {
    console.log("[email:noop] to=%s subject=%s", args.to, args.subject);
    return null;
  }

  const from = env.RESEND_FROM || "Blog <noreply@resend.dev>";

  const { data, error } = await resend.emails.send({
    from,
    to: args.to,
    subject: args.subject,
    html: args.html,
    text: args.text,
    replyTo: args.replyTo,
  });

  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }
  return data?.id ?? null;
}

/** 简单 HTML 转义 */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** 欢迎订阅邮件模板（纯 HTML 字符串，不依赖 React Email 组件，体积更小） */
export function welcomeEmailHtml(opts: {
  email: string;
  unsubscribeUrl: string;
  siteUrl: string;
}): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Welcome</title></head>
<body style="margin:0;padding:0;background:#fafafa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#171717;">
  <div style="max-width:560px;margin:0 auto;padding:40px 20px;">
    <h1 style="font-size:24px;font-weight:600;margin:0 0 16px;">Welcome aboard!</h1>
    <p style="font-size:16px;line-height:24px;color:#404040;margin:0 0 24px;">
      Hi <strong>${esc(opts.email)}</strong>，感谢订阅 <a href="${esc(opts.siteUrl)}">vinext Blog</a>。
      新文章发布时会第一时间通知你。
    </p>
    <hr style="border:0;border-top:1px solid #e5e5e5;margin:32px 0;" />
    <p style="font-size:12px;color:#737373;margin:0;">
      不想再收？<a href="${esc(opts.unsubscribeUrl)}" style="color:#737373;">退订</a>
    </p>
  </div>
</body>
</html>`;
}

export function resetPasswordHtml(opts: {
  resetUrl: string;
  siteUrl: string;
  email: string;
}): string {
  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#fafafa;font-family:-apple-system,BlinkMacSystemFont,sans-serif;color:#171717;">
  <div style="max-width:560px;margin:0 auto;padding:40px 20px;">
    <p style="font-size:13px;color:#737373;margin:0 0 8px;text-transform:uppercase;letter-spacing:0.05em;">Reset password</p>
    <h1 style="font-size:24px;font-weight:600;margin:0 0 12px;">Reset your password</h1>
    <p style="font-size:16px;line-height:24px;color:#404040;margin:0 0 24px;">
      Hi <strong>${esc(opts.email)}</strong>，我们收到了重置 <a href="${esc(opts.siteUrl)}">vinext Blog</a> 账户密码的请求。
      点击下方按钮设置新密码。链接 1 小时内有效。
    </p>
    <a href="${esc(opts.resetUrl)}" style="display:inline-block;background:#171717;color:#fafafa;padding:10px 20px;border-radius:6px;text-decoration:none;font-size:14px;">Reset password</a>
    <p style="font-size:12px;color:#737373;margin:24px 0 0;">
      如果这不是你的操作，请忽略此邮件。如果按钮无法打开，请复制链接到浏览器：<br />
      <a href="${esc(opts.resetUrl)}" style="color:#737373;word-break:break-all;">${esc(opts.resetUrl)}</a>
    </p>
  </div>
</body>
</html>`;
}

export function verifyEmailHtml(opts: {
  verifyUrl: string;
  siteUrl: string;
  email: string;
}): string {
  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#fafafa;font-family:-apple-system,BlinkMacSystemFont,sans-serif;color:#171717;">
  <div style="max-width:560px;margin:0 auto;padding:40px 20px;">
    <p style="font-size:13px;color:#737373;margin:0 0 8px;text-transform:uppercase;letter-spacing:0.05em;">Verify email</p>
    <h1 style="font-size:24px;font-weight:600;margin:0 0 12px;">Confirm your email</h1>
    <p style="font-size:16px;line-height:24px;color:#404040;margin:0 0 24px;">
      Hi <strong>${esc(opts.email)}</strong>，欢迎注册 <a href="${esc(opts.siteUrl)}">vinext Blog</a>。
      请点击下面的按钮完成邮箱验证，验证后即可登录后台。
    </p>
    <a href="${esc(opts.verifyUrl)}" style="display:inline-block;background:#171717;color:#fafafa;padding:10px 20px;border-radius:6px;text-decoration:none;font-size:14px;">Verify email</a>
    <p style="font-size:12px;color:#737373;margin:24px 0 0;">
      如果按钮无法打开，请复制这个链接到浏览器：<br />
      <a href="${esc(opts.verifyUrl)}" style="color:#737373;word-break:break-all;">${esc(opts.verifyUrl)}</a>
    </p>
  </div>
</body>
</html>`;
}

/** 新文章通知邮件模板 */
export function newPostEmailHtml(opts: {
  title: string;
  description: string;
  url: string;
  unsubscribeUrl: string;
}): string {
  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#fafafa;font-family:-apple-system,BlinkMacSystemFont,sans-serif;color:#171717;">
  <div style="max-width:560px;margin:0 auto;padding:40px 20px;">
    <p style="font-size:13px;color:#737373;margin:0 0 8px;text-transform:uppercase;letter-spacing:0.05em;">New post</p>
    <h1 style="font-size:24px;font-weight:600;margin:0 0 12px;">
      <a href="${esc(opts.url)}" style="color:#171717;text-decoration:none;">${esc(opts.title)}</a>
    </h1>
    <p style="font-size:16px;line-height:24px;color:#404040;margin:0 0 24px;">${esc(opts.description)}</p>
    <a href="${esc(opts.url)}" style="display:inline-block;background:#171717;color:#fafafa;padding:10px 20px;border-radius:6px;text-decoration:none;font-size:14px;">Read the post →</a>
    <hr style="border:0;border-top:1px solid #e5e5e5;margin:40px 0 16px;" />
    <p style="font-size:12px;color:#737373;margin:0;">
      不想再收新文章通知？<a href="${esc(opts.unsubscribeUrl)}" style="color:#737373;">退订</a>
    </p>
  </div>
</body>
</html>`;
}
