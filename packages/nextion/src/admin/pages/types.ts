// admin/pages/types.ts
//
// Shared types for the generic admin pages. The package ships the
// page layouts and rendering logic; consuming apps supply their own
// UI primitives (Button, Card, Table, etc.), server actions, and any
// custom data-fetching helpers via the `context` prop.

import type { ReactNode } from "react";

/** A server action the page form submits to. */
export type AdminFormAction = (formData: FormData) => Promise<void> | void;

/** Bundle of UI primitives used by every admin page. */
export interface AdminPageUI {
  Button: (props: {
    type?: "button" | "submit" | "reset";
    asChild?: boolean;
    variant?:
      | "default"
      | "outline"
      | "secondary"
      | "ghost"
      | "destructive"
      | "link";
    size?: "default" | "sm" | "lg" | "icon";
    className?: string;
    children?: ReactNode;
  }) => ReactNode;
  Input: (props: {
    id?: string;
    name: string;
    type?: string;
    placeholder?: string;
    defaultValue?: string;
    required?: boolean;
    autoComplete?: string;
    maxLength?: number;
    className?: string;
  }) => ReactNode;
  Label: (props: {
    htmlFor: string;
    children: ReactNode;
    className?: string;
  }) => ReactNode;
  Card: (props: { className?: string; children: ReactNode }) => ReactNode;
  CardHeader: (props: { className?: string; children: ReactNode }) => ReactNode;
  CardTitle: (props: { className?: string; children: ReactNode }) => ReactNode;
  CardDescription: (props: {
    className?: string;
    children: ReactNode;
  }) => ReactNode;
  CardContent: (props: {
    className?: string;
    children: ReactNode;
  }) => ReactNode;
  Badge: (props: {
    variant?: "default" | "secondary" | "destructive" | "outline";
    className?: string;
    children?: ReactNode;
  }) => ReactNode;
  Table: (props: { children: ReactNode }) => ReactNode;
  TableHeader: (props: { children: ReactNode }) => ReactNode;
  TableBody: (props: { children: ReactNode }) => ReactNode;
  TableRow: (props: { children: ReactNode }) => ReactNode;
  TableHead: (props: {
    className?: string;
    children?: ReactNode;
  }) => ReactNode;
  TableCell: (props: {
    className?: string;
    children?: ReactNode;
    colSpan?: number;
  }) => ReactNode;
  Alert: (props: {
    variant?: "default" | "destructive";
    className?: string;
    children: ReactNode;
  }) => ReactNode;
  AlertTitle: (props: { children: ReactNode }) => ReactNode;
  AlertDescription: (props: { children: ReactNode }) => ReactNode;
  Separator: (props: {
    orientation?: "horizontal" | "vertical";
    className?: string;
  }) => ReactNode;
  Skeleton: (props: { className?: string }) => ReactNode;
  // AlertDialog primitives used by the DeleteButton page.
  AlertDialog: (props: {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    children: ReactNode;
  }) => ReactNode;
  AlertDialogTrigger: (props: {
    asChild?: boolean;
    children: ReactNode;
  }) => ReactNode;
  AlertDialogContent: (props: { children: ReactNode }) => ReactNode;
  AlertDialogHeader: (props: { children: ReactNode }) => ReactNode;
  AlertDialogTitle: (props: { children: ReactNode }) => ReactNode;
  AlertDialogDescription: (props: { children: ReactNode }) => ReactNode;
  AlertDialogFooter: (props: { children: ReactNode }) => ReactNode;
  AlertDialogAction: (props: {
    onClick?: () => void;
    className?: string;
    children: ReactNode;
  }) => ReactNode;
  AlertDialogCancel: (props: { children: ReactNode }) => ReactNode;
}

/**
 * Optional mapping from action name to server action. Pages fall back
 * to a no-op form handler when the action is missing so dev environments
 * without configured actions still render.
 */
