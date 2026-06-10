// apps/moviebluebook/lib/admin/nav.ts
//
// Sidebar navigation for `/admin/*`. The package's `createAdminNav`
// factory sorts items by `order` and filters out any that require a
// role the viewer does not have. The shell renders the items in the
// order returned here.

import { createAdminNav } from "@vinext/foundation/admin";

export const adminNav = createAdminNav([
  { href: "/admin", labelKey: "admin.nav.dashboard", icon: "Home", order: 10 },
  {
    href: "/admin/content-models",
    labelKey: "admin.nav.models",
    icon: "Database",
    order: 20,
  },
  {
    href: "/admin/review",
    labelKey: "admin.nav.review",
    icon: "Inbox",
    order: 30,
  },
  {
    href: "/admin/users",
    labelKey: "admin.nav.users",
    icon: "Users",
    requireRole: "admin",
    order: 40,
  },
  {
    href: "/admin/settings",
    labelKey: "admin.nav.settings",
    icon: "Settings",
    requireRole: "admin",
    order: 50,
  },
  {
    href: "/admin/account",
    labelKey: "admin.nav.account",
    icon: "User",
    order: 60,
  },
]);

export default adminNav;
