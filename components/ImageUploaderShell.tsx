// lib/ImageUploaderShell.tsx - 服务端壳，把 ImageUploader 嵌入 Server Component 的表单
// 因为 ImageUploader 是 client component，Server Component 表单用它需要包一层

import ImageUploader from "./ImageUploader";

type Props = {
  defaultValue?: string;
  name: string; // hidden input name，submit 时会带过去
};

export default function ImageUploaderShell({ defaultValue = "", name }: Props) {
  return (
    <div className="space-y-2">
      {/* 隐藏的 input 把 URL 同步到 form 表单数据里 */}
      <ClientSyncInput name={name} defaultValue={defaultValue} />
      <ImageUploaderClient defaultValue={defaultValue} name={name} />
    </div>
  );
}

// 这两个都是 client component
import { useState } from "react";
function ClientSyncInput({ name, defaultValue }: { name: string; defaultValue: string }) {
  return <input type="hidden" name={name} defaultValue={defaultValue} />;
}

function ImageUploaderClient({ defaultValue, name }: { defaultValue: string; name: string }) {
  // 这层把 uploader 状态同步到 hidden input
  // 但 Server Component 不能在 children 里使用带 useState 的组件？
  // 解决：让 ImageUploader 内部自己管 hidden input
  return <ImageUploaderWithSync defaultValue={defaultValue} name={name} />;
}

function ImageUploaderWithSync({ defaultValue, name }: { defaultValue: string; name: string }) {
  const [value, setValue] = useState(defaultValue);
  return (
    <>
      <input type="hidden" name={name} value={value} />
      <ImageUploader value={value} onChange={setValue} />
    </>
  );
}
