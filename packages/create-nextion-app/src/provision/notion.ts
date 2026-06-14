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
  blocks?: SamplePageBlockRef[];
  coverSeed: string;
  body: Array<{
    heading: string;
    text: string;
    bullets?: string[];
  }>;
}

interface SamplePageBlockRef {
  slug: string;
  variant?: "hero" | "feature-grid" | "story";
  order?: number;
}

interface SampleSiteBlockBase {
  title: string;
  slug: string;
  type: "hero" | "feature-grid" | "story";
  description: string;
  pageKeys: string[];
  order: number;
  coverSeed: string;
}

interface SampleHeroBlock extends SampleSiteBlockBase {
  type: "hero";
  eyebrow: string;
  headline: string;
  subheadline: string;
  primaryCtaLabel: string;
  primaryCtaHref: string;
  secondaryCtaLabel?: string;
  secondaryCtaHref?: string;
  alignment: "left" | "center";
  theme: "default" | "muted" | "inverse";
}

interface SampleFeatureGridItem {
  title: string;
  description: string;
  icon: string;
  href?: string;
}

interface SampleFeatureGridBlock extends SampleSiteBlockBase {
  type: "feature-grid";
  headline: string;
  body: string;
  columns: 2 | 3 | 4;
  items: SampleFeatureGridItem[];
}

interface SampleStoryBlock extends SampleSiteBlockBase {
  type: "story";
  headline: string;
  body: string;
  quote?: string;
  quoteAttribution?: string;
  mediaUrl?: string;
  layout: "text-left" | "media-left" | "media-right";
}

type SampleSiteBlock =
  | SampleHeroBlock
  | SampleFeatureGridBlock
  | SampleStoryBlock;

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
        blocks: [
          { slug: "home-hero", variant: "hero", order: 10 },
          { slug: "home-feature-grid", variant: "feature-grid", order: 20 },
        ],
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
        blocks: [{ slug: "about-story", variant: "story", order: 10 }],
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
      blocks: [
        { slug: "home-hero", variant: "hero", order: 10 },
        { slug: "home-feature-grid", variant: "feature-grid", order: 20 },
      ],
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
      blocks: [{ slug: "about-story", variant: "story", order: 10 }],
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

