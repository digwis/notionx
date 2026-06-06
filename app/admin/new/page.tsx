import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import NewPostFormLazy from "@/components/NewPostFormLazy";

type Props = {
  searchParams: Promise<{ error?: string }>;
};

export default async function NewPostPage({ searchParams }: Props) {
  const { error } = await searchParams;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">新建文章</h1>
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin">
            <ArrowLeft className="mr-1 h-3 w-3" />
            返回
          </Link>
        </Button>
      </div>
      <NewPostFormLazy error={error} />
    </div>
  );
}
