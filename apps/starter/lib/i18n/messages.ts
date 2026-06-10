import type { AppLocale } from "./config.ts";

export type MovieUiMessages = {
  backToList: string;
  releaseDate: string;
  director: string;
  actors: string;
  noSummary: string;
  unknownYear: string;
  unknownReleaseDate: string;
  searchPlaceholder: string;
  noSearchResults: string;
  itemLabel: string;
  notionLink: string;
  admin: string;
  languageLabel: string;
};

const movieUiMessages: Record<AppLocale, MovieUiMessages> = {
  "zh-CN": {
    backToList: "返回电影列表",
    releaseDate: "上映时间",
    director: "导演",
    actors: "演员",
    noSummary: "暂无剧情简介。",
    unknownYear: "未知年份",
    unknownReleaseDate: "未知上映时间",
    searchPlaceholder: "搜索片名、正文、导演、演员、类型",
    noSearchResults: "没有匹配的电影。",
    itemLabel: "部影片",
    notionLink: "Notion",
    admin: "Admin",
    languageLabel: "语言",
  },
  "en-US": {
    backToList: "Back to movies",
    releaseDate: "Release date",
    director: "Director",
    actors: "Cast",
    noSummary: "No synopsis yet.",
    unknownYear: "Unknown year",
    unknownReleaseDate: "Unknown release date",
    searchPlaceholder: "Search titles, body, director, cast, or genre",
    noSearchResults: "No movies matched your search.",
    itemLabel: "movies",
    notionLink: "Notion",
    admin: "Admin",
    languageLabel: "Language",
  },
};

export function getMovieUiMessages(locale: AppLocale): MovieUiMessages {
  return movieUiMessages[locale];
}
