// 管理员 Server Actions。所有写操作都强制 requireAuth。
// 表单字段约定：tags 用逗号分隔，content 用空行分隔成段。

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  authenticateEmailUser,
  changeUserPassword,
  createEmailUser,
  deleteUserAccount,
  getUserById,
  issuePasswordResetToken,
  issueVerificationToken,
  resetPasswordWithToken,
  revokeUserSessions,
  setUserRole,
  userToSession,
} from "./users";
import {
  clearAuthRateLimits,
  enforceAuthRateLimits,
  recordAuthFailures,
} from "./auth-rate-limit";
import { getClientIp } from "./request-ip";
import { verifyTurnstileFromForm } from "./turnstile";
import { getSiteUrl } from "./site-url";
import { validatePasswordStrength, verifyPassword } from "./passwords";
import { isAdminEmail } from "./admin";
import { buildInvalidationPlan } from "./public-cache-invalidate";
import {
  checkPassword,
  clearSessionCookie,
  clearUserSessionCookie,
  getAuthViewer,
  getCurrentUser,
  requireAuth,
  setSessionCookie,
  setUserSessionCookie,
} from "./auth";
import {
  createPost,
  deletePost,
  getPostBySlugRaw,
  setPostStatus,
  slugExists,
  type NewPost,
  type PostInput,
  updatePost,
} from "./posts";
import {
  sendEmail,
  resetPasswordHtml,
  verifyEmailHtml,
} from "./email";

// —— 验证 helpers ——

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9一-龥]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

// 把“应该失效的公开页缓存键”记录到日志。
// 实际的 cache.delete(...) 在 Worker 端发生；这里仅作观测和契约。
function logPublicInvalidation(
  kind: "publish" | "update" | "delete",
  slug: string,
  previousSlug?: string
) {
  const plan = buildInvalidationPlan({ kind, slug, previousSlug });
  console.log(
    `[public-cache] invalidate plan: kind=${plan.kind} slug=${plan.slug} keys=${plan.keys.join(",")}`
  );
}

function parseTags(raw: unknown): string[] {
  if (typeof raw !== "string") return [];
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

function parseContent(raw: unknown): string[] {
  if (typeof raw !== "string") return [];
  return raw
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePostInput(input: {
  slug: string;
  title: string;
  description: string;
  date: string;
  author: string;
  tags: string[];
  content: string[];
}): string | null {
  if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(input.slug))
    return "slug 只能包含小写字母、数字和短横线，开头必须是字母或数字";
  if (input.title.length < 2) return "标题太短";
  if (input.description.length < 5) return "描述太短";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return "日期格式应为 YYYY-MM-DD";
  if (!input.author) return "作者不能为空";
  if (input.content.length === 0) return "正文不能为空";
  return null;
}

// —— Auth actions ——

async function guardTurnstile(
  formData: FormData,
  failRedirect: string
): Promise<void> {
  const ip = await getClientIp();
  const result = await verifyTurnstileFromForm(formData, ip);
  if (!result.ok) redirect(failRedirect);
}

export async function loginAction(formData: FormData): Promise<void> {
  const password = String(formData.get("password") ?? "");
  if (await checkPassword(password)) {
    await setSessionCookie();
    redirect("/admin");
  }
  // 失败：跳回登录页带 error 参数
  redirect("/login?error=1");
}

export async function logoutAction(): Promise<void> {
  await clearSessionCookie();
  await clearUserSessionCookie();
  redirect("/login");
}

export async function emailLoginAction(formData: FormData): Promise<void> {
  await guardTurnstile(formData, "/login?loginError=captcha");

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!isValidEmail(email) || !password) {
    redirect("/login?loginError=invalid");
  }

  const ip = await getClientIp();
  const limited = await enforceAuthRateLimits("login", { email, ip });
  if (!limited.ok) {
    redirect(`/login?loginError=rate&retry=${limited.retryAfterSec}`);
  }

  const result = await authenticateEmailUser({ email, password });
  if (!result.ok) {
    await recordAuthFailures("login", { email, ip });
    if (result.reason === "unverified") {
      redirect(`/login?loginError=unverified&email=${encodeURIComponent(email)}`);
    }
    redirect("/login?loginError=invalid");
  }

  await clearAuthRateLimits("login", { email, ip });
  await setUserSessionCookie(userToSession(result.user));
  redirect("/admin");
}

