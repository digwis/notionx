import type { Metadata } from "next";
import { getRuntimePlatform } from "@/lib/platform/current";
import { getNotionPostsMeta } from "@/lib/notion/posts";
import { filterItemsBySearchIndex } from "@/lib/content/search-index";
import { filterPostsBySearch, normalizeSearchQuery } from "@/lib/content/search";
import { blogContentModel, movieContentModel } from "@/lib/content/models";
import SubscribeFormLazy from "@/components/SubscribeFormLazy";
import {
  ContentCardBody,
  ContentCardCover,
  ContentCardFooter,
  ContentCardLink,
  ContentCardTags,
  ContentEmptyState,
  ContentGrid,
  ContentListHeader,
  ContentListIntro,
  ContentSearchNotice,
} from "@/components/ContentList";
import { BookOpen, Film } from "lucide-react";

export const metadata: Metadata = {
  title: `${blogContentModel.ui.listTitle} · vinext`,
  description: blogContentModel.ui.listDescription,
};

// 边缘 ISR：每 60s 重新生成。配合 revalidatePath() 可立即失效。
export const revalidate = 60;

type Props = {
  searchParams: Promise<{ q?: string }>;
};

export default async function BlogIndexPage({ searchParams }: Props) {
  const { q } = await searchParams;
  const searchQuery = normalizeSearchQuery(q);
  const allPosts = await getNotionPostsMeta();
  const posts = await filterItemsBySearchIndex(allPosts, searchQuery, {
    modelId: blogContentModel.id,
    filterFallback: filterPostsBySearch,
    getDatabase: () => getRuntimePlatform().database,
  });

  return (
    <div className="min-h-screen bg-background">
      <ContentListHeader
        currentHref={blogContentModel.routes.listPath}
        currentLabel={blogContentModel.ui.listTitle}
        currentIcon={<BookOpen className="h-4 w-4" />}
        navItems={[
          {
            href: movieContentModel.routes.listPath,
            label: movieContentModel.ui.navLabel,
            icon: <Film className="h-3 w-3" />,
          },
        ]}
      />

      <main className="container mx-auto max-w-6xl px-4 py-12">
        <ContentListIntro
          title={blogContentModel.ui.listTitle}
          description={blogContentModel.ui.listDescription}
          action={blogContentModel.routes.listPath}
          query={searchQuery}
          clearHref={blogContentModel.routes.listPath}
          placeholder="搜索标题、正文、作者、标签"
          totalCount={allPosts.length}
          visibleCount={posts.length}
          itemLabel="篇文章"
          icon={<BookOpen className="h-4 w-4" />}
        />

        <ContentSearchNotice
          query={searchQuery}
          visibleCount={posts.length}
          totalCount={allPosts.length}
          itemLabel="篇文章"
          clearHref={blogContentModel.routes.listPath}
        />

        {posts.length === 0 ? (
          <ContentEmptyState
            message={searchQuery ? "没有匹配的文章。" : blogContentModel.ui.emptyState}
          />
        ) : (
          <ContentGrid>
            {posts.map((post, index) => (
              <ContentCardLink key={post.slug} href={`/blog/${post.slug}`}>
                <ContentCardCover
                  src={post.coverImage}
                  alt={post.title}
                  aspectClassName="aspect-[16/9]"
                  index={index}
                  hoverScale="group-hover:scale-105"
                  fallback={<BookOpen className="h-12 w-12 opacity-50" />}
                />
                <ContentCardBody
                  title={post.title}
                  description={post.description}
                >
                  <ContentCardFooter>
                    <ContentCardTags tags={post.tags} />
                    <div className="flex flex-wrap items-center gap-1.5">
                      <time dateTime={post.date}>{post.date}</time>
                      <span>·</span>
                      <span>{post.author}</span>
                    </div>
                  </ContentCardFooter>
                </ContentCardBody>
              </ContentCardLink>
            ))}
          </ContentGrid>
        )}

        <div className="mt-16">
          <SubscribeFormLazy />
        </div>
      </main>
    </div>
  );
}
