export async function mountTurnstileWidget({
  container,
  siteKey,
  action,
  loadScript,
  getTurnstileApi,
  renderOptions = {},
}) {
  await loadScript();
  const api = getTurnstileApi();
  if (!api) {
    throw new Error("Turnstile API unavailable after script load");
  }

  return api.render(container, {
    sitekey: siteKey,
    action,
    theme: "auto",
    ...renderOptions,
  });
}

export function getTurnstileFriendlyMessage(error) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (message.includes("load failed")) {
    return "人机验证加载失败，请关闭拦截插件后刷新重试。";
  }
  if (message.includes("API unavailable")) {
    return "人机验证初始化失败，请刷新页面后重试。";
  }
  return "人机验证暂时不可用，请稍后刷新重试。";
}
