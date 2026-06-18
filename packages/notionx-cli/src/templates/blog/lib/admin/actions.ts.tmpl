"use server";

import { redirect } from "next/navigation";
import {
  changeUserPassword,
  getCurrentUser,
  setUserSessionCookie,
  userToSession,
  validatePasswordStrength,
} from "@notionx/core/auth";

export async function changePasswordAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  const passwordError = validatePasswordStrength(newPassword);
  if (passwordError) {
    redirect(`/admin/account?error=${encodeURIComponent(passwordError)}`);
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
      redirect("/admin/account?error=当前账号未设置密码");
    }
    redirect("/admin/account?error=当前密码不正确");
  }

  await setUserSessionCookie(userToSession(result.user));
  redirect("/admin/account?saved=1");
}