function sampleBlocks(input: {
  projectName: string;
  contentSourceTitle: string;
  locale?: string;
}): SampleSiteBlock[] {
  if (input.locale?.toLowerCase().startsWith("zh")) {
    return [
      {
        title: `${input.projectName} Hero`,
        slug: "home-hero",
        type: "hero",
        description: "首页顶部主视觉区块，适合放标题、副标题与主行动按钮。",
        pageKeys: ["home"],
        order: 10,
        coverSeed: "home-hero-zh",
        eyebrow: "Notion + Cloudflare",
        headline: "从一个可以持续编辑的首页开始",
        subheadline:
          "把首页的一句话价值、介绍文案和主行动按钮交给 Notion，站点布局继续由代码稳定控制。",
        primaryCtaLabel: "查看内容列表",
        primaryCtaHref: "/blog",
        secondaryCtaLabel: "了解项目",
        secondaryCtaHref: "/about",
        alignment: "center",
        theme: "muted",
      },
      {
        title: "首页功能展示",
        slug: "home-feature-grid",
        type: "feature-grid",
        description: "用于首页中段的功能/能力展示区块。",
        pageKeys: ["home"],
        order: 20,
        coverSeed: "home-feature-grid-zh",
        headline: "把内容、运行时和发布流程串成一个清晰系统",
        body: "这个区块默认用三列卡片展示项目能力，适合介绍内容工作流、部署基础设施和持续发布能力。",
        columns: 3,
        items: [
          {
            title: "内容编辑",
            description: "让编辑直接在 Notion 中维护页面与内容，不需要改代码。",
            icon: "pen-square",
            href: "/about",
          },
          {
            title: "云端运行",
            description: "基于 Cloudflare Workers、D1 和 KV 提供轻量稳定的运行时能力。",
            icon: "cloud",
          },
          {
            title: "持续更新",
            description: `${input.contentSourceTitle} 列表可以持续发布新内容，并自动进入站点路由。`,
            icon: "newspaper",
            href: "/blog",
          },
        ],
      },
      {
        title: "关于页品牌故事",
        slug: "about-story",
        type: "story",
        description: "适合 About 页面使用的故事型介绍区块。",
        pageKeys: ["about"],
        order: 10,
        coverSeed: "about-story-zh",
        headline: "讲清楚这个项目为什么存在",
        body:
          "这个 story 区块适合承载项目背景、团队工作方式和长期目标，让 About 页面一开始就有一段完整叙事。",
        quote: "先把结构做稳定，再把编辑权交给内容团队。",
        quoteAttribution: "默认脚手架设计原则",
        mediaUrl: "https://picsum.photos/seed/about-story-zh/960/720",
        layout: "media-right",
      },
    ];
  }

  return [
    {
      title: `${input.projectName} Hero`,
      slug: "home-hero",
      type: "hero",
      description: "Homepage hero module for headline, supporting copy, and primary CTA.",
      pageKeys: ["home"],
      order: 10,
      coverSeed: "home-hero",
      eyebrow: "Notion + Cloudflare",
      headline: "Start with a homepage you can keep editing",
      subheadline:
        "Keep the layout stable in code while the hero copy, positioning, and primary call to action evolve in Notion.",
      primaryCtaLabel: "Explore the blog",
      primaryCtaHref: "/blog",
      secondaryCtaLabel: "Read the story",
      secondaryCtaHref: "/about",
      alignment: "center",
      theme: "muted",
    },
    {
      title: "Homepage Feature Grid",
      slug: "home-feature-grid",
      type: "feature-grid",
      description: "Mid-page feature section for capabilities, benefits, or service pillars.",
      pageKeys: ["home"],
      order: 20,
      coverSeed: "home-feature-grid",
      headline: "Show the system working together",
      body:
        "Use this grid to explain how editing, infrastructure, and publishing fit together without overwhelming the homepage.",
      columns: 3,
      items: [
        {
          title: "Editorial workflows",
          description: "Use Notion as the editor for pages, posts, and reusable sections.",
          icon: "pen-square",
          href: "/about",
        },
        {
          title: "Cloudflare runtime",
          description: "Ship on Workers with storage and caching primitives ready to grow.",
          icon: "cloud",
        },
        {
          title: `${input.contentSourceTitle} updates`,
          description: "Publish new entries and surface them through the generated routes automatically.",
          icon: "newspaper",
          href: "/blog",
        },
      ],
    },
    {
      title: "About Story",
      slug: "about-story",
      type: "story",
      description: "Story-led section for the About page.",
      pageKeys: ["about"],
      order: 10,
      coverSeed: "about-story",
      headline: "Explain why this project exists",
      body:
        "Use this reusable story block to introduce the team, the editorial mission, or the thinking behind the site in a stable layout.",
      quote: "Content should stay editable without turning the app into a page builder.",
      quoteAttribution: "Starter philosophy",
      mediaUrl: "https://picsum.photos/seed/about-story/960/720",
      layout: "media-right",
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
  // Old model: `database` objects have `parent: { type: "page_id", page_id }`
  // directly.
  if (typeof parent.page_id === "string") return parent.page_id;
  // New model: `data_source` objects have `parent: { type: "database_id",
  // database_id }` — the parent is the database, not the page. We can't
  // resolve the page id without an extra API call, so return null and
  // let the caller fall back to integration-scope-only matching.
  return null;
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

/**
 * Resolve a single search result into the {databaseId, dataSourceId,
 * url, description} shape we need to wire the project. Handles both
 * Notion 2025-09-03+ `data_source` results and legacy `database`
 * results, walking parent.database_id when necessary.
 */
async function readExistingDatabaseInfo(
  apiToken: string,
  item: Record<string, unknown>
): Promise<ExistingDatabaseInfo | null> {
  const objectType = item.object;

  if (objectType === "data_source") {
    // New model: the result's `id` is the data_source id; the
    // database id is on `parent.database_id` (or fetchable from
    // the parent if not inlined).
    const dataSourceId = typeof item.id === "string" ? item.id : null;
    const parent = item.parent;
    const databaseIdFromParent =
      isRecord(parent) && typeof parent.database_id === "string"
        ? parent.database_id
        : null;
    if (!dataSourceId) return null;
    if (databaseIdFromParent) {
      return {
        databaseId: databaseIdFromParent,
        dataSourceId,
        url: databaseUrl(databaseIdFromParent, item),
        description: databaseDescription(item),
      };
    }
    // Fallback: ask the data_source endpoint for its full shape.
    const stdout = await runOrThrowNtn(
      ["api", `v1/data_sources/${dataSourceId}`],
      { env: { NOTION_API_TOKEN: apiToken } }
    );
    const raw = JSON.parse(stdout) as Record<string, unknown>;
    const parentDb = raw.parent;
    const databaseId =
      isRecord(parentDb) && typeof parentDb.database_id === "string"
        ? parentDb.database_id
        : dataSourceId;
    return {
      databaseId,
      dataSourceId,
      url: databaseUrl(databaseId, raw),
      description: databaseDescription(raw),
    };
  }

  // Legacy `database` object (or anything else with an `id`).
  const databaseId = typeof item.id === "string" ? item.id : null;
  if (!databaseId) return null;
  return {
    databaseId,
    dataSourceId:
      firstDataSourceId(item) ??
      (await retrieveDatabaseInfo(apiToken, databaseId)).dataSourceId,
    url: databaseUrl(databaseId, item),
    description: databaseDescription(item),
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
        // Notion 2025-09-03 API no longer accepts `"database"` as a
        // search filter value; `"data_source"` covers new-style
        // databases (which are now content-only objects whose parent
        // is the database container). We also accept legacy
        // `object === "database"` results below in case the
        // integration's workspace still has any.
        filter: { property: "object", value: "data_source" },
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
      if (!isRecord(item)) return false;
      // Accept both the new `data_source` and the legacy `database`
      // object types — Notion's search is supposed to filter server-
      // side, but we keep the client check defensive.
      if (item.object !== "data_source" && item.object !== "database") return false;
      const itemParent = parentPageId(item);
      // data_source items return null here (the parent is a database,
      // not a page) — trust the integration's access scope for them.
      if (itemParent !== null && compactNotionId(itemParent) !== expectedParent) return false;
      return extractScaffoldKey(databaseDescription(item)) === input.stableKey;
    })
    .sort((a, b) => lastEditedTime(b).localeCompare(lastEditedTime(a)));

  if (matches.length === 0) return null;
  if (matches.length > 1) {
    console.warn(
      `[notion] found ${matches.length} databases with scaffold key "${input.stableKey}" under the parent page; reusing the most recently edited one.`
    );
  }
  return readExistingDatabaseInfo(input.apiToken, matches[0]);
}

async function findExistingDatabaseByTitle(input: {
  apiToken: string;
  parentPageId: string;
  title: string;
}): Promise<ExistingDatabaseInfo | null> {
  const body = {
    query: input.title,
    // Notion 2025-09-03 API no longer accepts `"database"`; see the
    // matching note in findExistingDatabaseByStableKey.
    filter: { property: "object", value: "data_source" },
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
    if (item.object !== "data_source" && item.object !== "database") return false;
    if (normalizeTitle(databaseTitle(item)) !== expectedTitle) return false;
    const itemParent = parentPageId(item);
    // data_source items return null here — trust the integration's
    // access scope for them (see parentPageId's comment).
    if (itemParent !== null && compactNotionId(itemParent) !== expectedParent) return false;
    return true;
  });

  if (matches.length === 0) return null;
  if (matches.length > 1) {
    console.warn(
      `[notion] found ${matches.length} databases named "${input.title}" under the parent page; reusing the most recently edited one.`
    );
  }
  return readExistingDatabaseInfo(input.apiToken, matches[0]);
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
    Blocks: { rich_text: {} },
    Cover: { files: {} },
  };
}

