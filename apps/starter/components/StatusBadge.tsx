import { Badge } from "@/components/ui/badge";
import type { PostStatus } from "@/lib/posts";

const labels: Record<PostStatus, { text: string; className: string }> = {
  draft: { text: "草稿", className: "bg-zinc-200 text-zinc-700" },
  pending_review: { text: "待审核", className: "bg-amber-100 text-amber-800" },
  published: { text: "已发布", className: "bg-emerald-100 text-emerald-800" },
  rejected: { text: "已拒绝", className: "bg-rose-100 text-rose-800" },
};

export default function StatusBadge({ status }: { status: PostStatus }) {
  const cfg = labels[status] ?? labels.draft;
  return <Badge className={cfg.className}>{cfg.text}</Badge>;
}
