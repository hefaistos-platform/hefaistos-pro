/**
 * MarkdownRenderer Component
 * Provides consistent markdown rendering with proper sanitization
 */

import React from 'react';
import ReactMarkdown from 'react-markdown';
import { MARKDOWN_PROSE_CLASSES } from '../config/markdownConfig';

interface MarkdownRendererProps {
  /** The markdown content to render */
  content: string | undefined;
  /** CSS prose class variant (default, small, compact, inline) */
  variant?: keyof typeof MARKDOWN_PROSE_CLASSES;
  /** Additional CSS classes */
  className?: string;
  /** Skip rendering empty content */
  skipEmpty?: boolean;
}

/**
 * Renders markdown content with consistent styling and sanitization
 * Replaces all ad-hoc ReactMarkdown usage across the app
 * 
 * Features:
 * - Consistent prose styling across the application
 * - Safe markdown rendering with proper component overrides
 * - Links automatically open in new tabs
 * - Code blocks styled consistently
 * - Blockquotes and tables handled properly
 */
export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  variant = 'default',
  className = '',
  skipEmpty = true,
}) => {
  // Skip rendering if content is empty or undefined
  if (skipEmpty && (!content || content.trim().length === 0)) {
    return null;
  }

  // Return null if content is undefined and skipEmpty is false
  if (!content) {
    return null;
  }

  // Normalize common escaped payloads (e.g. "\\n", "\\#", "\\*\\*")
  // that can appear when markdown is serialized multiple times.
  let normalizedContent = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (normalizedContent.includes('\\n') || normalizedContent.includes('\\r\\n')) {
    normalizedContent = normalizedContent.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n');
  }
  if (/\\#{1,6}\s|\\\*\*[^*]+\\\*\*|\\_[^_]+\\_|\\`[^`]+\\`/m.test(normalizedContent)) {
    normalizedContent = normalizedContent.replace(/\\([#*_`])/g, '$1');
  }

  const proseClass = MARKDOWN_PROSE_CLASSES[variant] || MARKDOWN_PROSE_CLASSES.default;
  const combinedClassName = `${proseClass} ${className}`.trim();

  return (
    <div className={combinedClassName}>
      <ReactMarkdown
        components={{
          // Ensure links open in new tab for security and prevent accidental navigation
          a: ({ node, ...props }) => (
            <a {...props} target="_blank" rel="noopener noreferrer" />
          ),
          // Add consistent styling to code blocks with proper contrast
          pre: ({ node, ...props }) => (
            <pre
              className="bg-gray-100 p-3 rounded overflow-x-auto text-sm border border-gray-300"
              {...props}
            />
          ),
          // Inline code styling
          code: (props: any) => {
            const { node, inline, ...restProps } = props;
            return (
              <code
                className={inline ? 'bg-gray-200 px-1 py-0.5 rounded text-sm font-mono' : 'font-mono'}
                {...restProps}
              />
            );
          },
          // Add consistent styling to blockquotes for visual hierarchy
          blockquote: ({ node, ...props }) => (
            <blockquote 
              className="border-l-4 border-gray-300 pl-4 italic text-gray-600 my-2"
              {...props} 
            />
          ),
          // Ensure tables are responsive and styled
          table: ({ node, ...props }) => (
            <div className="overflow-x-auto my-2">
              <table 
                className="border-collapse border border-gray-300 w-full text-sm"
                {...props} 
              />
            </div>
          ),
          // Style table headers
          thead: ({ node, ...props }) => (
            <thead className="bg-gray-100" {...props} />
          ),
          // Style table rows with alternating colors
          tbody: ({ node, ...props }) => (
            <tbody {...props} />
          ),
          tr: (props: any) => {
            const { node, isHeader, ...restProps } = props;
            return <tr className="border-b border-gray-300 hover:bg-gray-50" {...restProps} />;
          },
          td: ({ node, ...props }) => (
            <td className="border-r border-gray-300 px-3 py-2" {...props} />
          ),
          th: ({ node, ...props }) => (
            <th className="border-r border-gray-300 px-3 py-2 text-left font-semibold" {...props} />
          ),
          // Style headings for better hierarchy
          h1: ({ node, ...props }) => (
            <h1 className="text-2xl font-bold mt-4 mb-2 text-gray-900" {...props} />
          ),
          h2: ({ node, ...props }) => (
            <h2 className="text-xl font-bold mt-3 mb-2 text-gray-800" {...props} />
          ),
          h3: ({ node, ...props }) => (
            <h3 className="text-lg font-semibold mt-2 mb-1 text-gray-700" {...props} />
          ),
          // Ensure lists are properly styled
          ul: ({ node, ...props }) => (
            <ul className="list-disc list-inside space-y-1 my-2" {...props} />
          ),
          ol: ({ node, ...props }) => (
            <ol className="list-decimal list-inside space-y-1 my-2" {...props} />
          ),
          li: ({ node, ...props }) => (
            <li className="text-gray-700" {...props} />
          ),
        }}
      >
        {normalizedContent}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownRenderer;
