"use client";

import { useEffect, useState } from "react";
import NotionBlockRenderer from "@/components/NotionBlockRenderer";
import { Separator } from "@/components/ui/separator";
import type { NotionBlock } from "@/lib/notion/types";

type MovieBlocksResponse =
  | {
      blocks?: NotionBlock[];
    }
  | {
      error: string;
    };

export function MovieBlocksPanel({ movieId }: { movieId: string }) {
  const [blocks, setBlocks] = useState<NotionBlock[] | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      try {
        const response = await fetch(`/api/movies/${movieId}`, {
          headers: { accept: "application/json" },
          signal: controller.signal,
        });
        if (!response.ok) return;
        const data = (await response.json()) as MovieBlocksResponse;
        if ("blocks" in data && Array.isArray(data.blocks)) {
          setBlocks(data.blocks);
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setBlocks([]);
        }
      }
    };

    const win = window as typeof window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };

    if (win.requestIdleCallback) {
      const idleId = win.requestIdleCallback(load, { timeout: 800 });
      return () => {
        controller.abort();
        win.cancelIdleCallback?.(idleId);
      };
    }

    const timer = window.setTimeout(load, 120);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [movieId]);

  if (!blocks || blocks.length === 0) return null;

  return (
    <>
      <Separator className="my-8" />
      <NotionBlockRenderer blocks={blocks} />
    </>
  );
}
