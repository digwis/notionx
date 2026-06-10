"use client";

import { useEffect, useState } from "react";

export type ClientAuthViewerState =
  | { status: "loading" }
  | { status: "guest" }
  | { status: "error" }
  | {
      status: "authenticated";
      email: string;
      role: "user" | "vip" | "admin";
      isAdmin: boolean;
      isVip: boolean;
      canViewVipContent: boolean;
      user: {
        name: string | null;
        picture: string | null;
      } | null;
    };

type ViewerResponse =
  | {
      ok: true;
      email: string;
      role: "user" | "vip" | "admin";
      isAdmin: boolean;
      isVip: boolean;
      canViewVipContent: boolean;
      user: {
        name: string | null;
        picture: string | null;
      } | null;
    }
  | {
      ok: false;
      reason: "unauthenticated";
    };

let viewerCache: ClientAuthViewerState | null = null;
let viewerRequest: Promise<ClientAuthViewerState> | null = null;

async function fetchViewer(): Promise<ClientAuthViewerState> {
  try {
    const response = await fetch("/api/auth/viewer", {
      credentials: "same-origin",
      cache: "no-store",
      headers: { accept: "application/json" },
    });

    if (response.status === 401) return { status: "guest" };
    const data = (await response.json()) as ViewerResponse;
    if (!response.ok || !data.ok) return { status: "error" };

    return {
      status: "authenticated",
      email: data.email,
      role: data.role,
      isAdmin: data.isAdmin,
      isVip: data.isVip,
      canViewVipContent: data.canViewVipContent,
      user: data.user,
    };
  } catch {
    return { status: "error" };
  }
}

function loadViewer() {
  if (viewerCache) return Promise.resolve(viewerCache);
  viewerRequest ??= fetchViewer().then((state) => {
    viewerCache = state;
    viewerRequest = null;
    return state;
  });
  return viewerRequest;
}

export function useAuthViewer(): ClientAuthViewerState {
  const [viewer, setViewer] = useState<ClientAuthViewerState>(
    viewerCache ?? { status: "loading" }
  );

  useEffect(() => {
    let cancelled = false;
    loadViewer().then((state) => {
      if (!cancelled) setViewer(state);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return viewer;
}
