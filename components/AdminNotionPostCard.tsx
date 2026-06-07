import { ExternalLink, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Props = {
  title: string;
  description: string;
  href: string;
  actionLabel?: string;
};

export default function AdminNotionPostCard({
  title,
  description,
  href,
  actionLabel = "在 Notion 中打开",
}: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-4 w-4" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild>
          <a href={href} target="_blank" rel="noreferrer">
            <ExternalLink className="mr-1 h-4 w-4" />
            {actionLabel}
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}
