"use client";

import { useState } from "react";
import { Lock, Play, Sparkles } from "lucide-react";
import NotionRichText from "@/components/NotionRichText";
import { Button } from "@/components/ui/button";
import { useAuthViewer, type ClientAuthViewerState } from "@/components/useAuthViewer";
import type { NotionRichTextPart } from "@/lib/notion/types";

type Playback = {
  type: "video" | "embed";
  src: string;
};

type VideoAccessResponse =
  | {
      ok: true;
      src: string;
      playback?: Playback;
      access: {
        vip: boolean;
        limit: number | null;
        used: number | null;
        remaining: number | null;
      };
    }
  | {
      ok: false;
      reason: "unauthenticated" | "limit_reached" | "forbidden" | "not_found";
      limit?: number;
      used?: number;
      remaining?: number;
    };

function VideoCaption({ value }: { value?: NotionRichTextPart[] }) {
  if (!value || value.length === 0) return null;
  return (
    <figcaption className="mt-2 text-center text-sm text-muted-foreground">
      <NotionRichText value={value} />
    </figcaption>
  );
}

function defaultMessageForViewer(viewer: ClientAuthViewerState) {
  if (viewer.status === "loading") return "正在确认当前账号的视频权限。";
  if (viewer.status === "authenticated" && viewer.canViewVipContent) {
    return viewer.isAdmin
      ? "当前为管理员账号，可直接播放这个视频。"
      : "当前为 VIP 账号，可直接播放这个视频。";
  }
  if (viewer.status === "authenticated") {
    return "当前账号每月可免费试看 3 个视频，VIP 不限量播放。";
  }
  if (viewer.status === "guest") {
    return "登录后每月可免费试看 3 个视频，VIP 不限量播放。";
  }
  return "账号权限状态暂时无法读取，点击播放时会重新验证。";
}

export default function GatedVideo({
  accessUrl,
  caption,
}: {
  accessUrl: string | null;
  caption?: NotionRichTextPart[];
}) {
  const viewer = useAuthViewer();
  const [playback, setPlayback] = useState<Playback | null>(null);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "denied">("idle");
  const [message, setMessage] = useState<string | null>(null);

  const loadVideo = async () => {
    if (!accessUrl || status === "loading") return;
    setStatus("loading");
    try {
      const response = await fetch(accessUrl, {
        credentials: "same-origin",
        cache: "no-store",
        headers: { accept: "application/json" },
      });
      const data = (await response.json()) as VideoAccessResponse;
      if (data.ok) {
        setPlayback(data.playback ?? { type: "video", src: data.src });
        setPlaybackError(null);
        setStatus("idle");
        if (data.access.vip) {
          setMessage("已通过 VIP/管理员权限验证。");
        } else if (data.access.remaining !== null) {
          setMessage(`本月还可免费试看 ${data.access.remaining} 个视频。`);
        }
        return;
      }

      if (data.reason === "unauthenticated") {
        setMessage("请先登录，登录后可使用免费试看额度。");
      } else if (data.reason === "limit_reached") {
        setMessage("本月免费试看额度已用完，开通 VIP 后可继续播放。");
      } else {
        setMessage("当前账号暂时不能播放这个视频。");
      }
      setStatus("denied");
    } catch {
      setMessage("视频权限检查失败，请稍后再试。");
      setStatus("denied");
    }
  };

  if (playback?.type === "embed") {
    return (
      <figure className="my-8">
        <div className="aspect-video overflow-hidden rounded-lg border bg-muted">
          <iframe
            src={playback.src}
            className="h-full w-full"
            loading="lazy"
            sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
            allow="fullscreen; encrypted-media; picture-in-picture; autoplay"
            allowFullScreen
          />
        </div>
        <VideoCaption value={caption} />
      </figure>
    );
  }

  if (playback?.type === "video") {
    return (
      <figure className="my-8">
        <video
          src={playback.src}
          className="w-full rounded-lg border bg-black"
          controls
          controlsList="nodownload"
          playsInline
          preload="metadata"
          onError={() =>
            setPlaybackError(
              "浏览器无法播放这个视频。通常是视频编码或封装格式不兼容，建议在 Notion 中上传 H.264/AAC 编码的 MP4。"
            )
          }
          onLoadedMetadata={() => setPlaybackError(null)}
        />
        {playbackError && (
          <p className="mt-2 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
            {playbackError}
          </p>
        )}
        <VideoCaption value={caption} />
      </figure>
    );
  }

  return (
    <figure className="my-8">
      <div className="rounded-lg border bg-muted/40 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="mt-0.5 rounded-md border bg-background p-2">
              <Lock className="h-4 w-4" />
            </div>
            <div>
              <div className="font-medium">视频内容</div>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {message ?? defaultMessageForViewer(viewer)}
              </p>
            </div>
          </div>
          <Button
            type="button"
            onClick={loadVideo}
            disabled={status === "loading" || !accessUrl}
            className="shrink-0"
          >
            {status === "loading" ? (
              <Sparkles className="h-4 w-4 animate-pulse" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            播放视频
          </Button>
        </div>
      </div>
      <VideoCaption value={caption} />
    </figure>
  );
}
