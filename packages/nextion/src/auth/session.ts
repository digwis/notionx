// Session user shape used by both admin-password and OAuth (Google) cookies.
// Mirrors the D1 `users` row that the auth helpers need to hydrate a viewer.

export type SessionUser = {
  uid: number;
  email: string;
  name: string | null;
  picture: string | null;
  rev: number;
};