export async function registerAction(formData: FormData): Promise<void> {
  await guardTurnstile(
    formData,
    `/register?error=${encodeURIComponent("请完成人机验证")}`
  );

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!isValidEmail(email)) {
    redirect("/register?error=邮箱格式不正确");
  }

  const ip = await getClientIp();
  const limited = await enforceAuthRateLimits("register", { email, ip });
  if (!limited.ok) {
    redirect(`/register?error=${encodeURIComponent(`注册过于频繁，请 ${limited.retryAfterSec} 秒后再试`)}`);
  }

  const passwordError = validatePasswordStrength(password);
  if (passwordError) {
    redirect(`/register?error=${encodeURIComponent(passwordError)}`);
  }
  if (password !== confirmPassword) {
    redirect("/register?error=两次输入的密码不一致");
  }

  const result = await createEmailUser({ email, password });
  if (!result.ok) {
    await recordAuthFailures("register", { email, ip });
    redirect("/register?error=该邮箱已注册");
  }

  const siteUrl = getSiteUrl();
  const verifyUrl = `${siteUrl}/api/auth/verify-email?token=${result.verifyToken}`;
  await sendEmail({
    to: email,
    subject: "请验证你的邮箱",
    html: verifyEmailHtml({
      verifyUrl,
      siteUrl,
      email,
    }),
    text: `请打开以下链接验证邮箱：${verifyUrl}`,
  }).catch((e) => {
    console.error("[register verify email error]", e);
  });

  redirect(`/login?registered=1&email=${encodeURIComponent(email)}`);
}

export async function resendVerificationAction(
  formData: FormData
): Promise<void> {
  await guardTurnstile(formData, "/login?resendError=captcha");

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!isValidEmail(email)) {
    redirect("/login?resendError=invalid");
  }

  const ip = await getClientIp();
  const limited = await enforceAuthRateLimits("resend", { email, ip });
  if (!limited.ok) {
    redirect(`/login?resendError=rate&retry=${limited.retryAfterSec}`);
  }

  const result = await issueVerificationToken(email);
  if (!result.ok) {
    // 不泄露邮箱是否存在：统一显示“已发送”
    if (result.reason === "already_verified") {
      redirect("/login?resendError=verified");
    }
    redirect(`/login?resendSent=1&email=${encodeURIComponent(email)}`);
  }

  const siteUrl = getSiteUrl();
  const verifyUrl = `${siteUrl}/api/auth/verify-email?token=${result.token}`;
  await sendEmail({
    to: email,
    subject: "请验证你的邮箱",
    html: verifyEmailHtml({ verifyUrl, siteUrl, email }),
    text: `请打开以下链接验证邮箱：${verifyUrl}`,
  }).catch((e) => {
    console.error("[resend verify email error]", e);
  });

  await recordAuthFailures("resend", { email, ip });
  redirect(`/login?resendSent=1&email=${encodeURIComponent(email)}`);
}

export async function forgotPasswordAction(formData: FormData): Promise<void> {
  await guardTurnstile(formData, "/forgot-password?error=captcha");

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!isValidEmail(email)) {
    redirect("/forgot-password?error=invalid");
  }

  const ip = await getClientIp();
  const limited = await enforceAuthRateLimits("forgot", { email, ip });
  if (!limited.ok) {
    redirect(`/forgot-password?error=rate&retry=${limited.retryAfterSec}`);
  }

  const result = await issuePasswordResetToken(email);
  if (result.ok) {
    const siteUrl = getSiteUrl();
    const resetUrl = `${siteUrl}/reset-password?token=${result.token}`;
    await sendEmail({
      to: email,
      subject: "重置你的密码",
      html: resetPasswordHtml({ resetUrl, siteUrl, email }),
      text: `请打开以下链接重置密码：${resetUrl}`,
    }).catch((e) => {
      console.error("[forgot password email error]", e);
    });
  }

  await recordAuthFailures("forgot", { email, ip });
  redirect(`/forgot-password?sent=1&email=${encodeURIComponent(email)}`);
}

export async function resetPasswordAction(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!token) {
    redirect("/forgot-password?error=missing");
  }

  const passwordError = validatePasswordStrength(password);
  if (passwordError) {
    redirect(
      `/reset-password?token=${encodeURIComponent(token)}&error=${encodeURIComponent(passwordError)}`
    );
  }
  if (password !== confirmPassword) {
    redirect(
      `/reset-password?token=${encodeURIComponent(token)}&error=${encodeURIComponent("两次输入的密码不一致")}`
    );
  }

  const result = await resetPasswordWithToken({ token, password });
  if (!result.ok) {
    redirect("/forgot-password?error=invalid");
  }

  await setUserSessionCookie(userToSession(result.user));
  redirect("/admin?passwordReset=1");
}

