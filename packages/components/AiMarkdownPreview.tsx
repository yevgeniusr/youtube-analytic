'use client';

import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';

const mdComponents: Components = {
  h1: (props) => <h1 className="ai-md-h1" {...props} />,
  h2: (props) => <h2 className="ai-md-h2" {...props} />,
  h3: (props) => <h3 className="ai-md-h3" {...props} />,
  h4: (props) => <h4 className="ai-md-h4" {...props} />,
  p: (props) => <p className="ai-md-p" {...props} />,
  ul: (props) => <ul className="ai-md-ul" {...props} />,
  ol: (props) => <ol className="ai-md-ol" {...props} />,
  li: (props) => <li className="ai-md-li" {...props} />,
  strong: (props) => <strong className="ai-md-strong" {...props} />,
  em: (props) => <em className="ai-md-em" {...props} />,
  a: (props) => <a className="ai-md-a" target="_blank" rel="noopener noreferrer" {...props} />,
  blockquote: (props) => <blockquote className="ai-md-blockquote" {...props} />,
  hr: (props) => <hr className="ai-md-hr" {...props} />,
  table: (props) => <table className="ai-md-table" {...props} />,
  thead: (props) => <thead className="ai-md-thead" {...props} />,
  tbody: (props) => <tbody className="ai-md-tbody" {...props} />,
  tr: (props) => <tr className="ai-md-tr" {...props} />,
  th: (props) => <th className="ai-md-th" {...props} />,
  td: (props) => <td className="ai-md-td" {...props} />,
  code: ({ className, children, ...rest }) => {
    const isBlock = className?.includes('language-');
    if (isBlock) {
      return (
        <code className={className} {...rest}>
          {children}
        </code>
      );
    }
    return (
      <code className="ai-md-code-inline" {...rest}>
        {children}
      </code>
    );
  },
  pre: (props) => <pre className="ai-md-pre" {...props} />,
};

type AiMarkdownPreviewProps = {
  markdown: string;
  emptyLabel?: string;
  'aria-label'?: string;
};

export function AiMarkdownPreview({ markdown, emptyLabel, 'aria-label': ariaLabel }: AiMarkdownPreviewProps) {
  const trimmed = markdown.trim();
  if (!trimmed) {
    return (
      <div
        className="ai-export-md-rendered ai-export-md-rendered--empty"
        aria-label={ariaLabel}
      >
        {emptyLabel ?? 'Generated Markdown appears here…'}
      </div>
    );
  }

  return (
    <div
      className="ai-export-md-rendered"
      aria-label={ariaLabel}
    >
      <Markdown remarkPlugins={[remarkGfm]} components={mdComponents}>
        {markdown}
      </Markdown>
    </div>
  );
}
