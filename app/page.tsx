// 部署计时测试
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, BookOpen, Code, Shield } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted">
      <header className="container mx-auto flex items-center justify-end p-4">
        <ThemeToggle />
      </header>

      <main className="container mx-auto flex max-w-3xl flex-col items-center px-4 py-16 text-center">
        <div className="mb-6 inline-flex items-center rounded-full border bg-muted/50 px-3 py-1 text-xs text-muted-foreground">
          <span className="mr-2 h-1.5 w-1.5 rounded-full bg-emerald-500" />
          RSC + Cloudflare Workers + D1
        </div>

        <h1 className="text-5xl font-bold tracking-tight md:text-6xl">
          vinext Blog
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted-foreground">
          A minimal blog running on{" "}
          <span className="font-semibold text-foreground">vinext</span> · Vite
          + React 19 + Cloudflare edge, with admin panel backed by D1.
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/blog">
              <BookOpen className="mr-2 h-4 w-4" />
              Read the blog
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/login">
              <Shield className="mr-2 h-4 w-4" />
              Admin
            </Link>
          </Button>
        </div>

        <Card className="mt-16 w-full text-left">
          <CardContent className="grid gap-6 p-6 md:grid-cols-3">
            <Feature
              title="Edge RSC"
              desc="React Server Components run on Cloudflare Workers, served from the edge."
            />
            <Feature
              title="D1 Storage"
              desc="Posts stored in Cloudflare D1 (SQLite at the edge), queried from RSC."
            />
            <Feature
              title="Admin Panel"
              desc="Password-gated admin with create / edit / delete posts via Server Actions."
            />
          </CardContent>
        </Card>

        <p className="mt-12 text-xs text-muted-foreground">
          <a
            href="https://github.com/your-username/vinext"
            className="inline-flex items-center hover:text-foreground"
          >
            <Code className="mr-1 h-3 w-3" />
            Source
          </a>
        </p>
      </main>
    </div>
  );
}

function Feature({ title, desc }: { title: string; desc: string }) {
  return (
    <div>
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
    </div>
  );
}
