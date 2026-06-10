// apps/starter/lib/admin/context.tsx
//
// Builds the `AdminPageContext` consumed by the package's generic
// admin pages. The package's pages are unopinionated about design
// systems and helper locations; this file is the single point that
// wires the starter's shadcn UI primitives, server actions, and
// data helpers into a `context` object that the package can render.

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import { getAdminViewer } from "@/lib/admin-viewer";
import { listUsersWithPostCounts, getUserById } from "@/lib/users";
import { isAdminEmail } from "@/lib/admin";
import { ensureAdminBootstrap } from "@/lib/bootstrap";
import { getCurrentUser } from "@/lib/auth";
import { getAppSettings, getTurnstilePublicConfig } from "@/lib/settings";
import { getSiteUrl } from "@/lib/site-url";
import { workerEnv } from "@/lib/env";
import { getContentModelAdminSummaries } from "@/lib/content/admin-summary";
import { getNotionPostsMeta } from "@/lib/notion/posts";
import { getNotionEditBaseUrl } from "@/lib/notion/config";
import {
  adminDeleteUserAction,
  adminRevokeSessionsAction,
  adminSetUserRoleAction,
  changePasswordAction,
  deleteAccountAction,
  deletePostAction,
} from "@/lib/actions";
import {
  disableGoogleSettingsAction,
  disableTurnstileSettingsAction,
  saveGoogleSettingsAction,
  saveSiteTitleAction,
  saveTurnstileSettingsAction,
} from "@/app/admin/settings/actions";

import type { AdminPageContext } from "@vinext/foundation/admin/pages";

/**
 * Returns a fully populated `AdminPageContext` whose `ui` slot
 * points at the starter's shadcn primitives, whose `actions` slot
 * points at the starter's server actions, and whose `data` slot
 * wires the starter's data helpers.
 */
export function buildAdminPageContext(): AdminPageContext {
  return {
    ui: {
      Button: Button as AdminPageContext["ui"]["Button"],
      Input: Input as AdminPageContext["ui"]["Input"],
      Label: Label as AdminPageContext["ui"]["Label"],
      Card: Card as AdminPageContext["ui"]["Card"],
      CardHeader: CardHeader as AdminPageContext["ui"]["CardHeader"],
      CardTitle: CardTitle as AdminPageContext["ui"]["CardTitle"],
      CardDescription:
        CardDescription as AdminPageContext["ui"]["CardDescription"],
      CardContent: CardContent as AdminPageContext["ui"]["CardContent"],
      Badge: Badge as AdminPageContext["ui"]["Badge"],
      Table: Table as AdminPageContext["ui"]["Table"],
      TableHeader: TableHeader as AdminPageContext["ui"]["TableHeader"],
      TableBody: TableBody as AdminPageContext["ui"]["TableBody"],
      TableRow: TableRow as AdminPageContext["ui"]["TableRow"],
      TableHead: TableHead as AdminPageContext["ui"]["TableHead"],
      TableCell: TableCell as AdminPageContext["ui"]["TableCell"],
      Alert: Alert as AdminPageContext["ui"]["Alert"],
      AlertTitle: AlertTitle as AdminPageContext["ui"]["AlertTitle"],
      AlertDescription:
        AlertDescription as AdminPageContext["ui"]["AlertDescription"],
      Separator: Separator as AdminPageContext["ui"]["Separator"],
      Skeleton: Skeleton as AdminPageContext["ui"]["Skeleton"],
      AlertDialog: AlertDialog as AdminPageContext["ui"]["AlertDialog"],
      AlertDialogTrigger:
        AlertDialogTrigger as AdminPageContext["ui"]["AlertDialogTrigger"],
      AlertDialogContent:
        AlertDialogContent as AdminPageContext["ui"]["AlertDialogContent"],
      AlertDialogHeader:
        AlertDialogHeader as AdminPageContext["ui"]["AlertDialogHeader"],
      AlertDialogTitle:
        AlertDialogTitle as AdminPageContext["ui"]["AlertDialogTitle"],
      AlertDialogDescription:
        AlertDialogDescription as AdminPageContext["ui"]["AlertDialogDescription"],
      AlertDialogFooter:
        AlertDialogFooter as AdminPageContext["ui"]["AlertDialogFooter"],
      AlertDialogAction:
        AlertDialogAction as AdminPageContext["ui"]["AlertDialogAction"],
      AlertDialogCancel:
        AlertDialogCancel as AdminPageContext["ui"]["AlertDialogCancel"],
    },
    actions: {
      deletePost: deletePostAction,
      changePassword: changePasswordAction,
      deleteAccount: deleteAccountAction,
      adminRevokeSessions: adminRevokeSessionsAction,
      adminDeleteUser: adminDeleteUserAction,
      adminSetUserRole: adminSetUserRoleAction,
      saveGoogleSettings: saveGoogleSettingsAction,
      disableGoogleSettings: disableGoogleSettingsAction,
      saveSiteTitle: saveSiteTitleAction,
      saveTurnstileSettings: saveTurnstileSettingsAction,
      disableTurnstileSettings: disableTurnstileSettingsAction,
    },
    data: {
      getNotionPostsMeta,
      getNotionEditBaseUrl,
      getAdminViewer,
      listUsersWithPostCounts,
      isAdminEmail,
      ensureAdminBootstrap,
      getCurrentUser,
      getAppSettings,
      getTurnstilePublicConfig,
      getSiteUrl,
      workerEnv: { TURNSTILE_SECRET_KEY: workerEnv.TURNSTILE_SECRET_KEY },
      getUserById,
      getContentModelAdminSummaries,
    },
  };
}
