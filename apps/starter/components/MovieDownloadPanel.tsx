"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Download, ExternalLink, LockKeyhole, RefreshCw, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuthViewer, type ClientAuthViewerState } from "@/components/useAuthViewer";

type DownloadState =
  | { status: "idle" | "loading" }
  | {
      status: "ready";
      downloadUrl: string | null;
      extractionCode: string;
    }
  | {
      status: "locked";
      reason: "unauthenticated" | "forbidden";
    }
  | { status: "missing" | "error" };

type DownloadResponse =
  | {
      ok: true;
      downloadUrl: string | null;
      extractionCode: string;
      hasDownloadInfo: boolean;
    }
  | {
      ok: false;
      reason: "unauthenticated" | "forbidden" | "not_found";
    };

export function MovieDownloadPanel({
  movieId,
  hasDownloadInfo,
}: {
  movieId: string;
  hasDownloadInfo: boolean;
}) {
  const viewer = useAuthViewer();
  const [state, setState] = useState<DownloadState>({ status: "idle" });
  const autoLoadedRef = useRef(false);

  async function loadDownloadInfo() {
    setState({ status: "loading" });
    try {
      const response = await fetch(`/api/movies/${movieId}/download`, {
        credentials: "same-origin",
        cache: "no-store",
      });
      const data = (await response.json()) as DownloadResponse;

      if (data.ok) {
        setState({
          status: "ready",
          downloadUrl: data.downloadUrl,
          extractionCode: data.extractionCode,
        });
        return;
      }

      if (data.reason === "unauthenticated" || data.reason === "forbidden") {
        setState({ status: "locked", reason: data.reason });
        return;
      }

      setState({ status: "missing" });
    } catch {
      setState({ status: "error" });
    }
  }

  useEffect(() => {
    if (
      !hasDownloadInfo ||
      autoLoadedRef.current ||
      state.status !== "idle" ||
      viewer.status !== "authenticated" ||
      !viewer.canViewVipContent
    ) {
      return;
    }

    autoLoadedRef.current = true;
    void loadDownloadInfo();
  }, [hasDownloadInfo, state.status, viewer]);

  if (!hasDownloadInfo) return null;

  const ready = state.status === "ready";
  const canView = viewer.status === "authenticated" && viewer.canViewVipContent;

  return (
    <section className="mt-8 rounded-md border p-5">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            {ready ? (
              <Download className="h-4 w-4" />
            ) : (
              <LockKeyhole className="h-4 w-4" />
            )}
            下载资源
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {ready
              ? "当前账号可查看下载链接和提取码。"
              : descriptionForViewer(viewer)}
          </p>
        </div>
        {ready && <Badge variant="secondary">VIP</Badge>}
      </div>

      {state.status === "ready" ? (
        <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
          <div className="space-y-1">
            <div className="text-xs font-medium uppercase text-muted-foreground">
              下载链接
            </div>
            {state.downloadUrl ? (
              <a
                href={state.downloadUrl}
                target="_blank"
                rel="noreferrer"
                className="break-all text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                {state.downloadUrl}
              </a>
            ) : (
              <div className="text-sm text-muted-foreground">暂无下载链接</div>
            )}
          </div>
          {state.downloadUrl && (
            <Button asChild>
              <a href={state.downloadUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4" />
                打开链接
              </a>
            </Button>
          )}
          <div className="space-y-1 md:col-span-2">
            <div className="text-xs font-medium uppercase text-muted-foreground">
              提取码
            </div>
            <div className="inline-flex min-h-9 items-center rounded-md bg-muted px-3 font-mono text-sm">
              {state.extractionCode || "无"}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3 rounded-md bg-muted p-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>{messageForState(state, viewer)}</span>
          {(state.status === "locked" && state.reason === "unauthenticated") ||
          (state.status === "idle" && viewer.status === "guest") ? (
            <Button asChild size="sm">
              <Link href="/login">
                <Shield className="h-4 w-4" />
                登录
              </Link>
            </Button>
          ) : state.status === "idle" &&
            viewer.status === "authenticated" &&
            !viewer.canViewVipContent ? (
            <Button type="button" size="sm" disabled>
              <Shield className="h-4 w-4" />
              VIP 专享
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              onClick={loadDownloadInfo}
              disabled={state.status === "loading" || (state.status === "idle" && viewer.status === "loading")}
            >
              {state.status === "loading" ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Shield className="h-4 w-4" />
              )}
              {canView && state.status === "loading" ? "读取中" : "查看资源"}
            </Button>
          )}
        </div>
      )}
    </section>
  );
}

function descriptionForViewer(viewer: ClientAuthViewerState): string {
  if (viewer.status === "authenticated" && viewer.canViewVipContent) {
    return viewer.isAdmin
      ? "当前为管理员账号，可查看下载链接和提取码。"
      : "当前为 VIP 账号，可查看下载链接和提取码。";
  }
  return "下载链接和提取码仅 VIP 用户可查看。";
}

function messageForState(
  state: DownloadState,
  viewer: ClientAuthViewerState
): string {
  if (state.status === "loading") return "正在验证权限并读取下载资源。";
  if (state.status === "locked" && state.reason === "unauthenticated") {
    return "请先登录 VIP 账号查看下载链接和提取码。";
  }
  if (state.status === "locked" && state.reason === "forbidden") {
    return "当前账号暂无 VIP 权限，无法查看下载资源。";
  }
  if (state.status === "missing") return "这部电影暂时没有可用下载资源。";
  if (state.status === "error") return "下载资源读取失败，请稍后重试。";
  if (viewer.status === "loading") return "正在确认当前账号权限。";
  if (viewer.status === "authenticated" && viewer.canViewVipContent) {
    return viewer.isAdmin
      ? "当前为管理员账号，正在自动读取下载资源。"
      : "当前为 VIP 账号，正在自动读取下载资源。";
  }
  if (viewer.status === "authenticated") {
    return "当前账号暂无 VIP 权限，无法查看下载资源。";
  }
  if (viewer.status === "guest") return "请先登录 VIP 账号查看下载链接和提取码。";
  return "账号权限状态暂时无法读取，点击后会重新验证。";
}
