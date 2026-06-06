export const ADMIN_LIST_COLUMNS = [
  "slug",
  "title",
  "description",
  "date",
  "author",
  "tags",
  "cover_image",
  "owner_email",
  "status",
  "reject_reason",
  "reviewed_by",
  "reviewed_at",
] as const;

export function getAdminListColumns() {
  return ADMIN_LIST_COLUMNS;
}

export function getAdminListSelectClause() {
  return ADMIN_LIST_COLUMNS.join(", ");
}
