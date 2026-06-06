import test from "node:test";
import assert from "node:assert/strict";

import {
  getTurnstileFriendlyMessage,
  mountTurnstileWidget,
} from "./turnstile-client.js";

test("mountTurnstileWidget renders widget with expected options", async () => {
  let rendered = null;
  const api = {
    render(container, options) {
      rendered = { container, options };
      return "widget-1";
    },
  };
  const container = { nodeType: 1 };

  const widgetId = await mountTurnstileWidget({
    container,
    siteKey: "site-key",
    action: "register",
    loadScript: async () => {},
    getTurnstileApi: () => api,
  });

  assert.equal(widgetId, "widget-1");
  assert.deepEqual(rendered, {
    container,
    options: {
      sitekey: "site-key",
      action: "register",
      theme: "auto",
    },
  });
});

test("mountTurnstileWidget throws when API is unavailable after script load", async () => {
  await assert.rejects(
    () =>
      mountTurnstileWidget({
        container: {},
        siteKey: "site-key",
        action: "login",
        loadScript: async () => {},
        getTurnstileApi: () => undefined,
      }),
    /Turnstile API unavailable/
  );
});

test("getTurnstileFriendlyMessage returns actionable fallback text", () => {
  assert.match(
    getTurnstileFriendlyMessage(new Error("turnstile load failed")),
    /关闭拦截插件/
  );
  assert.match(
    getTurnstileFriendlyMessage(new Error("Turnstile API unavailable after script load")),
    /刷新页面/
  );
});
