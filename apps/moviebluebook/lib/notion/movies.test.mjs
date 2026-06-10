import test from "node:test";
import assert from "node:assert/strict";
import {
  compactNotionId,
  createNotionMovieSource,
  mapNotionPageToMovieItem,
  toPublicMovieDetail,
  toPublicMovieListItem,
} from "./movies.ts";

function moviePage({
  id,
  title,
  date = "1934-06-14",
  updatedAt,
  director = "蔡楚生",
  summary = "贫苦渔民一家的命运。",
  downloadProperty = {
    type: "url",
    url: "https://pan.baidu.com/s/abc123",
  },
  extractionCode = "mcnf",
}) {
  return {
    id,
    ...(updatedAt ? { last_edited_time: updatedAt } : {}),
    properties: {
      电影名称: { type: "title", title: [{ plain_text: title }] },
      上映时间: { type: "date", date: { start: date } },
      导演: { type: "rich_text", rich_text: [{ plain_text: director }] },
      演员: { type: "rich_text", rich_text: [{ plain_text: "王人美、韩兰根" }] },
      剧情简介: { type: "rich_text", rich_text: [{ plain_text: summary }] },
      下载链接: downloadProperty,
      下载地址: {
        type: "rich_text",
        rich_text: [{ plain_text: "https://example.com/movie.mp4" }],
      },
      提取码: {
        type: "rich_text",
        rich_text: [{ plain_text: extractionCode }],
      },
      类型: {
        type: "multi_select",
        multi_select: [{ name: "剧情" }, { name: "家庭" }],
      },
    },
    cover: null,
    url: `https://app.notion.com/p/${compactNotionId(id)}`,
  };
}

test("mapNotionPageToMovieItem maps the Chinese movie schema", () => {
  const movie = mapNotionPageToMovieItem(
    moviePage({
      id: "371dc62d-0738-8025-b7dd-f33519a7f2f8",
      title: "渔光曲",
    })
  );

  assert.equal(movie.title, "渔光曲");
  assert.equal(movie.releaseDate, "1934-06-14");
  assert.equal(movie.director, "蔡楚生");
  assert.equal(movie.actors, "王人美、韩兰根");
  assert.deepEqual(movie.genres, ["剧情", "家庭"]);
  assert.equal(movie.downloadUrl, "https://pan.baidu.com/s/abc123");
  assert.equal(movie.downloadText, "https://pan.baidu.com/s/abc123");
  assert.equal(movie.extractionCode, "mcnf");
  assert.equal(movie.routeId, "371dc62d07388025b7ddf33519a7f2f8");
});

test("mapNotionPageToMovieItem falls back to the legacy download field", () => {
  const movie = mapNotionPageToMovieItem(
    moviePage({
      id: "371dc62d-0738-8025-b7dd-f33519a7f2f8",
      title: "渔光曲",
      downloadProperty: { type: "url", url: null },
      extractionCode: "",
    })
  );

  assert.equal(movie.downloadUrl, "https://example.com/movie.mp4");
  assert.equal(movie.extractionCode, "");
});

test("listMovies follows pagination and sorts by release date", async () => {
  const source = createNotionMovieSource({
    queryDataSource: async ({ startCursor } = {}) => {
      if (!startCursor) {
        return {
          results: [
            moviePage({
              id: "1",
              title: "Older",
              date: "1934-06-14",
            }),
          ],
          has_more: true,
          next_cursor: "next",
        };
      }

      return {
        results: [
          moviePage({
            id: "2",
            title: "Newer",
            date: "1947-10-09",
          }),
        ],
      };
    },
    getPageBlocks: async () => [],
  });

  const movies = await source.listMovies();

  assert.deepEqual(
    movies.map((movie) => movie.title),
    ["Newer", "Older"]
  );
});

test("getMovieByRouteId returns detail blocks", async () => {
  const blockCalls = [];
  const source = createNotionMovieSource({
    queryDataSource: async () => ({
      results: [
        moviePage({
          id: "page-1",
          title: "渔光曲",
          updatedAt: "2026-06-09T02:00:00.000Z",
        }),
      ],
    }),
    getPageBlocks: async (pageId, cacheVersion) => {
      blockCalls.push({ pageId, cacheVersion });
      return [
        {
          id: `${pageId}-block`,
          type: "paragraph",
          paragraph: { rich_text: [{ plain_text: "Hello" }] },
        },
      ];
    },
  });

  const movie = await source.getMovieByRouteId("page-1");

  assert.equal(movie?.title, "渔光曲");
  assert.equal(movie?.blocks[0]?.id, "page-1-block");
  assert.deepEqual(blockCalls, [
    { pageId: "page-1", cacheVersion: "2026-06-09T02:00:00.000Z" },
  ]);
});

test("getMovieMetaByRouteId avoids fetching detail blocks", async () => {
  let blockFetches = 0;
  const source = createNotionMovieSource({
    queryDataSource: async () => ({
      results: [moviePage({ id: "meta-page", title: "渔光曲" })],
    }),
    getPageBlocks: async () => {
      blockFetches += 1;
      return [];
    },
  });

  const movie = await source.getMovieMetaByRouteId("meta-page");

  assert.equal(movie?.title, "渔光曲");
  assert.equal(blockFetches, 0);
});

test("public movie detail source strips gated download values", async () => {
  const source = createNotionMovieSource({
    queryDataSource: async () => ({
      results: [moviePage({ id: "public-page", title: "渔光曲" })],
    }),
    getPageBlocks: async () => [],
  });

  const movie = await source.getMovieByRouteId("public-page");
  const publicMovie = movie ? toPublicMovieDetail(movie) : null;

  assert.equal(movie?.downloadUrl, "https://pan.baidu.com/s/abc123");
  assert.equal(movie?.extractionCode, "mcnf");
  assert.equal(publicMovie?.downloadUrl, null);
  assert.equal(publicMovie?.downloadText, "");
  assert.equal(publicMovie?.extractionCode, "");
  assert.equal(publicMovie?.hasDownloadInfo, true);
});

test("public movie list item strips gated download values", () => {
  const movie = mapNotionPageToMovieItem(
    moviePage({
      id: "public-list-page",
      title: "渔光曲",
    })
  );

  const publicMovie = toPublicMovieListItem(movie);

  assert.equal(publicMovie.downloadUrl, null);
  assert.equal(publicMovie.downloadText, "");
  assert.equal(publicMovie.extractionCode, "");
  assert.equal(publicMovie.hasDownloadInfo, true);
});

test("download info lookup does not fetch detail blocks", async () => {
  let blockFetches = 0;
  const source = createNotionMovieSource({
    queryDataSource: async () => ({
      results: [moviePage({ id: "download-page", title: "渔光曲" })],
    }),
    getPageBlocks: async () => {
      blockFetches += 1;
      return [];
    },
  });

  const info = await source.getDownloadInfoByRouteId("download-page");

  assert.equal(info?.downloadUrl, "https://pan.baidu.com/s/abc123");
  assert.equal(info?.extractionCode, "mcnf");
  assert.equal(info?.hasDownloadInfo, true);
  assert.equal(blockFetches, 0);
});
