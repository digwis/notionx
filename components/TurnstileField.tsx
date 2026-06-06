"use client";

import { useEffect, useRef, useState } from "react";
import {
  getTurnstileFriendlyMessage,
  mountTurnstileWidget,
} from "@/lib/turnstile-client.js";

type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      action?: string;
      theme?: "light" | "dark" | "auto";
      callback?: (token: string) => void;
      "error-callback"?: (code?: string) => void;
      "expired-callback"?: () => void;
    }
  ) => string;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_ID = "cf-turnstile-api";
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js";

function loadTurnstileScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.turnstile) return Promise.resolve();

  const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("turnstile load failed")), {
        once: true,
      });
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("turnstile load failed"));
    document.head.appendChild(script);
  });
}

type Props = {
  siteKey: string;
  action?: string;
};

/** Renders a Turnstile widget inside the parent <form>. */
export function TurnstileField({ siteKey, action = "auth" }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let widgetId: string | null = null;
    let cancelled = false;

    setErrorMessage(null);

    if (!containerRef.current) return;

    mountTurnstileWidget({
      container: containerRef.current,
      siteKey,
      action,
      loadScript: loadTurnstileScript,
      getTurnstileApi: () => window.turnstile,
    })
      .then((nextWidgetId) => {
        if (cancelled) return;
        widgetId = nextWidgetId;
        setErrorMessage(null);
      })
      .catch((error) => {
        if (cancelled) return;
        console.error("[turnstile] widget mount failed", error);
        setErrorMessage(getTurnstileFriendlyMessage(error));
      });

    return () => {
      cancelled = true;
      setErrorMessage(null);
      if (widgetId && window.turnstile) {
        try {
          window.turnstile.remove(widgetId);
        } catch {
          // ignore cleanup errors
        }
      }
    };
  }, [siteKey, action]);

  return (
    <div className="space-y-2">
      <div
        ref={containerRef}
        className="cf-turnstile"
        data-action="turnstile-spin-v1"
      />
      {errorMessage && (
        <p
          role="alert"
          className="text-sm text-amber-700 dark:text-amber-400"
        >
          {errorMessage}
        </p>
      )}
    </div>
  );
}
