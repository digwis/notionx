"use client";

// ImageUploader (v3) - 完全受控组件
//
// 用法：
//   <ImageUploader value={coverImage} onChange={setCoverImage} name="coverImage" />
//   或作为 Server Component 表单的子组件，name 用于 debug
//
// 关键变化：
// - value 和 onChange 是受控的（来自父组件的 useState）
// - 不用 hidden input
// - 父组件在 form submit 时从 state 拿值塞到 FormData
// - 这样 React 19 form action 不会丢状态

import { useRef, useState } from "react";
import { ImagePlus, X, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type UploadedFile = {
  url: string;
  key: string;
  size: number;
  contentType: string;
};

type Props = {
  value: string;
  onChange: (url: string) => void;
  className?: string;
};

export default function ImageUploader({ value, onChange, className }: Props) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justUploaded, setJustUploaded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // 兜底：浏览器对 accept 的匹配并不严格，文件选择阶段放过不代表它是真图片。
    // 只允许常见图片扩展名（防止 .exe、.dmg 等被伪装成图片）。
    const allowedExt = /\.(jpe?g|png|gif|webp|avif)$/i;
    if (!file.type.startsWith("image/") && !allowedExt.test(file.name)) {
      setError("只支持图片文件 (JPG/PNG/GIF/WebP/AVIF)");
      e.target.value = "";
      return;
    }

    setUploading(true);
    setError(null);
    setJustUploaded(false);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = (await res.json()) as UploadedFile & { error?: string };
      if (!res.ok) throw new Error(data.error || "Upload failed");

      // 触发父组件 state 更新
      onChange(data.url);
      setJustUploaded(true);
      setTimeout(() => setJustUploaded(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  function clear() {
    onChange("");
    setError(null);
    setJustUploaded(false);
  }

  return (
    <div className={cn("space-y-2", className)}>
      {value ? (
        <div className="space-y-2">
          <div className="relative inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={value}
              alt="cover"
              className="max-h-48 w-auto rounded-md border bg-muted object-cover"
            />
            <Button
              type="button"
              variant="destructive"
              size="icon"
              className="absolute -right-2 -top-2 h-6 w-6 rounded-full"
              onClick={clear}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
          {justUploaded && (
            <div className="flex items-center gap-1.5 text-xs text-emerald-600">
              <CheckCircle2 className="h-3.5 w-3.5" />
              已上传，状态已更新。点"保存"后生效。
            </div>
          )}
          {/* 调试时方便查看：显示当前 URL 长度/前 30 字符 */}
          <p className="break-all text-[10px] text-muted-foreground">
            URL ({value.length} 字符): {value.slice(0, 60)}
            {value.length > 60 && "…"}
          </p>
        </div>
      ) : (
        <div>
          <input
            ref={fileInputRef}
            type="file"
            // 关键：同时声明 MIME 和扩展名，规避浏览器在某些文件上把
            // file.type 给成空串 / application/octet-stream 导致被误拒。
            // .jpeg 必须独立写一遍，因为 macOS 截图 / 部分相机把扩展名给成 .jpeg
            // 而 accept="image/jpeg" 在某些浏览器下并不接受 .jpeg 的文件。
            accept="image/*,.jpg,.jpeg,.png,.gif,.webp,.avif"
            onChange={handleFile}
            disabled={uploading}
            className="sr-only"
            id="cover-image-input"
          />
          <label
            htmlFor="cover-image-input"
            className={cn(
              "flex w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed bg-muted/30 px-4 py-8 text-sm text-muted-foreground transition-colors",
              "hover:bg-muted/50 hover:border-foreground/30",
              uploading && "pointer-events-none opacity-50"
            )}
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                上传中...
              </>
            ) : (
              <>
                <ImagePlus className="h-4 w-4" />
                点此上传封面图
              </>
            )}
          </label>
        </div>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
      <p className="text-xs text-muted-foreground">
        支持 JPG/PNG/GIF/WebP/AVIF，最大 100MB
      </p>
    </div>
  );
}
