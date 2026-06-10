import { getDatabase } from "./platform/current";

export const FREE_MOVIE_VIDEO_LIMIT = 3;

export type MovieVideoAccessState =
  | {
      ok: true;
      vip: true;
      limit: null;
      used: null;
      remaining: null;
    }
  | {
      ok: true;
      vip: false;
      limit: number;
      used: number;
      remaining: number;
    }
  | {
      ok: false;
      reason: "limit_reached";
      limit: number;
      used: number;
      remaining: 0;
    };

export function currentVideoAccessPeriod(date = new Date()) {
  return date.toISOString().slice(0, 7);
}

async function countUserPeriodViews(userId: number, period: string) {
  const row = await getDatabase().prepare(
    `SELECT COUNT(*) AS count
       FROM movie_video_access
      WHERE user_id = ? AND period = ?`
  )
    .bind(userId, period)
    .first<{ count: number }>();

  return Number(row?.count ?? 0);
}

async function hasUnlockedVideo(input: {
  userId: number;
  movieId: string;
  blockId: string;
  period: string;
}) {
  const row = await getDatabase().prepare(
    `SELECT id
       FROM movie_video_access
      WHERE user_id = ? AND movie_id = ? AND block_id = ? AND period = ?
      LIMIT 1`
  )
    .bind(input.userId, input.movieId, input.blockId, input.period)
    .first<{ id: number }>();

  return Boolean(row);
}

export async function getMovieVideoAccessSummary(input: {
  userId: number;
  isVip: boolean;
  period?: string;
}) {
  if (input.isVip) {
    return {
      vip: true as const,
      limit: null,
      used: null,
      remaining: null,
    };
  }

  const period = input.period ?? currentVideoAccessPeriod();
  const used = await countUserPeriodViews(input.userId, period);
  return {
    vip: false as const,
    limit: FREE_MOVIE_VIDEO_LIMIT,
    used,
    remaining: Math.max(0, FREE_MOVIE_VIDEO_LIMIT - used),
  };
}

export async function unlockMovieVideo(input: {
  userId: number;
  isVip: boolean;
  movieId: string;
  blockId: string;
  period?: string;
}): Promise<MovieVideoAccessState> {
  if (input.isVip) {
    return {
      ok: true,
      vip: true,
      limit: null,
      used: null,
      remaining: null,
    };
  }

  const period = input.period ?? currentVideoAccessPeriod();
  const alreadyUnlocked = await hasUnlockedVideo({
    userId: input.userId,
    movieId: input.movieId,
    blockId: input.blockId,
    period,
  });
  const used = await countUserPeriodViews(input.userId, period);

  if (!alreadyUnlocked && used >= FREE_MOVIE_VIDEO_LIMIT) {
    return {
      ok: false,
      reason: "limit_reached",
      limit: FREE_MOVIE_VIDEO_LIMIT,
      used,
      remaining: 0,
    };
  }

  if (!alreadyUnlocked) {
    await getDatabase().prepare(
      `INSERT OR IGNORE INTO movie_video_access
        (user_id, movie_id, block_id, period)
       VALUES (?, ?, ?, ?)`
    )
      .bind(input.userId, input.movieId, input.blockId, period)
      .run();
  }

  const nextUsed = alreadyUnlocked ? used : used + 1;
  return {
    ok: true,
    vip: false,
    limit: FREE_MOVIE_VIDEO_LIMIT,
    used: nextUsed,
    remaining: Math.max(0, FREE_MOVIE_VIDEO_LIMIT - nextUsed),
  };
}

export async function canStreamMovieVideo(input: {
  userId: number;
  isVip: boolean;
  movieId: string;
  blockId: string;
  period?: string;
}) {
  if (input.isVip) return true;

  return hasUnlockedVideo({
    userId: input.userId,
    movieId: input.movieId,
    blockId: input.blockId,
    period: input.period ?? currentVideoAccessPeriod(),
  });
}
