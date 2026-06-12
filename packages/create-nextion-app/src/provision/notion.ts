// packages/create-nextion-app/src/provision/notion.ts
//
// Provisions a Notion data source for the project's first content
// source. Uses the `ntn` CLI (must be installed globally) and the
// Notion integration token from `NOTION_API_TOKEN`.
//
// The Notion API requires a parent (a page) for database creation —
// integrations normally cannot create at the workspace root — so we
// always prompt the user for a parent page id (or accept a flag).

import { runNtn, runOrThrowNtn } from "./shell.js";
import type { AnswersContentField } from "../prompt.js";

export interface NotionProvisionResult {
  dataSourceId: string;
  databaseId: string;
  url: string;
  /** True when this run created the database; false when an existing one was reused. */
  created: boolean;
  /** Number of seed pages inserted (0 if seeding was skipped). */
  seeded: number;
}

export interface NotionProvisionInput {
  apiToken: string;
  parentPageId: string;
  title: string;
  stableKey: string;
  locale?: string;
  fields: AnswersContentField[];
  /** Number of demo pages to seed. 0 to skip. */
  seedCount: number;
}

export interface PagesProvisionInput {
  apiToken: string;
  parentPageId: string;
  projectName: string;
  contentSourceId: string;
  contentSourceTitle: string;
  contentSourceListPath: string;
  locale?: string;
}

type NotionPropertyDefinition = Record<string, unknown>;
type NotionPropertyMap = Record<string, NotionPropertyDefinition>;

interface ExistingDatabaseInfo {
  databaseId: string;
  dataSourceId: string;
  url: string;
  description: string;
}

interface SeedFieldNames {
  title: string;
  slug?: string;
  description?: string;
  published?: string;
  date?: string;
  tags?: string;
  cover?: string;
}

interface SamplePageInput {
  index: number;
  titlePropertyName: string;
  databaseId: string;
  title: string;
  locale?: string;
  fieldNames: SeedFieldNames;
}

interface SamplePost {
  title: string;
  slug: string;
  description: string;
  date: string;
  tags: string[];
  coverSeed: string;
  intro: string;
  sections: Array<{
    heading: string;
    body: string;
    bullets: string[];
  }>;
  closing: string;
}

interface SampleSitePage {
  title: string;
  key: string;
  slug: string;
  layout: "home" | "default" | "legal" | "content-list";
  description: string;
  seoTitle: string;
  seoDescription: string;
  showHeader: boolean;
  showFooter: boolean;
  showInNav: boolean;
  navLabel: string;
  navOrder: number;
  showInFooter: boolean;
  footerLabel: string;
  footerGroup: string;
  footerOrder: number;
  contentSource?: string;
  coverSeed: string;
  body: Array<{
    heading: string;
    text: string;
    bullets?: string[];
  }>;
}

const ENGLISH_SAMPLE_POSTS: SamplePost[] = [
  {
    title: "Building a Calm Publishing Workflow",
    slug: "building-a-calm-publishing-workflow",
    description:
      "A practical walkthrough of turning Notion drafts into a polished public blog without adding editorial busywork.",
    date: "2026-06-02",
    tags: ["Workflow", "Notion", "Publishing"],
    coverSeed: "calm-publishing-workflow",
    intro:
      "The best publishing systems stay out of the way. This starter keeps the durable parts in code while letting writers shape every article from Notion.",
    sections: [
      {
        heading: "Start with a repeatable draft shape",
        body:
          "Each post carries just enough structured metadata for routing, cards, feeds, and search. The longer narrative stays in Notion blocks, where editors already know how to work.",
        bullets: [
          "Use Slug for the public URL.",
          "Use Published as the release switch.",
          "Use Tags to keep future filtering simple.",
        ],
      },
      {
        heading: "Keep the site predictable",
        body:
          "The generated app reads the registered content source, filters unpublished entries, renders cards, and uses the page body as the canonical article content.",
        bullets: [
          "Change copy and imagery in Notion.",
          "Change layout and behavior in source code.",
        ],
      },
    ],
    closing:
      "Replace this sample with your own launch note when the project is ready to meet readers.",
  },
  {
    title: "What Belongs in Notion, What Belongs in D1",
    slug: "what-belongs-in-notion-what-belongs-in-d1",
    description:
      "A simple storage rule for content-heavy projects: editorial data in Notion, application state in D1.",
    date: "2026-06-04",
    tags: ["Architecture", "D1", "Content"],
    coverSeed: "notion-d1-architecture",
    intro:
      "Notion is excellent at content modeling and human editing. D1 is better for fast, transactional product state such as users, sessions, likes, and comments.",
    sections: [
      {
        heading: "Use Notion for editorial truth",
        body:
          "Posts, pages, guides, portfolios, and media notes benefit from Notion's visual editing, relations, views, and database properties.",
        bullets: [
          "Editors can revise copy without a deploy.",
          "Custom models can grow one database at a time.",
          "Relations make richer content types approachable.",
        ],
      },
      {
        heading: "Use D1 for app behavior",
        body:
          "Auth, account settings, comment moderation, favorites, and rate limits need transactional writes and predictable query paths.",
        bullets: [
          "Keep user-owned state outside the editorial workspace.",
          "Avoid coupling high-frequency actions to Notion API limits.",
        ],
      },
    ],
    closing:
      "This starter begins with blog content in Notion and leaves room for more content models as the project grows.",
  },
  {
    title: "Designing a Homepage That Editors Can Evolve",
    slug: "designing-a-homepage-that-editors-can-evolve",
    description:
      "A lightweight approach to editable pages: stable layout in code, flexible copy and body sections in Notion.",
    date: "2026-06-06",
    tags: ["Pages", "Design", "CMS"],
    coverSeed: "editable-homepage",
    intro:
      "Homepages often need a stronger visual opinion than articles, but the words and sections still change. A Pages content model can give editors control without turning the app into a page builder.",
    sections: [
      {
        heading: "Model pages by stable keys",
        body:
          "A page record can use keys such as home, about, or pricing. Code decides which layout to render; Notion supplies title, SEO fields, and body blocks.",
        bullets: [
          "Use a Key field for stable lookup.",
          "Use Locale when translations are enabled.",
          "Render ordinary blocks for long-form sections.",
        ],
      },
      {
        heading: "Add section mapping only where it helps",
        body:
          "For special homepage modules, map named blocks or section records to components. Keep that mapping narrow until multiple pages prove the same pattern.",
        bullets: [
          "Start simple with page blocks.",
          "Extract reusable sections later.",
        ],
      },
    ],
    closing:
      "That balance gives users editable pages today and a clear path toward richer page modules tomorrow.",
  },
];

