import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { contentSources, blogSource } from "@/lib/content/models";
import { siteConfig } from "@/lib/site/config";
import { changePasswordAction } from "./actions";
import {
  getAuthViewer,
  getCurrentUser,
  getUserById,
} from "@notionx/core/auth";
import { getContentModelAdminSummaries } from "@notionx/core/content";
import {
  getNotionEditBaseUrl,
  listGenericNotionContent,
} from "@notionx/core/notion";
import type { AdminPageContext } from "@notionx/core/admin/pages";
import { getAppSettings, isAdminEmail } from "@notionx/core/internal-admin";
import { getSiteUrl, workerEnv } from "@notionx/core/util";
import { cn } from "@/lib/utils";

function Table({ children }: { children: ReactNode }) {
  return (
    <div className="w-full overflow-auto">
      <table className="w-full caption-bottom text-sm">{children}</table>
    </div>
  );
}

function TableHeader({ children }: { children: ReactNode }) {
  return <thead className="[&_tr]:border-b">{children}</thead>;
}

function TableBody({ children }: { children: ReactNode }) {
  return <tbody className="[&_tr:last-child]:border-0">{children}</tbody>;
}

function TableRow({ children }: { children: ReactNode }) {
  return (
    <tr className="border-b transition-colors hover:bg-muted/50">
      {children}
    </tr>
  );
}

function TableHead({
  className,
  children,
}: {
  className?: string;
  children?: ReactNode;
}) {
  return (
    <th
      className={cn(
        "h-10 px-4 text-left align-middle font-medium text-muted-foreground",
        className
      )}
    >
      {children}
    </th>
  );
}

function TableCell({
  className,
  children,
  colSpan,
}: {
  className?: string;
  children?: ReactNode;
  colSpan?: number;
}) {
  return (
    <td className={cn("p-4 align-middle", className)} colSpan={colSpan}>
      {children}
    </td>
  );
}

function Alert({
  variant,
  className,
  children,
}: {
  variant?: "default" | "destructive";
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-md border px-4 py-3 text-sm",
        variant === "destructive"
          ? "border-destructive/50 text-destructive"
          : "border-border",
        className
      )}
      role="alert"
    >
      {children}
    </div>
  );
}

function AlertTitle({ children }: { children: ReactNode }) {
  return <div className="mb-1 font-medium leading-none">{children}</div>;
}

function AlertDescription({ children }: { children: ReactNode }) {
  return <div className="text-sm opacity-90">{children}</div>;
}

function Passthrough({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

async function getNotionPostsMeta() {
  const items = await listGenericNotionContent(blogSource);
  return items.map((item) => ({
    slug: item.slug,
    title: item.title,
    author: "Notion",
    date: item.date,
    tags: item.tags,
    editUrl: item.editUrl,
  }));
}

async function getAdminViewer() {
  const viewer = await getAuthViewer();
  if (!viewer) return null;
  return {
    viewer: { email: viewer.email },
    viewerEmail: viewer.email,
    admin: viewer.isAdmin,
  };
}

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
      Table,
      TableHeader,
      TableBody,
      TableRow,
      TableHead,
      TableCell,
      Alert,
      AlertTitle,
      AlertDescription,
      Separator: Separator as AdminPageContext["ui"]["Separator"],
      Skeleton: Skeleton as AdminPageContext["ui"]["Skeleton"],
      AlertDialog: Passthrough,
      AlertDialogTrigger: Passthrough,
      AlertDialogContent: Passthrough,
      AlertDialogHeader: Passthrough,
      AlertDialogTitle: Passthrough,
      AlertDialogDescription: Passthrough,
      AlertDialogFooter: Passthrough,
      AlertDialogAction: Passthrough,
      AlertDialogCancel: Passthrough,
    },
    actions: {
      changePassword: changePasswordAction,
    },
    data: {
      getNotionPostsMeta,
      getNotionEditBaseUrl,
      getAdminViewer,
      isAdminEmail,
      getCurrentUser,
      getAppSettings,
      getSiteUrl,
      workerEnv: { TURNSTILE_SECRET_KEY: workerEnv.TURNSTILE_SECRET_KEY },
      getUserById,
      getContentModelAdminSummaries: () =>
        getContentModelAdminSummaries(contentSources),
    },
    extra: {
      siteName: siteConfig.name,
    },
  };
}
