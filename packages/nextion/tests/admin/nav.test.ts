import { describe, it, expect } from "vitest";
import { createAdminNav } from "../../src/admin/nav";

describe("createAdminNav", () => {
  it("sorts items by order then labelKey", () => {
    const nav = createAdminNav([
      { href: "/admin/c", labelKey: "admin.c", order: 3 },
      { href: "/admin/a", labelKey: "admin.a", order: 1 },
      { href: "/admin/b", labelKey: "admin.b", order: 1 },
    ]);
    expect(nav.map((n) => n.href)).toEqual(["/admin/a", "/admin/b", "/admin/c"]);
  });

  it("filters items requiring a role the viewer lacks", () => {
    const nav = createAdminNav(
      [
        { href: "/admin/users", labelKey: "users", requireRole: "admin" },
        { href: "/admin", labelKey: "home" },
      ],
      { roles: ["user"] }
    );
    expect(nav.map((n) => n.href)).toEqual(["/admin"]);
  });
});
