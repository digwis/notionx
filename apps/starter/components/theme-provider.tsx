"use client";

// shadcn 标准 ThemeProvider：包装 next-themes，
// 让根 layout 用 .class 作为 theme attribute（与 Tailwind v4 的 .dark 类匹配）。

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
