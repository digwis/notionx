import { describe, it, expect } from "vitest";
import { createAuth } from "../../src/auth/auth";

describe("createAuth", () => {
  it("returns helpers bound to the configured database", () => {
    const auth = createAuth({
      databaseBinding: "DB",
      tables: {
        users: "users",
        sessions: "sessions",
        passwordResets: "password_resets",
        emailVerifications: "email_verifications",
        authRateLimits: "auth_rate_limits",
      },
      sessionCookie: { name: "session", maxAge: 3600, secure: true },
      roles: { default: "user", vip: "vip", admin: "admin" },
    });
    expect(typeof auth.requireViewer).toBe("function");
    expect(typeof auth.requireRole).toBe("function");
  });
});
