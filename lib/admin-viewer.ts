import { cache } from "react";
import { getCurrentUser } from "./auth";
import { isAdminEmail } from "./admin";

export const getAdminViewer = cache(async () => {
  const user = await getCurrentUser();
  const viewerEmail = user?.email.toLowerCase() ?? "";
  const admin = viewerEmail ? await isAdminEmail(viewerEmail) : false;

  return {
    user,
    viewerEmail,
    admin,
  };
});
