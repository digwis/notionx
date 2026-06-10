// Public surface for the @vinext/foundation/admin/pages subpath.
//
// The package ships the generic admin page implementations
// (dashboard, users, settings, account, content-models) and the
// shared `DeleteButton` and `Loading` placeholders. The starter
// re-exports the default export from its own `app/admin/<page>/page.tsx`
// files, passing in a `context` with UI primitives, server actions,
// and data-fetching helpers.

export { default as DashboardPage } from "./dashboard";
export type { AdminDashboardPageProps } from "./dashboard";

export { default as UsersPage } from "./users";
export type { AdminUsersPageProps } from "./users";

export { default as SettingsPage } from "./settings";
export type { AdminSettingsPageProps } from "./settings";

export { default as AccountPage } from "./account";
export type { AdminAccountPageProps } from "./account";

export { default as ContentModelsPage } from "./content-models";
export type { AdminContentModelsPageProps } from "./content-models";

export { default as DeleteButton } from "./delete-button";
export type { AdminDeleteButtonProps } from "./delete-button";

export { default as DeleteButtonLazy } from "./delete-button-lazy";
export type { AdminDeleteButtonLazyProps } from "./delete-button-lazy";

export { default as LoadingPage } from "./loading";
export type { AdminLoadingPageProps } from "./loading";

export type {
  AdminFormAction,
  AdminPageUI,
  AdminPageActions,
  AdminPageData,
  AdminPageContext,
  ContentModelAdminSummary,
} from "./types";