const CHINESE_SAMPLE_POSTS: SamplePost[] = [
  {
    title: "建立一个不打扰创作的发布流程",
    slug: "calm-publishing-workflow",
    description:
      "从 Notion 草稿到公开博客的一次完整示例：把结构交给代码，把内容编辑留在 Notion。",
    date: "2026-06-02",
    tags: ["工作流", "Notion", "发布"],
    coverSeed: "calm-publishing-workflow-zh",
    intro:
      "好的发布系统应该安静可靠。这个脚手架把路由、权限、缓存这些稳定能力放在代码里，把文章正文和编辑体验交给 Notion。",
    sections: [
      {
        heading: "先固定最少的内容结构",
        body:
          "每篇文章只需要少量结构化字段来支持列表、详情页和搜索；真正的长文内容继续使用 Notion 页面块来编辑。",
        bullets: [
          "Slug 决定公开访问路径。",
          "Published 控制是否发布。",
          "Tags 为之后的筛选和聚合留出空间。",
        ],
      },
      {
        heading: "让站点行为保持稳定",
        body:
          "生成的项目会读取已注册的内容模型，过滤未发布内容，渲染文章卡片，并把 Notion 页面块作为正文。",
        bullets: [
          "文案和封面在 Notion 中修改。",
          "页面布局和交互在源码中维护。",
        ],
      },
    ],
    closing:
      "当项目准备正式上线时，可以把这篇示例替换成自己的第一篇发布说明。",
  },
  {
    title: "哪些数据放 Notion，哪些数据放 D1",
    slug: "notion-vs-d1-content-architecture",
    description:
      "一个实用的存储原则：内容和编辑模型集中在 Notion，用户行为与事务状态留在 D1。",
    date: "2026-06-04",
    tags: ["架构", "D1", "内容模型"],
    coverSeed: "notion-d1-architecture-zh",
    intro:
      "Notion 适合内容建模和人工编辑，D1 更适合用户、会话、评论、收藏、点赞这类需要频繁写入和权限控制的数据。",
    sections: [
      {
        heading: "把编辑事实放在 Notion",
        body:
          "文章、页面、指南、作品集和资料库都可以从 Notion 的数据库字段、视图、关系和页面块里受益。",
        bullets: [
          "编辑可以不发版就更新内容。",
          "新的内容模型可以按数据库逐步扩展。",
          "关系字段能承载更复杂的内容组织。",
        ],
      },
      {
        heading: "把应用行为放在 D1",
        body:
          "登录、账号设置、评论审核、喜欢、收藏、限流这些功能需要更可控的事务写入和查询路径。",
        bullets: [
          "用户自己的状态不应该绑死在编辑工作区里。",
          "高频行为也不适合依赖 Notion API 限额。",
        ],
      },
    ],
    closing:
      "这个脚手架先从 Notion 博客开始，后续可以继续添加电影、文档、作品集等更多内容模型。",
  },
  {
    title: "设计一个可以被编辑持续更新的首页",
    slug: "editable-homepage-with-notion",
    description:
      "一个轻量的页面内容方案：稳定布局放在代码里，标题、SEO 和正文区块放在 Notion。",
    date: "2026-06-06",
    tags: ["页面", "设计", "CMS"],
    coverSeed: "editable-homepage-zh",
    intro:
      "首页通常需要更强的设计表达，但标题、介绍和内容区块会持续变化。页面模型可以让用户编辑内容，又不会把项目变成复杂页面搭建器。",
    sections: [
      {
        heading: "用稳定 key 管理页面",
        body:
          "页面记录可以使用 home、about、pricing 这样的固定 key。代码根据 key 选择布局，Notion 提供标题、SEO 字段和正文块。",
        bullets: [
          "Key 用于稳定查找。",
          "Locale 为多语言扩展预留位置。",
          "普通页面块适合承载长文和说明区。",
        ],
      },
      {
        heading: "只在必要时映射特殊区块",
        body:
          "如果首页有特别的模块，可以把命名块或 section 记录映射到组件。先保持小范围映射，等多个页面证明模式稳定后再抽象。",
        bullets: [
          "先用页面块解决大部分内容编辑。",
          "后续再提炼复用 section 组件。",
        ],
      },
    ],
    closing:
      "这样用户能立刻编辑页面内容，项目也保留继续长出复杂页面能力的空间。",
  },
];

function samplePostFor(index: number, locale = "en"): SamplePost {
  const posts = locale.toLowerCase().startsWith("zh")
    ? CHINESE_SAMPLE_POSTS
    : ENGLISH_SAMPLE_POSTS;
  return posts[(index - 1) % posts.length];
}

