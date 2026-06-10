// Re-export of @vinext/foundation/auth/users for backward compatibility.
export {
  authenticateEmailUser,
  changeUserPassword,
  createEmailUser,
  deleteUserAccount,
  getUserByEmail,
  getUserById,
  issuePasswordResetToken,
  issueVerificationToken,
  listUsers,
  listUsersWithPostCounts,
  normalizeUserRole,
  resetPasswordWithToken,
  revokeUserSessions,
  setUserRole,
  upsertGoogleUser,
  userToSession,
  verifyEmailUser,
} from "@vinext/foundation/auth/users";
export type { User, UserRole, UserListItem } from "@vinext/foundation/auth/users";
