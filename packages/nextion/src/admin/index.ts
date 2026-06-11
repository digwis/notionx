// Public admin surface. Re-exports the nav factory, the React shell
// components, and the shared `AdminNavItem` type. The page modules
// (dashboard, users, settings, account, content-models, etc.) live
// in `./pages` and are exposed via the `@notionx/core/admin/pages`
// subpath.

export type { AdminNavItem } from "../types";
export {
  createAdminNav,
  type AdminNavOptions,
} from "./nav";
export {
  AdminShell,
  AdminHeader,
  AdminSidebar,
  type AdminShellProps,
  type AdminShellViewer,
  type AdminShellUI,
} from "./shell";
export { AdminLayout, type AdminLayoutProps } from "./layout";
export type {
  AdminSidebarProps,
  AdminSidebarLinkRenderer,
  AdminSidebarLinkRenderProps,
} from "./sidebar";
export type { AdminHeaderProps } from "./header";
