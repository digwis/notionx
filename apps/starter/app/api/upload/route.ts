// POST /api/upload - 认证后管理员上传文件到 R2
// 接受 multipart form data，返回 JSON { url, key, size, contentType }

import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { uploadFile } from "@vinext/foundation/storage";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  // 1. 鉴权（必须是已登录 admin）
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. 解析 form
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Invalid multipart form" },
      { status: 400 }
    );
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: 'Missing "file" field' },
      { status: 400 }
    );
  }

  // 3. 上传到 R2
  try {
    const result = await uploadFile(file, "uploads");
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