export interface AdminPageActions {
  /** Delete a content record (used by DeleteButton). */
  deletePost?: AdminFormAction;
  /** Change the current user's password (account page). */
  changePassword?: AdminFormAction;
  /** Permanently delete the current user's account. */
  deleteAccount?: AdminFormAction;
  /** Admin: revoke a user's sessions. */
  adminRevokeSessions?: AdminFormAction;
  /** Admin: delete a user. */
  adminDeleteUser?: AdminFormAction;
  /** Admin: change a user's role. */
  adminSetUserRole?: AdminFormAction;
  /** Settings: save Google OAuth config. */
  saveGoogleSettings?: AdminFormAction;
  /** Settings: disable Google login. */
  disableGoogleSettings?: AdminFormAction;
  /** Settings: save site title. */
  saveSiteTitle?: AdminFormAction;
  /** Settings: save Turnstile config. */
  saveTurnstileSettings?: AdminFormAction;
  /** Settings: disable Turnstile. */
  disableTurnstileSettings?: AdminFormAction;
}

/**
 * Helpers that fetch data needed by admin pages. The package never
 * imports project-specific helpers; each page receives them through
 * this context.
 */
export interface AdminPageData {
  // -- Dashboard --
  /** Fetch the public index of blog posts for the admin dashboard. */
  getNotionPostsMeta?: () => Promise<
    Array<{
      slug: string;
      title: string;
      author: string;
      date: string;
      tags: string[];
      editUrl?: string | null;
    }>
  >;
  /** URL the admin can open in a new tab to author posts in Notion. */
  getNotionEditBaseUrl?: () => string;

  // -- Users --
  /** Resolves the current admin viewer. */
  getAdminViewer?: () => Promise<{
    viewer?: { email: string } | null;
    viewerEmail: string;
    admin: boolean;
  } | null>;
  /** List all users with their post counts. */
  listUsersWithPostCounts?: () => Promise<
    Array<{
      id: number;
      email: string;
      role: string | null;
      google_sub: string | null;
      password_hash: string | null;
      post_count: number;
      last_seen_at: string;
    }>
  >;

  // -- Settings --
  /** Check if an email matches the configured admin email. */
  isAdminEmail?: (email: string) => Promise<boolean>;
  /** Ensure the admin user row exists in the database. */
  ensureAdminBootstrap?: () => Promise<void>;
  /** Get the currently authenticated user. */
  getCurrentUser?: () => Promise<{ uid: number; email: string } | null>;
  /** Get the row from the `app_settings` table. */
  getAppSettings?: () => Promise<{
    admin_email: string;
    site_title: string;
    google_enabled: 0 | 1;
    google_client_id: string | null;
    google_client_secret: string | null;
    turnstile_enabled: 0 | 1;
    turnstile_site_key: string | null;
  }>;
  /** Get Turnstile config (public-only fields). */
  getTurnstilePublicConfig?: () => Promise<{
    enabled: boolean;
    secretConfigured: boolean;
  }>;
  /** Compute the canonical site URL for callbacks and emails. */
  getSiteUrl?: () => string;
  /** Read the TURNSTILE_SECRET_KEY env var (true if set). */
  workerEnv?: { TURNSTILE_SECRET_KEY?: string };

  // -- Account --
  /** Look up a user by primary key. */
  getUserById?: (id: number) => Promise<{
    id: number;
    email: string;
    password_hash: string | null;
    google_sub: string | null;
  } | null>;

  // -- Content models --
  /** Summary of every content model the project registers. */
  getContentModelAdminSummaries?: () => Array<ContentModelAdminSummary>;
}

/** Summary record for a single content model. */
export interface ContentModelAdminSummary {
  id: string;
  name: string;
  kind: string;
  visibility: "public" | "admin" | "public+admin" | "private";
  listPath: string;
  detailPath: string;
  publicApiPath?: string;
  dataSourceEnv: string;
  hasDefaultDataSource: boolean;
  fieldCount: number;
  capabilities: {
    richBlocks: boolean;
    coverImages: boolean;
    gatedAssets: boolean;
  };
}

/** Common props every admin page receives. */
export interface AdminPageContext {
  ui: AdminPageUI;
  actions?: AdminPageActions;
  data?: AdminPageData;
  /**
   * Extra props to pass through to the page body. Useful for tests
   * and for projects that need to thread custom data into a page.
   */
  extra?: Record<string, unknown>;
}
