// auth/auth-pages/types.ts
//
// Shared types for the auth pages. The package ships the page layouts
// and validation logic; the consuming app supplies its own UI primitives
// (Button, Input, etc.) and any custom server actions.

import type { ReactNode } from "react";

/** A render-prop that draws a Turnstile widget for the given action. */
export type TurnstileSlot = (props: { action: string }) => ReactNode;

/** A server action that the page form submits to. */
export type FormAction = (formData: FormData) => Promise<void> | void;

/** Bundle of UI primitives used by every auth page. */
export interface AuthPageUI {
  Button: (props: {
    type?: "button" | "submit" | "reset";
    asChild?: boolean;
    variant?: "default" | "outline" | "secondary" | "ghost" | "destructive";
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
    autoFocus?: boolean;
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
  Separator: (props: { className?: string }) => ReactNode;
  Turnstile?: TurnstileSlot;
}

/** Common props every auth page receives. */
export interface AuthPageContext {
  ui: AuthPageUI;
  /**
   * Optional mapping from action name to server action. Pages fall back
   * to a no-op form handler when the action is missing so dev environments
   * without configured actions still render.
   */
  actions?: {
    emailLogin?: FormAction;
    register?: FormAction;
    forgotPassword?: FormAction;
    resetPassword?: FormAction;
    resendVerification?: FormAction;
  };
  /**
   * Optional helper that checks whether the user is already
   * authenticated. When provided, the page redirects to
   * `redirectWhenAuthenticated` (default `/admin`) on truthy return.
   */
  isAuthenticated?: () => Promise<boolean>;
  redirectWhenAuthenticated?: string;
  /** Get the current OAuth user, used to show "current session" hints. */
  getCurrentUser?: () => Promise<{ email: string } | null>;
  /** Get the Google OAuth config so the "Sign in with Google" button
   *  can be hidden when not configured. */
  getGoogleOAuthConfig?: () => Promise<{
    enabled: boolean;
    clientId: string;
    clientSecret: string;
  } | null>;
}
