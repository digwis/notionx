import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, Search, Shield, X } from "lucide-react";
import { PublicCoverImage } from "@/components/PublicCoverImage";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export type ContentNavItem = {
  href: string;
  label: string;
  icon: ReactNode;
};

type ContentListHeaderProps = {
  currentHref: string;
  currentLabel: string;
  currentIcon: ReactNode;
  navItems?: readonly ContentNavItem[];
};

export function ContentListHeader({
  currentHref,
  currentLabel,
  currentIcon,
  navItems = [],
}: ContentListHeaderProps) {
  return (
    <header className="border-b">
      <div className="container mx-auto flex items-center justify-between gap-3 p-4">
        <Link
          href={currentHref}
          className="inline-flex min-w-0 items-center text-sm font-medium hover:underline"
        >
          <span className="mr-2 shrink-0">{currentIcon}</span>
          <span className="truncate">{currentLabel}</span>
        </Link>
        <div className="flex shrink-0 items-center gap-2">
          {navItems.map((item) => (
            <Button key={item.href} asChild variant="ghost" size="sm">
              <Link href={item.href}>
                <span className="mr-1 h-3 w-3">{item.icon}</span>
                {item.label}
              </Link>
            </Button>
          ))}
          <Button asChild variant="ghost" size="sm">
            <Link href="/login">
              <Shield className="mr-1 h-3 w-3" />
              Admin
            </Link>
          </Button>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

type ContentListIntroProps = {
  title: string;
  description: string;
  eyebrow?: string;
  action: string;
  query: string;
  clearHref: string;
  placeholder: string;
  totalCount: number;
  visibleCount: number;
  itemLabel: string;
  icon: ReactNode;
};

export function ContentListIntro({
  title,
  description,
  eyebrow = "Notion Source",
  action,
  query,
  clearHref,
  placeholder,
  totalCount,
  visibleCount,
  itemLabel,
  icon,
}: ContentListIntroProps) {
  const countText = query
    ? `${visibleCount} / ${totalCount} ${itemLabel}`
    : `${visibleCount} ${itemLabel}`;

  return (
    <div className="mb-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
      <div>
        {eyebrow && (
          <p className="mb-2 text-sm font-medium text-muted-foreground">
            {eyebrow}
          </p>
        )}
        <h1 className="text-4xl font-bold tracking-tight">{title}</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">{description}</p>
      </div>
      <div className="flex w-full flex-col gap-3 md:max-w-sm">
        <form action={action}>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              name="q"
              defaultValue={query}
              placeholder={placeholder}
              className="pr-10 pl-9"
            />
            {query && (
              <Button
                asChild
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2"
              >
                <Link href={clearHref} aria-label="清除搜索">
                  <X className="h-4 w-4" />
                </Link>
              </Button>
            )}
          </div>
        </form>
        <div className="inline-flex min-h-10 items-center gap-2 rounded-md border px-3 py-2 text-sm text-muted-foreground">
          <span className="h-4 w-4 shrink-0">{icon}</span>
          <span>{countText}</span>
        </div>
      </div>
    </div>
  );
}

export function ContentSearchNotice({
  query,
  visibleCount,
  totalCount,
  itemLabel,
  clearHref,
}: {
  query: string;
  visibleCount: number;
  totalCount: number;
  itemLabel: string;
  clearHref: string;
}) {
  if (!query) return null;

  return (
    <div className="mb-6 flex items-center justify-between gap-3 rounded-md border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
      <span>
        搜索 “{query}”：{visibleCount} / {totalCount} {itemLabel}
      </span>
      <Button asChild variant="ghost" size="sm">
        <Link href={clearHref}>清除</Link>
      </Button>
    </div>
  );
}

export function ContentEmptyState({
  message,
}: {
  message: string;
}) {
  return (
    <Card>
      <CardContent className="py-12 text-center text-muted-foreground">
        {message}
      </CardContent>
    </Card>
  );
}

export function ContentGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {children}
    </div>
  );
}

export function ContentCardLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className="group block">
      <Card className="flex h-full flex-col overflow-hidden transition-all group-hover:-translate-y-1 group-hover:border-foreground/30 group-hover:shadow-lg">
        {children}
      </Card>
    </Link>
  );
}

export function ContentCardCover({
  src,
  alt,
  aspectClassName,
  fallback,
  index,
  hoverScale = "group-hover:scale-105",
}: {
  src?: string | null;
  alt: string;
  aspectClassName: string;
  fallback: ReactNode;
  index: number;
  hoverScale?: string;
}) {
  if (!src) {
    return (
      <div
        className={`flex w-full items-center justify-center bg-muted text-muted-foreground ${aspectClassName}`}
      >
        {fallback}
      </div>
    );
  }

  return (
    <div className={`relative w-full overflow-hidden bg-muted ${aspectClassName}`}>
      <PublicCoverImage
        src={src}
        alt={alt}
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        className={`h-full w-full object-cover transition-transform duration-500 ${hoverScale}`}
        index={index}
        variant="list"
      />
    </div>
  );
}

export function ContentCardBody({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <>
      <CardHeader className="flex-1">
        <CardTitle className="line-clamp-2 text-xl leading-tight group-hover:underline">
          {title}
        </CardTitle>
        <CardDescription className="line-clamp-3">
          {description}
        </CardDescription>
      </CardHeader>
      {children}
    </>
  );
}

export function ContentCardTags({ tags }: { tags: readonly string[] }) {
  if (tags.length === 0) return null;

  return (
    <div className="mb-3 flex flex-wrap gap-1.5">
      {tags.slice(0, 3).map((tag) => (
        <Badge key={tag} variant="secondary" className="text-xs">
          {tag}
        </Badge>
      ))}
      {tags.length > 3 && (
        <span className="text-xs text-muted-foreground">
          +{tags.length - 3}
        </span>
      )}
    </div>
  );
}

export function ContentCardFooter({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <CardContent>
      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <div className="min-w-0">{children}</div>
        <ArrowRight className="h-3 w-3 shrink-0 transition-transform group-hover:translate-x-1" />
      </div>
    </CardContent>
  );
}