export async function changePasswordAction(formData: FormData): Promise<void> {
  const session = await requireAuth();
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  const passwordError = validatePasswordStrength(newPassword);
  if (passwordError) {
    redirect(
      `/admin/account?error=${encodeURIComponent(passwordError)}`
    );
  }
  if (newPassword !== confirmPassword) {
    redirect("/admin/account?error=两次输入的新密码不一致");
  }

  const result = await changeUserPassword({
    userId: user.uid,
    currentPassword,
    newPassword,
  });

  if (!result.ok) {
    if (result.reason === "no_password") {
      redirect("/admin/account?error=当前账号使用 Google 登录，无法修改密码");
    }
    redirect("/admin/account?error=当前密码不正确");
  }

  await setUserSessionCookie(userToSession(result.user));
  redirect("/admin/account?saved=1");
}

export async function deleteAccountAction(formData: FormData): Promise<void> {
  const session = await getCurrentUser();
  if (!session) redirect("/login");

  const user = await getUserById(session.uid);
  if (!user) redirect("/login");

  const confirmEmail = String(formData.get("confirmEmail") ?? "")
    .trim()
    .toLowerCase();
  const currentPassword = String(formData.get("currentPassword") ?? "");

  if (confirmEmail !== user.email) {
    redirect("/admin/account?error=请输入你的邮箱以确认注销");
  }

  if (user.password_hash) {
    const matches = await verifyPassword(currentPassword, user.password_hash);
    if (!matches) {
      redirect("/admin/account?error=当前密码不正确，无法注销账户");
    }
  }

  const result = await deleteUserAccount(user.id);
  if (!result.ok) {
    if (result.reason === "is_admin") {
      redirect("/admin/account?error=管理员账户不能自助注销");
    }
    redirect("/admin/account?error=账户不存在或已删除");
  }

  await clearSessionCookie();
  await clearUserSessionCookie();
  redirect("/login?accountDeleted=1");
}

async function requireAdminSession(): Promise<{ email: string }> {
  const viewer = await getAuthViewer();
  if (!viewer) redirect("/login");
  if (!viewer.isAdmin) {
    redirect("/admin?error=需要管理员权限");
  }
  return { email: viewer.email.toLowerCase() };
}

export async function adminRevokeSessionsAction(
  formData: FormData
): Promise<void> {
  await requireAdminSession();
  const userId = Number(formData.get("userId"));
  if (!Number.isFinite(userId) || userId <= 0) {
    redirect("/admin/users?error=无效的用户");
  }

  const target = await getUserById(userId);
  if (!target) redirect("/admin/users?error=用户不存在");

  await revokeUserSessions(userId);
  redirect(`/admin/users?revoked=${encodeURIComponent(target.email)}`);
}

export async function adminDeleteUserAction(
  formData: FormData
): Promise<void> {
  const { email: adminEmail } = await requireAdminSession();
  const userId = Number(formData.get("userId"));
  if (!Number.isFinite(userId) || userId <= 0) {
    redirect("/admin/users?error=无效的用户");
  }

  const target = await getUserById(userId);
  if (!target) redirect("/admin/users?error=用户不存在");
  if (target.email === adminEmail) {
    redirect("/admin/users?error=不能删除当前登录的管理员账户");
  }

  const result = await deleteUserAccount(userId);
  if (!result.ok) {
    if (result.reason === "is_admin") {
      redirect("/admin/users?error=不能删除管理员账户");
    }
    redirect("/admin/users?error=删除失败");
  }

  redirect(`/admin/users?deleted=${encodeURIComponent(result.email)}`);
}

export async function adminSetUserRoleAction(
  formData: FormData
): Promise<void> {
  await requireAdminSession();

  const userId = Number(formData.get("userId"));
  const role = String(formData.get("role") ?? "");
  if (!Number.isFinite(userId) || userId <= 0) {
    redirect("/admin/users?error=无效的用户");
  }
  if (role !== "user" && role !== "vip") {
    redirect("/admin/users?error=无效的角色");
  }

  const result = await setUserRole(userId, role);
  if (!result.ok) {
    if (result.reason === "is_admin") {
      redirect("/admin/users?error=不能修改管理员角色");
    }
    redirect("/admin/users?error=用户不存在");
  }

  revalidatePath("/admin/users");
  redirect(
    `/admin/users?roleUpdated=${encodeURIComponent(result.user.email)}`
  );
}

// —— Post actions ——

async function requirePostOwnerOrAdmin(slug: string): Promise<{
  email: string;
  isAdmin: boolean;
}> {
  const session = await requireAuth();
  const email = session.email.toLowerCase();
  const admin = await isAdminEmail(email);
  if (admin) return { email, isAdmin: true };
  const post = await getPostBySlugRaw(slug);
  if (!post) redirect("/admin?error=文章不存在");
  if (post.owner_email.toLowerCase() !== email) {
    redirect("/admin?error=无权操作该文章");
  }
  return { email, isAdmin: false };
}

export async function createPostAction(formData: FormData): Promise<void> {
  await requireAuth();
  redirect(
    `/admin/new?error=${encodeURIComponent("博客内容已迁移到 Notion，请在 Notion 中创建文章")}`
  );
}

