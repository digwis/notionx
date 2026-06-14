// Theme bootstrap: read the data-attributes set by the root layout
// and inject the matching CSS custom properties. Rendered once in
// the root layout (see `app/layout.tsx`). The 8 color palettes are
// hard-coded here so the scaffolder ships without a runtime theme
// resolution pass — operators pick a palette in Notion, the next
// page load applies it.

"use client";

import { useEffect } from "react";

const PRIMARY_PALETTES: Record<string, Record<number, string>> = {
  slate: { 50: "#f8fafc", 100: "#f1f5f9", 200: "#e2e8f0", 300: "#cbd5e1", 400: "#94a3b8", 500: "#64748b", 600: "#475569", 700: "#334155", 800: "#1e293b", 900: "#0f172a" },
  gray: { 50: "#f9fafb", 100: "#f3f4f6", 200: "#e5e7eb", 300: "#d1d5db", 400: "#9ca3af", 500: "#6b7280", 600: "#4b5563", 700: "#374151", 800: "#1f2937", 900: "#111827" },
  zinc: { 50: "#fafafa", 100: "#f4f4f5", 200: "#e4e4e7", 300: "#d4d4d8", 400: "#a1a1aa", 500: "#71717a", 600: "#52525b", 700: "#3f3f46", 800: "#27272a", 900: "#18181b" },
  red: { 50: "#fef2f2", 100: "#fee2e2", 200: "#fecaca", 300: "#fca5a5", 400: "#f87171", 500: "#ef4444", 600: "#dc2626", 700: "#b91c1c", 800: "#991b1b", 900: "#7f1d1d" },
  orange: { 50: "#fff7ed", 100: "#ffedd5", 200: "#fed7aa", 300: "#fdba74", 400: "#fb923c", 500: "#f97316", 600: "#ea580c", 700: "#c2410c", 800: "#9a3412", 900: "#7c2d12" },
  amber: { 50: "#fffbeb", 100: "#fef3c7", 200: "#fde68a", 300: "#fcd34d", 400: "#fbbf24", 500: "#f59e0b", 600: "#d97706", 700: "#b45309", 800: "#92400e", 900: "#78350f" },
  green: { 50: "#f0fdf4", 100: "#dcfce7", 200: "#bbf7d0", 300: "#86efac", 400: "#4ade80", 500: "#22c55e", 600: "#16a34a", 700: "#15803d", 800: "#166534", 900: "#14532d" },
  blue: { 50: "#eff6ff", 100: "#dbeafe", 200: "#bfdbfe", 300: "#93c5fd", 400: "#60a5fa", 500: "#3b82f6", 600: "#2563eb", 700: "#1d4ed8", 800: "#1e40af", 900: "#1e3a8a" },
};

const FONT_FAMILIES: Record<string, string> = {
  inter: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
  geist: "Geist, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
  system: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
};

export function ThemeBootstrap() {
  useEffect(() => {
    const root = document.documentElement;
    const primary = root.dataset.themePrimary ?? "slate";
    const accent = root.dataset.themeAccent ?? "blue";
    const font = root.dataset.themeFont ?? "inter";

    const palette = PRIMARY_PALETTES[primary] ?? PRIMARY_PALETTES.slate;
    for (const [shade, color] of Object.entries(palette)) {
      root.style.setProperty(`--theme-primary-${shade}`, color);
    }
    const accentPalette = PRIMARY_PALETTES[accent] ?? PRIMARY_PALETTES.blue;
    for (const [shade, color] of Object.entries(accentPalette)) {
      root.style.setProperty(`--theme-accent-${shade}`, color);
    }
    root.style.setProperty(
      "--theme-font",
      FONT_FAMILIES[font] ?? FONT_FAMILIES.inter
    );
  }, []);

  return null;
}