function sampleSitePages(input: PagesProvisionInput): SampleSitePage[] {
  if (input.locale?.toLowerCase().startsWith("zh")) {
    return [
      {
        title: input.projectName,
        key: "home",
        slug: "",
        layout: "home",
        description:
          "一个由 Notion 内容、Cloudflare Workers、D1 和 R2 驱动的可编辑网站。",
        seoTitle: input.projectName,
        seoDescription:
          "一个由 Notion 内容、Cloudflare Workers、D1 和 R2 驱动的可编辑网站。",
        showHeader: true,
        showFooter: true,
        showInNav: false,
        navLabel: "首页",
        navOrder: 0,
        showInFooter: false,
        footerLabel: "首页",
        footerGroup: "站点",
        footerOrder: 0,
        coverSeed: "home-page-zh",
        body: [
          {
            heading: "从 Notion 开始编辑网站",
            text:
              "这个首页来自 Pages 数据库。你可以在 Notion 中修改标题、描述、正文、导航和页脚显示状态。",
            bullets: [
              "页面结构保存在 Pages 数据库。",
              "博客等内容列表保存在各自的数据源。",
              "用户、评论、收藏等应用状态继续交给 D1。",
            ],
          },
          {
            heading: "页面和内容分开管理",
            text:
              "Pages 负责网站信息架构；Blog 负责文章内容。后续添加作品集、电影库或文档库时，也会沿用这个边界。",
          },
        ],
      },
      {
        title: "关于",
        key: "about",
        slug: "about",
        layout: "default",
        description: "介绍这个网站、团队或项目背景。",
        seoTitle: `关于 ${input.projectName}`,
        seoDescription: "介绍这个网站、团队或项目背景。",
        showHeader: true,
        showFooter: true,
        showInNav: true,
        navLabel: "关于",
        navOrder: 20,
        showInFooter: true,
        footerLabel: "关于",
        footerGroup: "站点",
        footerOrder: 10,
        coverSeed: "about-page-zh",
        body: [
          {
            heading: "可以从这里开始写品牌故事",
            text:
              "把这段内容替换成你的项目介绍、价值主张、联系方式或团队说明。",
          },
        ],
      },
      {
        title: input.contentSourceTitle,
        key: input.contentSourceId,
        slug: input.contentSourceListPath.replace(/^\//, ""),
        layout: "content-list",
        description: "来自 Notion 内容数据源的最新文章。",
        seoTitle: input.contentSourceTitle,
        seoDescription: "来自 Notion 内容数据源的最新文章。",
        showHeader: true,
        showFooter: true,
        showInNav: true,
        navLabel: input.contentSourceTitle,
        navOrder: 30,
        showInFooter: true,
        footerLabel: input.contentSourceTitle,
        footerGroup: "内容",
        footerOrder: 10,
        contentSource: input.contentSourceId,
        coverSeed: "content-list-page-zh",
        body: [
          {
            heading: "内容列表页面",
            text:
              "这个页面记录控制列表页的标题、SEO、导航和页脚；实际文章来自对应的内容数据源。",
          },
        ],
      },
      {
        title: "隐私政策",
        key: "privacy",
        slug: "privacy",
        layout: "legal",
        description: "说明这个网站如何处理数据和隐私。",
        seoTitle: "隐私政策",
        seoDescription: "说明这个网站如何处理数据和隐私。",
        showHeader: true,
        showFooter: true,
        showInNav: false,
        navLabel: "隐私政策",
        navOrder: 90,
        showInFooter: true,
        footerLabel: "隐私政策",
        footerGroup: "法律",
        footerOrder: 10,
        coverSeed: "privacy-page-zh",
        body: [
          {
            heading: "示例隐私说明",
            text:
              "这是一个占位页面。正式上线前，请根据你的产品、地区和数据处理方式替换成真实隐私政策。",
          },
        ],
      },
    ];
  }

  return [
    {
      title: input.projectName,
      key: "home",
      slug: "",
      layout: "home",
      description:
        "An editable Notion-powered site running on Cloudflare Workers, D1, and R2.",
      seoTitle: input.projectName,
      seoDescription:
        "An editable Notion-powered site running on Cloudflare Workers, D1, and R2.",
      showHeader: true,
      showFooter: true,
      showInNav: false,
      navLabel: "Home",
      navOrder: 0,
      showInFooter: false,
      footerLabel: "Home",
      footerGroup: "Site",
      footerOrder: 0,
      coverSeed: "home-page",
      body: [
        {
          heading: "Edit the site from Notion",
          text:
            "This homepage comes from the Pages database. Update title, description, body copy, navigation, and footer visibility without changing code.",
          bullets: [
            "Site structure lives in Pages.",
            "Articles and other list content live in their own data sources.",
            "Users, comments, favorites, and likes stay in D1.",
          ],
        },
        {
          heading: "Pages and content stay separate",
          text:
            "Pages define information architecture. Blog defines article content. Future portfolios, catalogs, or docs can follow the same boundary.",
        },
      ],
    },
    {
      title: "About",
      key: "about",
      slug: "about",
      layout: "default",
      description: "Introduce the project, company, venue, or publication.",
      seoTitle: `About ${input.projectName}`,
      seoDescription: "Introduce the project, company, venue, or publication.",
      showHeader: true,
      showFooter: true,
      showInNav: true,
      navLabel: "About",
      navOrder: 20,
      showInFooter: true,
      footerLabel: "About",
      footerGroup: "Site",
      footerOrder: 10,
      coverSeed: "about-page",
      body: [
        {
          heading: "Start with the story behind the site",
          text:
            "Replace this page with your project story, value proposition, contact details, or team notes.",
        },
      ],
    },
    {
      title: input.contentSourceTitle,
      key: input.contentSourceId,
      slug: input.contentSourceListPath.replace(/^\//, ""),
      layout: "content-list",
      description: "Latest articles from the Notion content data source.",
      seoTitle: input.contentSourceTitle,
      seoDescription: "Latest articles from the Notion content data source.",
      showHeader: true,
      showFooter: true,
      showInNav: true,
      navLabel: input.contentSourceTitle,
      navOrder: 30,
      showInFooter: true,
      footerLabel: input.contentSourceTitle,
      footerGroup: "Content",
      footerOrder: 10,
      contentSource: input.contentSourceId,
      coverSeed: "content-list-page",
      body: [
        {
          heading: "Content list page",
          text:
            "This page controls the list page title, SEO, navigation, and footer placement. The actual articles come from the linked content source.",
        },
      ],
    },
    {
      title: "Privacy",
      key: "privacy",
      slug: "privacy",
      layout: "legal",
      description: "Explain how this site handles data and privacy.",
      seoTitle: "Privacy",
      seoDescription: "Explain how this site handles data and privacy.",
      showHeader: true,
      showFooter: true,
      showInNav: false,
      navLabel: "Privacy",
      navOrder: 90,
      showInFooter: true,
      footerLabel: "Privacy",
      footerGroup: "Legal",
      footerOrder: 10,
      coverSeed: "privacy-page",
      body: [
        {
          heading: "Sample privacy notice",
          text:
            "This is placeholder legal copy. Replace it before launch with a policy that matches your product, region, and data handling practices.",
        },
      ],
    },
  ];
}

/** Best-effort: pick a Notion property type from a camelCase key. */
function notionPropertyType(key: string, notionName: string): string {
  const normalized = notionName.trim().toLowerCase();
  if (key === "title" || normalized === "title" || normalized === "name") {
    return "title";
  }
  if (key === "published") return "checkbox";
  if (key === "date") return "date";
  if (key === "tags") return "multi_select";
  if (key === "cover") return "files";
  return "rich_text";
}

/** Build the Notion `properties` object for database creation. */
function buildProperties(
  fields: AnswersContentField[]
): NotionPropertyMap {
  const props: NotionPropertyMap = {};
  for (const f of fields) {
    const type = notionPropertyType(f.key, f.notionName);
    props[f.notionName] = { [type]: {} };
  }
  // Notion requires a `title` property — if the user didn't include
  // one, add a synthetic one (the generated models.ts will need to be
  // adjusted to point at it).
  if (!Object.values(props).some((p) => "title" in p)) {
    props["Name"] = { title: {} };
  }
  return props;
}

function resolveTitlePropertyName(properties: NotionPropertyMap): string {
  const entry = Object.entries(properties).find(
    ([, value]) => notionPropertyDefinitionType(value) === "title"
  );
  return entry?.[0] ?? "Name";
}

async function getDataSourceSchema(
  apiToken: string,
  dataSourceId: string
): Promise<NotionPropertyMap> {
  const stdout = await runOrThrowNtn(["api", `v1/data_sources/${dataSourceId}`], {
    env: { NOTION_API_TOKEN: apiToken },
  });
  const raw = JSON.parse(stdout) as { properties?: NotionPropertyMap };
  return raw.properties ?? {};
}

function normalizeTitle(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function compactNotionId(value: string): string {
  const compact = value.trim().replace(/-/g, "");
  const matches = compact.match(/[0-9a-fA-F]{32}/g);
  return (matches?.at(-1) ?? compact).toLowerCase();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function plainText(parts: unknown): string {
  if (!Array.isArray(parts)) return "";
  return parts
    .map((part) => {
      if (!isRecord(part)) return "";
      if (typeof part.plain_text === "string") return part.plain_text;
      const text = part.text;
      if (isRecord(text) && typeof text.content === "string") return text.content;
      return "";
    })
    .join("")
    .trim();
}

const SCAFFOLD_MARKER_PREFIX = "[nextion-scaffold] key=";

function buildScaffoldMarker(stableKey: string): string {
  return `${SCAFFOLD_MARKER_PREFIX}${stableKey.trim()}`;
}

function extractScaffoldKey(description: string): string | null {
  const match = description.match(/\[nextion-scaffold\] key=([^\n\r]+)/);
  return match?.[1]?.trim() || null;
}

function mergeDescriptionWithScaffoldMarker(
  existingDescription: string,
  stableKey: string
): string {
  const marker = buildScaffoldMarker(stableKey);
  if (extractScaffoldKey(existingDescription) === stableKey) {
    return existingDescription.trim();
  }
  const trimmed = existingDescription.trim();
  return trimmed ? `${trimmed}\n${marker}` : marker;
}

function databaseTitle(input: Record<string, unknown>): string {
  return plainText(input.title);
}

function databaseDescription(input: Record<string, unknown>): string {
  return plainText(input.description);
}

function lastEditedTime(input: Record<string, unknown>): string {
  return typeof input.last_edited_time === "string" ? input.last_edited_time : "";
}

function parentPageId(input: Record<string, unknown>): string | null {
  const parent = input.parent;
  if (!isRecord(parent)) return null;
  return typeof parent.page_id === "string" ? parent.page_id : null;
}

function firstDataSourceId(input: Record<string, unknown>): string | null {
  const dataSources = input.data_sources;
  if (!Array.isArray(dataSources)) return null;
  for (const dataSource of dataSources) {
    if (isRecord(dataSource) && typeof dataSource.id === "string") {
      return dataSource.id;
    }
  }
  return null;
}

function databaseUrl(databaseId: string, input: Record<string, unknown>): string {
  if (typeof input.url === "string" && input.url.trim()) return input.url;
  return `https://www.notion.so/${databaseId.replace(/-/g, "")}`;
}

async function retrieveDatabaseInfo(
  apiToken: string,
  databaseId: string
): Promise<ExistingDatabaseInfo> {
  const stdout = await runOrThrowNtn(["api", `v1/databases/${databaseId}`], {
    env: { NOTION_API_TOKEN: apiToken },
  });
  const raw = JSON.parse(stdout) as Record<string, unknown>;
  const id = typeof raw.id === "string" ? raw.id : databaseId;
  return {
    databaseId: id,
    dataSourceId: firstDataSourceId(raw) ?? id,
    url: databaseUrl(id, raw),
    description: databaseDescription(raw),
  };
}

async function patchDatabaseDescription(input: {
  apiToken: string;
  databaseId: string;
  existingDescription: string;
  stableKey: string;
}): Promise<void> {
  const description = [
    {
      type: "text",
      text: {
        content: mergeDescriptionWithScaffoldMarker(
          input.existingDescription,
          input.stableKey
        ),
      },
    },
  ];

  await runOrThrowNtn(
    [
      "api",
      `v1/databases/${input.databaseId}`,
      "-X",
      "PATCH",
      "-d",
      JSON.stringify({ description }),
    ],
    { env: { NOTION_API_TOKEN: input.apiToken } }
  );
}

async function findExistingDatabaseByStableKey(input: {
  apiToken: string;
  parentPageId: string;
  stableKey: string;
}): Promise<ExistingDatabaseInfo | null> {
  const stdout = await runOrThrowNtn(
    [
      "api",
      "v1/search",
      "-d",
      JSON.stringify({
        query: input.stableKey,
        filter: { property: "object", value: "database" },
        sort: { timestamp: "last_edited_time", direction: "descending" },
        page_size: 50,
      }),
    ],
    { env: { NOTION_API_TOKEN: input.apiToken } }
  );
  const raw = JSON.parse(stdout) as { results?: unknown[] };
  const expectedParent = compactNotionId(input.parentPageId);
  const matches = (raw.results ?? [])
    .filter((item): item is Record<string, unknown> => {
      if (!isRecord(item) || item.object !== "database") return false;
      const parentId = parentPageId(item);
      if (!parentId || compactNotionId(parentId) !== expectedParent) return false;
      return extractScaffoldKey(databaseDescription(item)) === input.stableKey;
    })
    .sort((a, b) => lastEditedTime(b).localeCompare(lastEditedTime(a)));

  if (matches.length === 0) return null;
  if (matches.length > 1) {
    console.warn(
      `[notion] found ${matches.length} databases with scaffold key "${input.stableKey}" under the parent page; reusing the most recently edited one.`
    );
  }
  const first = matches[0];
  const databaseId = typeof first.id === "string" ? first.id : null;
  if (!databaseId) return null;
  return {
    databaseId,
    dataSourceId:
      firstDataSourceId(first) ??
      (await retrieveDatabaseInfo(input.apiToken, databaseId)).dataSourceId,
    url: databaseUrl(databaseId, first),
    description: databaseDescription(first),
  };
}

async function findExistingDatabaseByTitle(input: {
  apiToken: string;
  parentPageId: string;
  title: string;
}): Promise<ExistingDatabaseInfo | null> {
  const body = {
    query: input.title,
    filter: { property: "object", value: "database" },
    sort: { timestamp: "last_edited_time", direction: "descending" },
    page_size: 25,
  };
  const stdout = await runOrThrowNtn(
    ["api", "v1/search", "-d", JSON.stringify(body)],
    { env: { NOTION_API_TOKEN: input.apiToken } }
  );
  const raw = JSON.parse(stdout) as { results?: unknown[] };
  const expectedTitle = normalizeTitle(input.title);
  const expectedParent = compactNotionId(input.parentPageId);
  const matches = (raw.results ?? []).filter((item): item is Record<string, unknown> => {
    if (!isRecord(item)) return false;
    if (item.object !== "database") return false;
    if (normalizeTitle(databaseTitle(item)) !== expectedTitle) return false;
    const parentId = parentPageId(item);
    return parentId ? compactNotionId(parentId) === expectedParent : false;
  });

  if (matches.length === 0) return null;
  if (matches.length > 1) {
    console.warn(
      `[notion] found ${matches.length} databases named "${input.title}" under the parent page; reusing the most recently edited one.`
    );
  }
  const first = matches[0];
  const databaseId = typeof first.id === "string" ? first.id : null;
  if (!databaseId) return null;
  return {
    databaseId,
    dataSourceId:
      firstDataSourceId(first) ??
      (await retrieveDatabaseInfo(input.apiToken, databaseId)).dataSourceId,
    url: databaseUrl(databaseId, first),
    description: databaseDescription(first),
  };
}

const NOTION_PROPERTY_TYPES = [
  "title",
  "rich_text",
  "number",
  "select",
  "multi_select",
  "status",
  "date",
  "people",
  "files",
  "checkbox",
  "url",
  "email",
  "phone_number",
  "formula",
  "relation",
  "rollup",
  "created_time",
  "created_by",
  "last_edited_time",
  "last_edited_by",
  "unique_id",
] as const;

function notionPropertyDefinitionType(
  definition: NotionPropertyDefinition | undefined
): string | undefined {
  if (!definition) return undefined;
  if (typeof definition.type === "string") return definition.type;
  return NOTION_PROPERTY_TYPES.find((type) => type in definition);
}

function missingPropertiesForPatch(
  existing: NotionPropertyMap,
  desired: NotionPropertyMap
): { properties: NotionPropertyMap; warnings: string[] } {
  const properties: NotionPropertyMap = {};
  const warnings: string[] = [];
  const existingTitle = Object.entries(existing).find(
    ([, definition]) => notionPropertyDefinitionType(definition) === "title"
  )?.[0];

  for (const [name, desiredDefinition] of Object.entries(desired)) {
    const desiredType = notionPropertyDefinitionType(desiredDefinition);
    const currentDefinition = existing[name];
    const currentType = notionPropertyDefinitionType(currentDefinition);

    if (!currentDefinition) {
      if (desiredType === "title" && existingTitle && existingTitle !== name) {
        warnings.push(
          `existing title property is "${existingTitle}"; expected "${name}". Leaving it unchanged.`
        );
        continue;
      }
      properties[name] = desiredDefinition;
      continue;
    }

    if (desiredType && currentType && desiredType !== currentType) {
      warnings.push(
        `property "${name}" is ${currentType}; expected ${desiredType}. Leaving it unchanged.`
      );
    }
  }

  return { properties, warnings };
}

async function ensureDataSourceProperties(input: {
  apiToken: string;
  dataSourceId: string;
  desired: NotionPropertyMap;
  title: string;
}): Promise<NotionPropertyMap> {
  let schema = await getDataSourceSchema(input.apiToken, input.dataSourceId);
  const missing = missingPropertiesForPatch(schema, input.desired);
  for (const warning of missing.warnings) {
    console.warn(`[notion schema] ${input.title}: ${warning}`);
  }
  if (Object.keys(missing.properties).length === 0) return schema;

  await runOrThrowNtn(
    [
      "api",
      `v1/data_sources/${input.dataSourceId}`,
      "-X",
      "PATCH",
      "-d",
      JSON.stringify({ properties: missing.properties }),
    ],
    { env: { NOTION_API_TOKEN: input.apiToken } }
  );
  return getDataSourceSchema(input.apiToken, input.dataSourceId);
}

function findMatchingField(
  properties: NotionPropertyMap,
  fields: AnswersContentField[],
  key: string,
  fallback: string
): string | undefined {
  const configured = fields.find((field) => field.key === key)?.notionName;
  if (configured && properties[configured]) return configured;
  if (properties[fallback]) return fallback;
  return configured;
}

async function createDatabaseWithProperties(input: {
  apiToken: string;
  parentPageId: string;
  title: string;
  properties: NotionPropertyMap;
}) {
  const titleProp = Object.entries(input.properties).find(
    ([, value]) => notionPropertyDefinitionType(value) === "title"
  );
  const dbTitlePropName = titleProp ? titleProp[0] : "Name";

  const body = {
    parent: { type: "page_id", page_id: input.parentPageId },
    title: [{ type: "text", text: { content: input.title } }],
    properties: titleProp
      ? { [titleProp[0]]: { title: {} } }
      : { [dbTitlePropName]: { title: {} } },
  };

  const stdout = await runOrThrowNtn(
    ["api", "v1/databases", "-d", JSON.stringify(body)],
    { env: { NOTION_API_TOKEN: input.apiToken } }
  );

  const db = JSON.parse(stdout) as {
    id: string;
    url?: string;
    data_sources?: Array<{ id: string }>;
  };
  const dataSourceId = db.data_sources?.[0]?.id ?? db.id;
  const databaseId = db.id;
  const url = db.url ?? `https://www.notion.so/${databaseId.replace(/-/g, "")}`;

  const nonTitleProps = Object.fromEntries(
    Object.entries(input.properties).filter(
      ([, value]) => notionPropertyDefinitionType(value) !== "title"
    )
  );
  if (Object.keys(nonTitleProps).length > 0) {
    await runOrThrowNtn(
      [
        "api",
        `v1/data_sources/${dataSourceId}`,
        "-X",
        "PATCH",
        "-d",
        JSON.stringify({ properties: nonTitleProps }),
      ],
      { env: { NOTION_API_TOKEN: input.apiToken } }
    );
  }

  return { databaseId, dataSourceId, url };
}

function buildSamplePage(input: SamplePageInput) {
  const { fieldNames, index, locale, title, titlePropertyName, databaseId } = input;
  const sample = samplePostFor(index, locale);
  const coverUrl = `https://picsum.photos/seed/${slugify(title)}-${sample.coverSeed}/1200/600`;
  const properties: Record<string, unknown> = {
    [titlePropertyName]: {
      title: [{ text: { content: sample.title } }],
    },
  };

  if (fieldNames.slug) {
    properties[fieldNames.slug] = {
      rich_text: [{ text: { content: sample.slug } }],
    };
  }
  if (fieldNames.description) {
    properties[fieldNames.description] = {
      rich_text: [{ text: { content: sample.description } }],
    };
  }
  if (fieldNames.published) {
    properties[fieldNames.published] = { checkbox: true };
  }
  if (fieldNames.date) {
    properties[fieldNames.date] = {
      date: { start: sample.date },
    };
  }
  if (fieldNames.tags) {
    properties[fieldNames.tags] = {
      multi_select: sample.tags.map((name) => ({ name })),
    };
  }
  if (fieldNames.cover) {
    properties[fieldNames.cover] = {
      files: [
        {
          name: `${sample.slug}-cover`,
          type: "external",
          external: { url: coverUrl },
        },
      ],
    };
  }

  return {
    parent: { type: "database_id", database_id: databaseId },
    cover: {
      type: "external",
      external: {
        url: coverUrl,
      },
    },
    properties,
    children: [
      {
        object: "block",
        type: "heading_1",
        heading_1: {
          rich_text: [{ type: "text", text: { content: sample.title } }],
        },
      },
      {
        object: "block",
        type: "paragraph",
        paragraph: {
          rich_text: [
            {
              type: "text",
              text: {
                content: sample.intro,
              },
            },
          ],
        },
      },
      ...sample.sections.flatMap((section) => [
        {
          object: "block",
          type: "heading_2",
          heading_2: {
            rich_text: [{ type: "text", text: { content: section.heading } }],
          },
        },
        {
          object: "block",
          type: "paragraph",
          paragraph: {
            rich_text: [
              {
                type: "text",
                text: { content: section.body },
              },
            ],
          },
        },
        ...section.bullets.map((bullet) => ({
          object: "block",
          type: "bulleted_list_item",
          bulleted_list_item: {
            rich_text: [
              {
                type: "text",
                text: { content: bullet },
              },
            ],
          },
        })),
      ]),
      {
        object: "block",
        type: "paragraph",
        paragraph: {
          rich_text: [
            {
              type: "text",
              text: {
                content: sample.closing,
              },
            },
          ],
        },
      },
    ],
  };
}

function buildPageProperties(): NotionPropertyMap {
  return {
    Name: { title: {} },
    Key: { rich_text: {} },
    Slug: { rich_text: {} },
    Status: { select: {} },
    Layout: { select: {} },
    Description: { rich_text: {} },
    "SEO Title": { rich_text: {} },
    "SEO Description": { rich_text: {} },
    "Show Header": { checkbox: {} },
    "Show Footer": { checkbox: {} },
    "Show in Nav": { checkbox: {} },
    "Nav Label": { rich_text: {} },
    "Nav Order": { number: {} },
    "Show in Footer": { checkbox: {} },
    "Footer Label": { rich_text: {} },
    "Footer Group": { select: {} },
    "Footer Order": { number: {} },
    "Content Source": { rich_text: {} },
    Cover: { files: {} },
  };
}

function richText(content: string) {
  return content ? [{ text: { content } }] : [];
}

function buildSitePagePayload(input: {
  databaseId: string;
  projectName: string;
  page: SampleSitePage;
}) {
  const { databaseId, page, projectName } = input;
  const coverUrl = `https://picsum.photos/seed/${slugify(projectName)}-${page.coverSeed}/1200/600`;
  return {
    parent: { type: "database_id", database_id: databaseId },
    cover: {
      type: "external",
      external: { url: coverUrl },
    },
    properties: {
      Name: { title: richText(page.title) },
      Key: { rich_text: richText(page.key) },
      Slug: { rich_text: richText(page.slug) },
      Status: { select: { name: "Published" } },
      Layout: { select: { name: page.layout } },
      Description: { rich_text: richText(page.description) },
      "SEO Title": { rich_text: richText(page.seoTitle) },
      "SEO Description": { rich_text: richText(page.seoDescription) },
      "Show Header": { checkbox: page.showHeader },
      "Show Footer": { checkbox: page.showFooter },
      "Show in Nav": { checkbox: page.showInNav },
      "Nav Label": { rich_text: richText(page.navLabel) },
      "Nav Order": { number: page.navOrder },
      "Show in Footer": { checkbox: page.showInFooter },
      "Footer Label": { rich_text: richText(page.footerLabel) },
      "Footer Group": { select: { name: page.footerGroup } },
      "Footer Order": { number: page.footerOrder },
      "Content Source": { rich_text: richText(page.contentSource ?? "") },
      Cover: {
        files: [
          {
            name: `${page.key || "page"}-cover`,
            type: "external",
            external: { url: coverUrl },
          },
        ],
      },
    },
    children: page.body.flatMap((section) => [
      {
        object: "block",
        type: "heading_2",
        heading_2: {
          rich_text: [{ type: "text", text: { content: section.heading } }],
        },
      },
      {
        object: "block",
        type: "paragraph",
        paragraph: {
          rich_text: [{ type: "text", text: { content: section.text } }],
        },
      },
      ...(section.bullets ?? []).map((bullet) => ({
        object: "block",
        type: "bulleted_list_item",
        bulleted_list_item: {
          rich_text: [{ type: "text", text: { content: bullet } }],
        },
      })),
    ]),
  };
}

/** Probe `ntn` — returns true if it's installed. */
export async function isNtnAvailable(): Promise<boolean> {
  // `ntn --version` is read-only, but it still calls libuv's
  // `uv_tty_init` on startup, so we have to keep the PTY-aware
  // wrapper for it to actually exit 0. The cost is one extra
  // `unbuffer` fork per scaffolder run.
  const r = await runNtn(["--version"]);
  return r.code === 0;
}

/**
 * Verify the Notion API token is valid by fetching the bot user.
 *
 * We deliberately use `/v1/users/me` (the authenticated self-fetch),
 * not `/v1/users` (the full user list), because:
 *
 *   - The former works for *all* Notion token types — internal
 *     integrations (`secret_…`), OAuth public integrations, and
 *     personal access tokens (`ntn_…`) issued by the `ntn` CLI.
 *   - The latter requires the `user.read` capability on internal
 *     integrations, and is **forbidden for personal access tokens**
 *     with the message "Personal access tokens cannot list users".
 *     That breaks the auto-detect path for users who have run
 *     `ntn login`.
 */
export async function verifyNotionToken(apiToken: string): Promise<boolean> {
  const r = await runNtn(["api", "v1/users/me"], {
    env: { NOTION_API_TOKEN: apiToken },
  });
  if (r.code === 0) return true;
  // Surface the actual API error in the caller's exception so users
  // see *why* their token was rejected (e.g. "403 restricted_resource").
  const detail =
    r.stderr.trim() || r.stdout.trim() || `exit code ${r.code ?? "null"}`;
  throw new Error(`Notion token verification failed: ${detail}`);
}

/**
 * Create a Notion database (and its default data source) under the
 * given parent page. Optionally seed it with placeholder pages.
 *
 * The 2025-09-03 Notion API version split "database" into two
 * objects: a database shell (container) and one or more data
 * sources (the schema). `POST /v1/databases` still creates the
 * shell with a *default* data source, but the `properties` field
 * on that request is silently ignored when the data source schema
 * hasn't been opened for writes. To actually create properties we
 * have to follow up with `PATCH /v1/data_sources/{id}` to define
 * them. Without that second call the database ends up with the
 * `Name` fallback property only, and `POST /v1/pages` later fails
 * with "X is not a property that exists".
 */
export async function ensureNotionDatabase(
  input: NotionProvisionInput
): Promise<NotionProvisionResult> {
  const properties = buildProperties(input.fields);
  const existingByStableKey = await findExistingDatabaseByStableKey({
    apiToken: input.apiToken,
    parentPageId: input.parentPageId,
    stableKey: input.stableKey,
  });
  const existing =
    existingByStableKey ??
    (await findExistingDatabaseByTitle({
      apiToken: input.apiToken,
      parentPageId: input.parentPageId,
      title: input.title,
    }));

  if (existing) {
    await ensureDataSourceProperties({
      apiToken: input.apiToken,
      dataSourceId: existing.dataSourceId,
      desired: properties,
      title: input.title,
    });
    if (extractScaffoldKey(existing.description) !== input.stableKey) {
      await patchDatabaseDescription({
        apiToken: input.apiToken,
        databaseId: existing.databaseId,
        existingDescription: existing.description,
        stableKey: input.stableKey,
      });
    }
    return {
      dataSourceId: existing.dataSourceId,
      databaseId: existing.databaseId,
      url: existing.url,
      created: false,
      seeded: 0,
    };
  }

  const { databaseId, dataSourceId, url } = await createDatabaseWithProperties({
    apiToken: input.apiToken,
    parentPageId: input.parentPageId,
    title: input.title,
    properties,
  });
  await patchDatabaseDescription({
    apiToken: input.apiToken,
    databaseId,
    existingDescription: "",
    stableKey: input.stableKey,
  });

  let seeded = 0;
  if (input.seedCount > 0) {
    const schema = await getDataSourceSchema(input.apiToken, dataSourceId);
    seeded = await seedPlaceholderPages(
      input.apiToken,
      databaseId,
      dataSourceId,
      input.title,
      input.locale,
      input.fields,
      schema,
      input.seedCount
    );
  }

  return {
    dataSourceId,
    databaseId,
    url,
    created: true,
    seeded,
  };
}

export async function ensurePagesDatabase(
  input: PagesProvisionInput
): Promise<NotionProvisionResult> {
  const title = `${input.projectName} Pages`;
  const stableKey = "pages:default";
  const properties = buildPageProperties();
  const existingByStableKey = await findExistingDatabaseByStableKey({
    apiToken: input.apiToken,
    parentPageId: input.parentPageId,
    stableKey,
  });
  const existing =
    existingByStableKey ??
    (await findExistingDatabaseByTitle({
      apiToken: input.apiToken,
      parentPageId: input.parentPageId,
      title,
    }));

  if (existing) {
    await ensureDataSourceProperties({
      apiToken: input.apiToken,
      dataSourceId: existing.dataSourceId,
      desired: properties,
      title,
    });
    if (extractScaffoldKey(existing.description) !== stableKey) {
      await patchDatabaseDescription({
        apiToken: input.apiToken,
        databaseId: existing.databaseId,
        existingDescription: existing.description,
        stableKey,
      });
    }
    return {
      dataSourceId: existing.dataSourceId,
      databaseId: existing.databaseId,
      url: existing.url,
      created: false,
      seeded: 0,
    };
  }

  const { databaseId, dataSourceId, url } = await createDatabaseWithProperties({
    apiToken: input.apiToken,
    parentPageId: input.parentPageId,
    title,
    properties,
  });
  await patchDatabaseDescription({
    apiToken: input.apiToken,
    databaseId,
    existingDescription: "",
    stableKey,
  });

  let seeded = 0;
  for (const page of sampleSitePages(input)) {
    const body = buildSitePagePayload({
      databaseId,
      projectName: input.projectName,
      page,
    });
    const result = await runNtn(["api", "v1/pages", "-d", JSON.stringify(body)], {
      env: { NOTION_API_TOKEN: input.apiToken },
    });
    if (result.code === 0) {
      seeded++;
    } else {
      const detail = (result.stderr || result.stdout).trim().slice(0, 500);
      console.warn(
        `[notion seed] site page "${page.key}" failed (code ${result.code}): ${detail}`
      );
    }
  }

  return {
    dataSourceId,
    databaseId,
    url,
    created: true,
    seeded,
  };
}

async function seedPlaceholderPages(
  apiToken: string,
  databaseId: string,
  dataSourceId: string,
  title: string,
  locale: string | undefined,
  fields: AnswersContentField[],
  schema: NotionPropertyMap,
  count: number
): Promise<number> {
  let ok = 0;
  const titlePropertyName = resolveTitlePropertyName(schema);
  const fieldNames: SeedFieldNames = {
    title: titlePropertyName,
    slug: findMatchingField(schema, fields, "slug", "Slug"),
    description: findMatchingField(schema, fields, "description", "Description"),
    published: findMatchingField(schema, fields, "published", "Published"),
    date: findMatchingField(schema, fields, "date", "Date"),
    tags: findMatchingField(schema, fields, "tags", "Tags"),
    cover: findMatchingField(schema, fields, "cover", "Cover"),
  };

  for (let i = 1; i <= count; i++) {
    const body = buildSamplePage({
      index: i,
      titlePropertyName,
      databaseId,
      title,
      locale,
      fieldNames,
    });
    const r = await runNtn(["api", "v1/pages", "-d", JSON.stringify(body)], {
      env: { NOTION_API_TOKEN: apiToken },
    });
    if (r.code === 0) {
      ok++;
    } else {
      // Surface the API's actual error so the operator can see why
      // a sample page didn't land. We log the first failure at warn
      // level (later ones are usually the same root cause).
      const detail = (r.stderr || r.stdout).trim().slice(0, 500);
      console.warn(
        `[notion seed] page #${i} for "${title}" failed (code ${r.code}): ${detail}`
      );
    }
  }
  return ok;
}

/** Lowercase, ascii-only slug suitable for a picsum seed token. */
function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "post";
}

export const _internal = {
  notionPropertyType,
  buildProperties,
  buildPageProperties,
  buildSitePagePayload,
  resolveTitlePropertyName,
  buildSamplePage,
  sampleSitePages,
  samplePostFor,
  buildScaffoldMarker,
  extractScaffoldKey,
  mergeDescriptionWithScaffoldMarker,
  missingPropertiesForPatch,
};
