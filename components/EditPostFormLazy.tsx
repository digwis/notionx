"use client";

import dynamic from "next/dynamic";

const EditPostForm = dynamic(() => import("@/components/EditPostForm"), {
  ssr: false,
  loading: () => (
    <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
      正在加载编辑器...
    </div>
  ),
});

export default EditPostForm;
