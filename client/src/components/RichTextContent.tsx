import type { HTMLAttributes } from "react";

type RichTextContentProps = HTMLAttributes<HTMLDivElement> & {
  html: string;
};

export default function RichTextContent({ html, className, ...props }: RichTextContentProps) {
  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} {...props} />;
}
