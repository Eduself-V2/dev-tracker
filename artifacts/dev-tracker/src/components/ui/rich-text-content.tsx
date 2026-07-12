import * as React from "react";
import DOMPurify from "dompurify";

import { cn } from "@/lib/utils";
import { plainTextToHtml } from "@/lib/rich-text";

const ALLOWED_TAGS = ["p", "br", "strong", "b", "em", "i", "s", "strike", "ul", "ol", "li", "a", "h1", "h2", "h3"];
const ALLOWED_ATTR = ["href", "target", "rel", "class"];

interface RichTextContentProps {
  html: string;
  className?: string;
}

export function RichTextContent({ html, className }: RichTextContentProps) {
  const sanitized = React.useMemo(
    () => DOMPurify.sanitize(plainTextToHtml(html), { ALLOWED_TAGS, ALLOWED_ATTR }),
    [html],
  );

  return (
    <div
      className={cn(
        "prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-headings:mt-2 prose-headings:mb-1",
        className,
      )}
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  );
}
