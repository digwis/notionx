// Reusable Notion credential resolution. Extracted from provision()
// so that `notionx locale add --with-notion` can reuse the same
// env var → ntn keychain → interactive prompt chain.

import type { AnswersContentField } from "../prompt.js";
import { readNtnToken } from "./ntn-credentials.js";
import { promptNotion, type PromptContext } from "./prompts.js";
import { verifyNotionToken } from "./notion.js";

export type ResolvedNotionCredentials = {
  apiToken: string;
  parentPageId: string;
};

export type ResolveNotionCredentialsOptions = {
  /**
   * Pre-supplied API token (e.g. from `--notion-token` flag).
   * When provided, skips env var and keychain lookup.
   */
  apiToken?: string;
  /**
   * Pre-supplied parent page id (e.g. from `--notion-parent-page` flag).
   */
  parentPageId?: string;
  /**
   * When true, skip interactive prompts and return null if
   * credentials can't be resolved non-interactively.
   */
  nonInteractive?: boolean;
  /**
   * Content source field definitions forwarded to `promptNotion` when
   * the interactive prompt is reached. Required only when prompting
   * is possible (i.e. `nonInteractive` is false/undefined).
   */
  fields?: AnswersContentField[];
  /**
   * Number of sample rows to seed. Forwarded to `promptNotion`.
   * Defaults to 6 (matching `promptNotion`'s own default).
   */
  seedCount?: number;
};

/**
 * Resolve Notion API token and parent page id for operations that
 * need to create databases (provision, locale add).
 *
 * Resolution order for apiToken:
 *   1. options.apiToken (explicit flag)
 *   2. process.env.NOTION_API_TOKEN
 *   3. ntn keychain (readNtnToken)
 *   4. Interactive: promptNotion (collects token + parent page)
 *
 * Resolution order for parentPageId:
 *   1. options.parentPageId (explicit flag)
 *   2. Interactive: promptNotion
 *
 * `promptNotion` collects both the token (when not pre-supplied) and
 * the parent page id in a single call, so it is invoked at most once.
 *
 * Returns null when nonInteractive is true and credentials can't be
 * resolved without prompting, or when an resolved token fails
 * verification.
 */
export async function resolveNotionCredentials(
  options: ResolveNotionCredentialsOptions = {},
): Promise<ResolvedNotionCredentials | null> {
  const interactive = !options.nonInteractive;

  // --- apiToken ---
  let apiToken: string | undefined =
    options.apiToken ?? process.env.NOTION_API_TOKEN?.trim();

  if (!apiToken) {
    const ntnCred = await readNtnToken();
    if (ntnCred?.token) {
      apiToken = ntnCred.token;
    }
  }

  // Verify any token we resolved non-interactively. verifyNotionToken
  // returns true on success and throws on failure; a bad token should
  // not silently fall through to the interactive prompt.
  if (apiToken) {
    try {
      await verifyNotionToken(apiToken);
    } catch {
      return null;
    }
  }

  // --- parentPageId ---
  const parentPageId: string | undefined = options.parentPageId;

  // Fast path: both resolved without prompting.
  if (apiToken && parentPageId) {
    return { apiToken, parentPageId };
  }

  // Can't prompt → can't fill in the missing piece.
  if (!interactive) return null;

  // Interactive: promptNotion collects whatever's missing in a single
  // call. When we already have a verified token, pass it as
  // preloadedToken so only the parent page is prompted.
  const ctx: PromptContext = { interactive: true };
  const result = await promptNotion(
    ctx,
    options.fields ?? [],
    apiToken,
    options.seedCount ?? 6,
  );
  if (!result) return null;

  return { apiToken: result.apiToken, parentPageId: result.parentPageId };
}
