"use client";

// 主题切换按钮：按当前实际显示效果在 light / dark 之间直接切换。
// 配合 components/theme-provider.tsx 使用。

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  getThemeToggleDisabled,
  nextExplicitTheme,
} from "@/components/theme-toggle-state";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  // 避免 hydration mismatch：服务器渲染时只显示一个静态图标
  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="icon"
        aria-label="切换主题"
        disabled={getThemeToggleDisabled(mounted)}
      >
        <Sun className="h-4 w-4" />
      </Button>
    );
  }

  const toggle = () => {
    setTheme(nextExplicitTheme(resolvedTheme));
  };

  return (
    <Button variant="ghost" size="icon" onClick={toggle} aria-label="切换主题">
      {resolvedTheme === "dark" ? (
        <Moon className="h-4 w-4" />
      ) : (
        <Sun className="h-4 w-4" />
      )}
    </Button>
  );
}
