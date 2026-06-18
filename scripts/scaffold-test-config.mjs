export const SCAFFOLD_TEST_NAME = "scaffold-test";
export const SCAFFOLD_TEST_DIR = "apps/scaffold-test";
export const SCAFFOLD_TEST_STARTER = "blog";
export const SCAFFOLD_TEST_NOTION_RESOURCE_ID =
  "8407e9c8-d910-42e7-8344-617fffc23f77";
export const SCAFFOLD_TEST_NOTION_REQUIRED_FIELDS = ["Name", "Slug"];
export const SCAFFOLD_TEST_ADMIN_PASSWORD_HASH =
  "pbkdf2_sha256$100000$47mBfS2nN4eVzhXV8GnKkQ==$0CLTuNnOT7D7hm+Gn/Yr9MkU4L5SSTlCP28ykoJD+4U=";

export const SCAFFOLD_TEST_ARGS = [
  "--starter",
  SCAFFOLD_TEST_STARTER,
  "--project-name",
  SCAFFOLD_TEST_NAME,
  "--target-dir",
  SCAFFOLD_TEST_DIR,
  "--admin-email",
  "admin@example.com",
  "--admin-password",
  "Password123",
  "--default-locale",
  "en",
  "--supported-locales",
  "en",
  "--yes",
];