function buildBlocksProperties(): NotionPropertyMap {
  return {
    Name: { title: {} },
    Slug: { rich_text: {} },
    Status: { select: {} },
    Type: { select: {} },
    Description: { rich_text: {} },
    "Page Keys": { rich_text: {} },
    Order: { number: {} },
    Cover: { files: {} },
    Eyebrow: { rich_text: {} },
    Headline: { rich_text: {} },
    Subheadline: { rich_text: {} },
    "Primary CTA Label": { rich_text: {} },
    "Primary CTA Href": { url: {} },
    "Secondary CTA Label": { rich_text: {} },
    "Secondary CTA Href": { url: {} },
    Alignment: { select: {} },
    Theme: { select: {} },
    Columns: { number: {} },
    Items: { rich_text: {} },
    Body: { rich_text: {} },
    Quote: { rich_text: {} },
    "Quote Attribution": { rich_text: {} },
    "Media Url": { url: {} },
    Layout: { select: {} },
  };
}

function richText(content: string) {
  return content ? [{ text: { content } }] : [];
}

function selectPropertyValue(name?: string) {
  return name ? { select: { name } } : { select: null };
}

function urlPropertyValue(url?: string) {
  return { url: url ?? null };
}

function numberPropertyValue(value?: number) {
  return { number: value ?? null };
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
      Blocks: {
        rich_text: richText(JSON.stringify(page.blocks ?? [])),
      },
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

function buildSiteBlockPayload(input: {
  databaseId: string;
  projectName: string;
  block: SampleSiteBlock;
}) {
  const { block, databaseId, projectName } = input;
  const coverUrl = `https://picsum.photos/seed/${slugify(projectName)}-${block.coverSeed}/1200/600`;
  return {
    parent: { type: "database_id", database_id: databaseId },
    cover: {
      type: "external",
      external: { url: coverUrl },
    },
    properties: {
      Name: { title: richText(block.title) },
      Slug: { rich_text: richText(block.slug) },
      Status: { select: { name: "Published" } },
      Type: { select: { name: block.type } },
      Description: { rich_text: richText(block.description) },
      "Page Keys": { rich_text: richText(JSON.stringify(block.pageKeys)) },
      Order: { number: block.order },
      Eyebrow: {
        rich_text: richText(block.type === "hero" ? block.eyebrow : ""),
      },
      Headline: {
        rich_text: richText(
          block.type === "hero" ||
            block.type === "feature-grid" ||
            block.type === "story"
            ? block.headline
            : ""
        ),
      },
      Subheadline: {
        rich_text: richText(block.type === "hero" ? block.subheadline : ""),
      },
      "Primary CTA Label": {
        rich_text: richText(
          block.type === "hero" ? block.primaryCtaLabel : ""
        ),
      },
      "Primary CTA Href": urlPropertyValue(
        block.type === "hero" ? block.primaryCtaHref : undefined
      ),
      "Secondary CTA Label": {
        rich_text: richText(
          block.type === "hero" ? block.secondaryCtaLabel ?? "" : ""
        ),
      },
      "Secondary CTA Href": urlPropertyValue(
        block.type === "hero" ? block.secondaryCtaHref : undefined
      ),
      Alignment: selectPropertyValue(
        block.type === "hero" ? block.alignment : undefined
      ),
      Theme: selectPropertyValue(
        block.type === "hero" ? block.theme : undefined
      ),
      Columns: numberPropertyValue(
        block.type === "feature-grid" ? block.columns : undefined
      ),
      Items: {
        rich_text: richText(
          block.type === "feature-grid" ? JSON.stringify(block.items) : ""
        ),
      },
      Body: {
        rich_text: richText(
          block.type === "feature-grid" || block.type === "story"
            ? block.body
            : ""
        ),
      },
      Quote: {
        rich_text: richText(block.type === "story" ? block.quote ?? "" : ""),
      },
      "Quote Attribution": {
        rich_text: richText(
          block.type === "story" ? block.quoteAttribution ?? "" : ""
        ),
      },
      "Media Url": urlPropertyValue(
        block.type === "story" ? block.mediaUrl : undefined
      ),
      Layout: selectPropertyValue(
        block.type === "story" ? block.layout : undefined
      ),
      Cover: {
        files: [
          {
            name: `${block.slug}-cover`,
            type: "external",
            external: { url: coverUrl },
          },
        ],
      },
    },
    children: [],
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

export async function ensureBlocksDatabase(
  input: PagesProvisionInput
): Promise<NotionProvisionResult> {
  const title = `${input.projectName} Blocks`;
  const stableKey = "blocks:default";
  const properties = buildBlocksProperties();
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
  for (const block of sampleBlocks(input)) {
    const body = buildSiteBlockPayload({
      databaseId,
      projectName: input.projectName,
      block,
    });
    const result = await runNtn(["api", "v1/pages", "-d", JSON.stringify(body)], {
      env: { NOTION_API_TOKEN: input.apiToken },
    });
    if (result.code === 0) {
      seeded++;
    } else {
      const detail = (result.stderr || result.stdout).trim().slice(0, 500);
      console.warn(
        `[notion seed] block "${block.slug}" failed (code ${result.code}): ${detail}`
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
  buildBlocksProperties,
  buildSitePagePayload,
  buildSiteBlockPayload,
  resolveTitlePropertyName,
  buildSamplePage,
  sampleSitePages,
  sampleBlocks,
  samplePostFor,
  buildScaffoldMarker,
  extractScaffoldKey,
  mergeDescriptionWithScaffoldMarker,
  missingPropertiesForPatch,
  buildSiteSettingsProperties,
  buildSiteSettingsSeedPage,
};

// ---------------------------------------------------------------------------
// Site settings (singleton row)
//
// The generated project reads site-level config (name, tagline, description,
// default locale, social image) from a dedicated Notion data source. The
// scaffolder creates that data source here, with a fixed schema the runtime
// loader knows how to read, and seeds a single row pre-populated with the
// project name + a placeholder description. Operators can edit the row in
// Notion after scaffolding; changes show up within 5 minutes (KV cache TTL)
// or immediately via the admin revalidate endpoint.
// ---------------------------------------------------------------------------

/** Field names the runtime loader reads in `lib/site/settings.ts`. */
export const SITE_SETTINGS_FIELDS = [
  "Site Name", // title
  "Tagline", // rich_text
  "Description", // rich_text
  "Default Locale", // select
  "Social Image", // url
] as const;

export interface SiteSettingsProvisionInput {
  apiToken: string;
  parentPageId: string;
  projectName: string;
  /** Initial description seeded into the row. */
  description: string;
  /** Initial default locale seeded into the row (e.g. "en"). */
  defaultLocale: string;
}

export interface SiteSettingsProvisionResult {
  dataSourceId: string;
  databaseId: string;
  url: string;
  /** True when an existing data source was reused; false when this run created a new one. */
  reused: boolean;
  /** Number of seed pages inserted (0 if seeding was skipped or the data source was reused). */
  seeded: number;
}

/**
 * Build the Notion `properties` object for the site-settings data source.
 *
 * Mirrors `siteSettingsSource.fields` in the generated
 * `lib/content/models.ts`:
 *   - `Site Name` → title (Notion's only title column)
 *   - `Tagline`   → rich_text
 *   - `Description` → rich_text
 *   - `Default Locale` → select
 *   - `Social Image` → url
 *
 * Keep the `SITE_SETTINGS_FIELDS` array in sync with this map. The
 * scaffolder's seed row and the runtime loader both depend on it.
 */
export function buildSiteSettingsProperties(): NotionPropertyMap {
  const props: NotionPropertyMap = {
    // 5 pre-existing
    "Site Name": { title: {} },
    Tagline: { rich_text: {} },
    Description: { rich_text: {} },
    "Default Locale": { select: {} },
    "Social Image": { url: {} },
    // 12 new (0.5.4) — SEO, navigation, theme, footer
    "Meta Title": { rich_text: {} },
    "Meta Description": { rich_text: {} },
    "OG Image": { url: {} },
    Nav: { rich_text: {} },
    "Nav CTA": { rich_text: {} },
    "Primary Color": { select: {} },
    "Accent Color": { select: {} },
    "Font Family": { select: {} },
    "Footer Columns": { rich_text: {} },
    "Footer Copyright": { rich_text: {} },
    "Footer Social Links": { rich_text: {} },
    "Footer Tagline": { rich_text: {} },
  };
  return props;
}

/**
 * Build the single seed page for the site-settings data source.
 *
 * The page carries the project name and a placeholder description so
 * the home page renders something useful before the operator customizes
 * it in Notion. The runtime loader falls back to
 * `fallbackSiteConfig` if the row is missing, so an unedited seed
 * page is fine — but a populated one means the very first request
 * after scaffolding already shows the right site name everywhere.
 *
 * `parent` uses `data_source_id` (Notion's 2025-09-03 schema).
 * Passing the legacy `database_id` here silently fails with
 * `validation_error` and the seed step reports "0 page" — which
 * is exactly the bug we hit when the Notion API started requiring
 * data sources for page parents.
 */
export function buildSiteSettingsSeedPage(input: {
  projectName: string;
  description: string;
  defaultLocale: string;
  dataSourceId: string;
}) {
  const defaultNav = JSON.stringify([
    { label: "Home", href: "/" },
    { label: "Blog", href: "/blog" },
  ]);
  const footerCopyright = `© ${new Date().getFullYear()} ${input.projectName}`;
  return {
    parent: { type: "data_source_id", data_source_id: input.dataSourceId },
    properties: {
      "Site Name": {
        title: [{ text: { content: input.projectName } }],
      },
      Tagline: {
        rich_text: [{ text: { content: input.projectName } }],
      },
      Description: {
        rich_text: [{ text: { content: input.description } }],
      },
      "Default Locale": {
        select: { name: input.defaultLocale },
      },
      "Meta Title": {
        rich_text: [{ text: { content: input.projectName } }],
      },
      "Meta Description": {
        rich_text: [{ text: { content: input.description } }],
      },
      "OG Image": { url: null },
      Nav: {
        rich_text: [{ text: { content: defaultNav } }],
      },
      "Nav CTA": { rich_text: [] },
      "Primary Color": { select: { name: "slate" } },
      "Accent Color": { select: { name: "blue" } },
      "Font Family": { select: { name: "inter" } },
      "Footer Columns": {
        rich_text: [{ text: { content: "[]" } }],
      },
      "Footer Copyright": {
        rich_text: [{ text: { content: footerCopyright } }],
      },
      "Footer Social Links": {
        rich_text: [{ text: { content: "[]" } }],
      },
      "Footer Tagline": { rich_text: [] },
    },
  };
}

/**
 * Create the site-settings data source under the given parent page and
 * insert the seed row. Same Notion API dance as
 * `ensureNotionDatabase`, minus the multi-page seeding — the singleton
 * row is created up front so the home page works before the operator
 * has opened Notion.
 */
export async function ensureSiteSettingsDatabase(
  input: SiteSettingsProvisionInput
): Promise<SiteSettingsProvisionResult> {
  const stableKey = "site-settings";
  const title = `${input.projectName} Site Settings`;
  const properties = buildSiteSettingsProperties();

  // 1) Stable-key match.
  const existingByStableKey = await findExistingDatabaseByStableKey({
    apiToken: input.apiToken,
    parentPageId: input.parentPageId,
    stableKey,
  });

  // 2) Title fallback.
  const existing =
    existingByStableKey ??
    (await findExistingDatabaseByTitle({
      apiToken: input.apiToken,
      parentPageId: input.parentPageId,
      title,
    }));

  if (existing) {
    // Make sure the schema has every property the 0.5.4+ schema
    // expects. Notion adds new properties with no destructive
    // effect on existing rows.
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
      reused: true,
      seeded: 0,
    };
  }

  // 3) Cold start — create with the scaffold marker baked in.
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

  // 4) Seed the singleton row.
  const seed = buildSiteSettingsSeedPage({
    projectName: input.projectName,
    description: input.description,
    defaultLocale: input.defaultLocale,
    dataSourceId,
  });
  const seedResult = await runNtn(
    ["api", "v1/pages", "-d", JSON.stringify(seed)],
    { env: { NOTION_API_TOKEN: input.apiToken } }
  );
  if (seedResult.code !== 0) {
    const detail = (seedResult.stderr || seedResult.stdout).trim().slice(0, 500);
    console.warn(
      `[notion site-settings seed] failed (code ${seedResult.code}): ${detail}`
    );
  }

  return {
    dataSourceId,
    databaseId,
    url,
    reused: false,
    seeded: seedResult.code === 0 ? 1 : 0,
  };
}
