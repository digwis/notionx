// Public surface for the @vinext/foundation/auth-pages subpath.
//
// The package ships the React Server Component implementations of
// `/login`, `/register`, `/forgot-password`, and `/reset-password`.
// Consuming apps re-export the default export from their own
// `app/<page>/page.tsx` files, passing in the UI primitives, server
// actions, and any custom context. The package never imports
// project-specific UI components; instead, they are injected via the
// `ui` prop on every page.

export { default as LoginPage } from "./login";
export type { LoginPageProps } from "./login";
export { default as RegisterPage } from "./register";
export type { RegisterPageProps } from "./register";
export { default as ForgotPasswordPage } from "./forgot-password";
export type { ForgotPasswordPageProps } from "./forgot-password";
export { default as ResetPasswordPage } from "./reset-password";
export type { ResetPasswordPageProps } from "./reset-password";

export type {
  AuthPageUI,
  AuthPageContext,
  FormAction,
  TurnstileSlot,
} from "./types";
