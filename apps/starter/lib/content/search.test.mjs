import test from "node:test";
import assert from "node:assert/strict";
import {
  filterMoviesBySearch,
  filterPostsBySearch,
  matchesSearchQuery,
  normalizeSearchQuery,
} from "./search.ts";

test("normalizeSearchQuery trims spacing and normalizes width", () => {
  assert.equal(normalizeSearchQuery("  RSC   Workers  "), "rsc workers");
  assert.equal(normalizeSearchQuery("ＡＢＣ"), "abc");
});

test("matchesSearchQuery requires every search term", () => {
  assert.equal(
    matchesSearchQuery(["Cloudflare Workers", "Notion CMS"], "workers notion"),
    true
  );
  assert.equal(
    matchesSearchQuery(["Cloudflare Workers", "Notion CMS"], "workers d1"),
    false
  );
  assert.equal(matchesSearchQuery(["任何内容"], ""), true);
});

test("filterPostsBySearch matches title, author, tags, and description", () => {
  const posts = [
    {
      pageId: "1",
      slug: "edge-rsc",
      title: "Edge RSC",
      description: "Cloudflare Workers notes",
      date: "2026-06-08",
      author: "zhao",
      tags: ["vinext", "notion"],
      coverImage: null,
      published: true,
      editUrl: null,
    },
    {
      pageId: "2",
      slug: "local-design",
      title: "Local Design",
      description: "UI notes",
      date: "2026-06-07",
      author: "digwis",
      tags: ["shadcn"],
      coverImage: null,
      published: true,
      editUrl: null,
    },
  ];

  assert.deepEqual(
    filterPostsBySearch(posts, "workers notion").map((post) => post.slug),
    ["edge-rsc"]
  );
  assert.deepEqual(
    filterPostsBySearch(posts, "digwis").map((post) => post.slug),
    ["local-design"]
  );
});

test("filterMoviesBySearch matches title, people, genre, and summary", () => {
  const movies = [
    {
      pageId: "1",
      routeId: "movie-1",
      title: "渔光曲",
      releaseDate: "1934-06-14",
      director: "蔡楚生",
      actors: "王人美、韩兰根",
      summary: "贫苦渔民一家的命运。",
      genres: ["剧情", "家庭"],
      downloadText: "",
      downloadUrl: null,
      extractionCode: "",
      hasDownloadInfo: false,
      coverImage: null,
      editUrl: null,
      sourceUrl: null,
    },
    {
      pageId: "2",
      routeId: "movie-2",
      title: "一江春水向东流",
      releaseDate: "1947-10-09",
      director: "蔡楚生 郑君里",
      actors: "白杨",
      summary: "战时家庭史诗。",
      genres: ["剧情"],
      downloadText: "",
      downloadUrl: null,
      extractionCode: "",
      hasDownloadInfo: false,
      coverImage: null,
      editUrl: null,
      sourceUrl: null,
    },
  ];

  assert.deepEqual(
    filterMoviesBySearch(movies, "渔民").map((movie) => movie.title),
    ["渔光曲"]
  );
  assert.deepEqual(
    filterMoviesBySearch(movies, "蔡楚生 剧情").map((movie) => movie.title),
    ["渔光曲", "一江春水向东流"]
  );
});
