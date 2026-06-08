import { cache } from "react";
import { getAuthViewer } from "./auth";

export const getAdminViewer = cache(async () => {
  const viewer = await getAuthViewer();
  const viewerEmail = viewer?.email.toLowerCase() ?? "";

  return {
    user: viewer?.user ?? null,
    viewerEmail,
    admin: Boolean(viewer?.isAdmin),
    viewer,
  };
});
