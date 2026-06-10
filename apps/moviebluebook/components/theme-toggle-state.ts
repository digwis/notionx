export function getThemeToggleDisabled(mounted: boolean) {
  return !mounted;
}

export function nextExplicitTheme(resolvedTheme: string | undefined) {
  return resolvedTheme === "dark" ? "light" : "dark";
}
