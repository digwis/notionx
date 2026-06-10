"use client";

import dynamic from "next/dynamic";

// 订阅表单懒加载 wrapper。
//
// 原因：当前版本 next/dynamic 的 ssr:false 不能直接在 Server Component 里使用。
// 把它包在一层 "use client" 组件里，就可以把 SubscribeForm 真正延后到客户端再加载，
// 减小首屏 JS bundle 和 hydration 成本。
const SubscribeForm = dynamic(
  () => import("@/components/SubscribeForm"),
  { ssr: false }
);

export default function SubscribeFormLazy() {
  return <SubscribeForm />;
}
