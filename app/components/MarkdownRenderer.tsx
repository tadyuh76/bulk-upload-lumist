import React, { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import { cn, decodeHtmlEntities } from "@/lib/utils";
import "katex/dist/katex.min.css";

type MarkdownRendererProps = {
  /**
   * The markdown content to render
   */
  content: string;
  /**
   * Size variant for the prose container
   */
  size?: "sm" | "base" | "lg" | "xl" | "2xl";
  /**
   * Additional CSS classes to apply to the prose container
   */
  className?: string;
  /**
   * Whether to enable dark mode styling
   */
  darkMode?: boolean;
  /**
   * Color theme for the prose content
   */
  theme?: "gray" | "slate" | "zinc" | "neutral" | "stone";
};

/**
 * A unified markdown renderer component using ReactMarkdown with Tailwind Typography.
 * Provides consistent, beautiful typography styling across the application.
 * @param content - The markdown content to render
 * @param size - Size variant (sm, base, lg, xl, 2xl)
 * @param className - Additional CSS classes
 * @param darkMode - Whether to enable dark mode styling
 * @param theme - Color theme for the prose content
 */
export default function MarkdownRenderer({
  content,
  size = "base",
  className,
  darkMode = false,
  theme = "gray",
}: MarkdownRendererProps) {
  // Decode HTML entities before processing the content
  const decodedContent = useMemo(() => decodeHtmlEntities(content), [content]);

  const proseClasses = useMemo(
    () =>
      cn(
        "prose",
        {
          "prose-sm": size === "sm",
          "prose-lg": size === "lg",
          "prose-xl": size === "xl",
          "prose-2xl": size === "2xl",
        },
        {
          "prose-gray": theme === "gray",
          "prose-slate": theme === "slate",
          "prose-zinc": theme === "zinc",
          "prose-neutral": theme === "neutral",
          "prose-stone": theme === "stone",
        },
        {
          "prose-invert": darkMode,
        },
        "max-w-none", // Remove max-width restriction
        className
      ),
    [size, theme, darkMode, className]
  );

  const markdownComponents = useMemo(
    () => ({
      // Headings with proper sizing and spacing
      h1: (props: React.HTMLProps<HTMLHeadingElement>) => (
        <h1
          className="mb-4 text-xl font-bold md:text-2xl lg:text-3xl"
          {...props}
        />
      ),
      h2: (props: React.HTMLProps<HTMLHeadingElement>) => (
        <h2
          className="my-3 text-lg font-bold md:text-xl lg:text-2xl"
          {...props}
        />
      ),
      h3: (props: React.HTMLProps<HTMLHeadingElement>) => (
        <h3 className="my-2 font-bold md:text-lg lg:text-xl" {...props} />
      ),
      h4: (props: React.HTMLProps<HTMLHeadingElement>) => (
        <h4 className="my-2 font-semibold md:text-base lg:text-lg" {...props} />
      ),
      h5: (props: React.HTMLProps<HTMLHeadingElement>) => (
        <h5 className="my-1 text-sm font-semibold md:text-base" {...props} />
      ),
      h6: (props: React.HTMLProps<HTMLHeadingElement>) => (
        <h6 className="my-1 text-xs font-semibold md:text-sm" {...props} />
      ),
      // Text formatting
      u: (props: React.HTMLProps<HTMLElement>) => (
        <u className="underline" {...props} />
      ),
      // Lists with proper styling
      ul: (props: React.HTMLProps<HTMLUListElement>) => (
        <ul className="mb-4 list-disc pl-6" {...props} />
      ),
      ol: (props: React.OlHTMLAttributes<HTMLOListElement>) => (
        <ol className="mb-4 list-decimal pl-6" {...props} />
      ),
      li: (props: React.HTMLProps<HTMLLIElement>) => (
        <li className="mb-1" {...props} />
      ),
      // Tables with responsive design and borders
      table: (props: React.HTMLProps<HTMLTableElement>) => (
        <div className="mb-4 overflow-x-auto">
          <table
            className="border-primary/20 w-full table-auto border"
            {...props}
          />
        </div>
      ),
      th: (props: React.HTMLProps<HTMLTableCellElement>) => (
        <th
          className="bg-primary/20 border-primary/20 border px-4 py-2 text-left font-semibold"
          {...props}
        />
      ),
      td: (props: React.HTMLProps<HTMLTableCellElement>) => (
        <td className="border-primary/20 border px-4 py-2" {...props} />
      ),
      // Paragraphs with proper spacing
      p: (props: React.HTMLProps<HTMLParagraphElement>) => (
        <p className="mb-4 leading-relaxed last:mb-0" {...props} />
      ),
      // Code blocks with proper styling
      pre: (props: React.HTMLProps<HTMLPreElement>) => (
        <pre
          className="bg-muted mb-4 overflow-x-auto rounded-lg p-4 text-sm"
          {...props}
        />
      ),
      code: (props: React.HTMLProps<HTMLElement>) => (
        <code
          className="bg-muted rounded px-1 py-0.5 font-mono text-sm"
          {...props}
        />
      ),
      // Blockquotes
      blockquote: (props: React.HTMLProps<HTMLQuoteElement>) => (
        <blockquote
          className="border-muted text-muted-foreground mb-4 border-l-4 pl-4 italic"
          {...props}
        />
      ),
      // Links
      a: (props: React.HTMLProps<HTMLAnchorElement>) => (
        <a
          className="text-primary hover:text-primary/80 underline underline-offset-4"
          {...props}
        />
      ),
      // Horizontal rules
      hr: (props: React.HTMLProps<HTMLHRElement>) => (
        <hr className="border-muted my-6" {...props} />
      ),
      // Images with proper alt text handling
      img: ({
        src,
        alt,
        ...props
      }: React.ImgHTMLAttributes<HTMLImageElement>) => (
        <img
          src={typeof src === "string" ? src : ""}
          alt={alt || ""}
          className="mb-4 h-auto max-w-full rounded-lg"
          {...props}
        />
      ),
    }),
    []
  );

  return (
    <div className={proseClasses}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[
          [
            rehypeKatex,
            {
              strict: false,
              throwOnError: false,
            },
          ],
          rehypeRaw,
        ]}
        components={markdownComponents}
      >
        {decodedContent}
      </ReactMarkdown>
    </div>
  );
}