export async function updatePostAction(
  slug: string,
  formData: FormData
): Promise<void> {
  await requireAuth();
  redirect(
    `/admin/${slug}/edit?error=${encodeURIComponent("博客内容已迁移到 Notion，请在 Notion 中编辑文章")}`
  );
}

export async function deletePostAction(formData: FormData): Promise<void> {
  const slug = String(formData.get("slug") ?? "");
  if (!slug) redirect("/admin");
  const existing = await getPostBySlugRaw(slug);
  await requirePostOwnerOrAdmin(slug);
  await deletePost(slug);
  revalidatePath("/blog");
  revalidatePath("/admin");
  revalidatePath("/admin/review");
  revalidatePath(`/blog/${slug}`, "page");
  if (existing && existing.status === "published") {
    logPublicInvalidation("delete", slug);
  }
  redirect(`/admin?deleted=${slug}`);
}

// —— 审核相关 actions ——

/** 文章作者：把 draft 提交到 pending_review */
export async function submitForReviewAction(formData: FormData): Promise<void> {
  const slug = String(formData.get("slug") ?? "");
  if (!slug) redirect("/admin");
  const session = await requireAuth();
  const email = session.email.toLowerCase();
  const admin = await isAdminEmail(email);
  const post = await getPostBySlugRaw(slug);
  if (!post) redirect("/admin?error=文章不存在");
  if (!admin && post.owner_email.toLowerCase() !== email) {
    redirect("/admin?error=无权操作该文章");
  }
  if (!admin && post.status !== "draft" && post.status !== "rejected") {
    redirect(`/admin/${slug}?error=当前状态不能提交审核`);
  }
  // 管理员 submit = 直接发布；普通用户 submit = 进 pending_review
  const nextStatus = admin ? "published" : "pending_review";
  await setPostStatus(slug, nextStatus, {
    reviewedBy: admin ? email : null,
    rejectReason: null,
  });
  revalidatePath("/blog");
  revalidatePath("/admin");
  revalidatePath("/admin/review");
  revalidatePath(`/blog/${slug}`, "page");
  if (nextStatus === "published") {
    logPublicInvalidation("publish", slug);
  }
  redirect(`/admin/${slug}?review=${nextStatus}`);
}

/** 管理员：审核通过 */
export async function approvePostAction(formData: FormData): Promise<void> {
  const slug = String(formData.get("slug") ?? "");
  if (!slug) redirect("/admin/review");
  const session = await requireAuth();
  const email = session.email.toLowerCase();
  if (!(await isAdminEmail(email))) {
    redirect("/admin?error=需要管理员权限");
  }
  const post = await getPostBySlugRaw(slug);
  if (!post) redirect("/admin/review?error=文章不存在");
  await setPostStatus(slug, "published", {
    reviewedBy: email,
    rejectReason: null,
  });
  revalidatePath("/blog");
  revalidatePath("/admin");
  revalidatePath("/admin/review");
  revalidatePath(`/blog/${slug}`, "page");
  logPublicInvalidation("publish", slug);
  redirect(`/admin/review?approved=${slug}`);
}

/** 管理员：拒绝并填原因 */
export async function rejectPostAction(formData: FormData): Promise<void> {
  const slug = String(formData.get("slug") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!slug) redirect("/admin/review");
  const session = await requireAuth();
  const email = session.email.toLowerCase();
  if (!(await isAdminEmail(email))) {
    redirect("/admin?error=需要管理员权限");
  }
  if (!reason) redirect(`/admin/review/${slug}?error=请填写拒绝原因`);
  const post = await getPostBySlugRaw(slug);
  if (!post) redirect("/admin/review?error=文章不存在");
  await setPostStatus(slug, "rejected", {
    reviewedBy: email,
    rejectReason: reason,
  });
  revalidatePath("/blog");
  revalidatePath("/admin");
  revalidatePath("/admin/review");
  revalidatePath(`/blog/${slug}`, "page");
  redirect(`/admin/review?rejected=${slug}`);
}

/** 管理员：直接退回草稿 */
export async function returnToDraftAction(formData: FormData): Promise<void> {
  const slug = String(formData.get("slug") ?? "");
  if (!slug) redirect("/admin/review");
  const session = await requireAuth();
  const email = session.email.toLowerCase();
  if (!(await isAdminEmail(email))) {
    redirect("/admin?error=需要管理员权限");
  }
  await setPostStatus(slug, "draft", {
    reviewedBy: email,
    rejectReason: null,
  });
  revalidatePath("/blog");
  revalidatePath("/admin");
  revalidatePath("/admin/review");
  redirect(`/admin/review?returned=${slug}`);
}
