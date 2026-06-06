"use client";

// 客户端订阅表单：email + submit + 成功/失败状态
// Server Component 不能用 useState，必须拆成 Client Component
// React 19 推荐用 form action prop + FormData 取代 FormEvent 事件类型

import { useState } from "react";
import { Mail, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Status = "idle" | "loading" | "success" | "error" | "duplicate";

export default function SubscribeForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(formData: FormData) {
    const value = String(formData.get("email") ?? "").trim();
    setEmail(value);
    setStatus("loading");
    setMessage("");

    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: value }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        message?: string;
        error?: string;
      };

      if (data.ok) {
        setStatus("success");
        setMessage("已订阅！欢迎邮件已发出。");
        setEmail("");
      } else if (data.message?.includes("already")) {
        setStatus("duplicate");
        setMessage("这个邮箱已订阅过了。");
      } else {
        setStatus("error");
        setMessage(data.error || "订阅失败，请重试");
      }
    } catch {
      setStatus("error");
      setMessage("网络错误，请重试");
    }
  }

  const isLoading = status === "loading";
  const showOk = status === "success";
  const showErr = status === "error" || status === "duplicate";

  return (
    <form
      action={handleSubmit}
      className="rounded-lg border bg-card p-6 shadow-sm"
    >
      <div className="mb-3 flex items-center gap-2">
        <Mail className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-lg font-semibold">订阅新文章</h3>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        发布新文章时会发邮件通知你。一键退订。
      </p>

      <div className="space-y-2">
        <Label htmlFor="subscribe-email" className="sr-only">
          邮箱
        </Label>
        <div className="flex gap-2">
          <Input
            id="subscribe-email"
            name="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            disabled={isLoading || showOk}
            className="flex-1"
          />
          <Button type="submit" disabled={isLoading || showOk}>
            {isLoading ? "..." : "订阅"}
          </Button>
        </div>
      </div>

      {showOk && (
        <div className="mt-3 flex items-center gap-1.5 text-sm text-emerald-600">
          <CheckCircle2 className="h-3.5 w-3.5" />
          {message}
        </div>
      )}
      {showErr && (
        <div className="mt-3 flex items-center gap-1.5 text-sm text-destructive">
          <AlertCircle className="h-3.5 w-3.5" />
          {message}
        </div>
      )}
    </form>
  );
}
