import React from 'react';
import { ChessBoardDiagram } from './ChessBoardDiagram';

interface BlogContentRendererProps {
  content: string;
}

/**
 * Format inline markdown tokens: bold (**text**), italic (*text*), and code (`move`).
 */
function renderInlineMarkdown(text: string): React.ReactNode[] {
  // Regex splitting by bold (**...**), inline code (`...`), or italic (*...*)
  const tokens = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g);

  return tokens.map((token, index) => {
    if (token.startsWith('**') && token.endsWith('**')) {
      return (
        <strong key={index} className="article-strong">
          {token.slice(2, -2)}
        </strong>
      );
    }
    if (token.startsWith('`') && token.endsWith('`')) {
      return (
        <code key={index} className="article-inline-code">
          {token.slice(1, -1)}
        </code>
      );
    }
    if (token.startsWith('*') && token.endsWith('*') && !token.startsWith('**')) {
      return (
        <em key={index} className="article-em">
          {token.slice(1, -1)}
        </em>
      );
    }
    return token;
  });
}

export function BlogContentRenderer({ content }: BlogContentRendererProps) {
  if (!content) return null;

  const rawLines = content.split('\n');
  const elements: React.ReactNode[] = [];

  let currentList: { type: 'ul' | 'ol'; items: string[] } | null = null;
  let currentQuote: string[] = [];
  let inBoardBlock = false;
  let boardData: { fen: string; caption?: string; highlights: string[] } = {
    fen: '',
    caption: '',
    highlights: [],
  };

  const flushQuote = (keyIdx: number) => {
    if (currentQuote.length > 0) {
      const quoteText = currentQuote.join(' ');
      const isTip = quoteText.toLowerCase().includes('aturan') || quoteText.toLowerCase().includes('tips');
      elements.push(
        <blockquote
          key={`quote-${keyIdx}`}
          className={`article-blockquote ${isTip ? 'is-tip' : ''}`}
        >
          {renderInlineMarkdown(quoteText)}
        </blockquote>
      );
      currentQuote = [];
    }
  };

  const flushList = (keyIdx: number) => {
    if (currentList) {
      if (currentList.type === 'ul') {
        elements.push(
          <ul key={`ul-${keyIdx}`} className="article-list article-list-ul">
            {currentList.items.map((item, i) => (
              <li key={i} className="article-list-item">
                {renderInlineMarkdown(item)}
              </li>
            ))}
          </ul>
        );
      } else {
        elements.push(
          <ol key={`ol-${keyIdx}`} className="article-list article-list-ol">
            {currentList.items.map((item, i) => (
              <li key={i} className="article-list-item">
                {renderInlineMarkdown(item)}
              </li>
            ))}
          </ol>
        );
      }
      currentList = null;
    }
  };

  rawLines.forEach((line, index) => {
    const trimmed = line.trim();

    // Handle board diagram multi-line block
    if (inBoardBlock) {
      if (trimmed === ':::' || trimmed.startsWith(':::')) {
        if (boardData.fen) {
          elements.push(
            <ChessBoardDiagram
              key={`board-${index}`}
              fen={boardData.fen}
              caption={boardData.caption}
              highlightSquares={boardData.highlights}
            />
          );
        }
        inBoardBlock = false;
        boardData = { fen: '', caption: '', highlights: [] };
        return;
      }
      if (trimmed.toLowerCase().startsWith('fen:')) {
        boardData.fen = trimmed.slice(4).trim();
      } else if (trimmed.toLowerCase().startsWith('caption:')) {
        boardData.caption = trimmed.slice(8).trim();
      } else if (trimmed.toLowerCase().startsWith('highlights:')) {
        boardData.highlights = trimmed.slice(11).split(',').map((s) => s.trim());
      }
      return;
    }

    // Check for start of board diagram block
    if (trimmed === ':::board') {
      flushList(index);
      flushQuote(index);
      inBoardBlock = true;
      boardData = { fen: '', caption: '', highlights: [] };
      return;
    }

    // Check for inline single-line board diagram: :::board fen="..." caption="..." highlights="..." :::
    if (trimmed.startsWith(':::board')) {
      flushList(index);
      flushQuote(index);
      const fenMatch = trimmed.match(/fen=["']([^"']+)["']/i);
      const capMatch = trimmed.match(/caption=["']([^"']+)["']/i);
      const hiMatch = trimmed.match(/highlights=["']([^"']+)["']/i);

      if (fenMatch) {
        const fen = fenMatch[1];
        const caption = capMatch ? capMatch[1] : undefined;
        const highlights = hiMatch ? hiMatch[1].split(',').map((s) => s.trim()) : [];
        elements.push(
          <ChessBoardDiagram
            key={`board-${index}`}
            fen={fen}
            caption={caption}
            highlightSquares={highlights}
          />
        );
        return;
      }
    }

    // Check for blockquote
    if (trimmed.startsWith('>')) {
      flushList(index);
      currentQuote.push(trimmed.replace(/^>\s*/, ''));
      return;
    } else {
      flushQuote(index);
    }

    // Check for bullet list
    if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
      const itemText = trimmed.slice(2);
      if (!currentList || currentList.type !== 'ul') {
        flushList(index);
        currentList = { type: 'ul', items: [itemText] };
      } else {
        currentList.items.push(itemText);
      }
      return;
    }

    // Check for numbered list
    const numMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (numMatch) {
      const itemText = numMatch[2];
      if (!currentList || currentList.type !== 'ol') {
        flushList(index);
        currentList = { type: 'ol', items: [itemText] };
      } else {
        currentList.items.push(itemText);
      }
      return;
    }

    // If regular line, flush ongoing list
    flushList(index);

    // Empty line
    if (!trimmed) {
      return;
    }

    // Horizontal rule
    if (trimmed === '---' || trimmed === '***') {
      elements.push(<hr key={`hr-${index}`} className="article-divider" />);
      return;
    }

    // Headings
    if (trimmed.startsWith('#### ')) {
      elements.push(
        <h4 key={`h4-${index}`} className="article-h4">
          {renderInlineMarkdown(trimmed.replace(/^####\s+/, ''))}
        </h4>
      );
      return;
    }
    if (trimmed.startsWith('### ')) {
      elements.push(
        <h3 key={`h3-${index}`} className="article-h3">
          {renderInlineMarkdown(trimmed.replace(/^###\s+/, ''))}
        </h3>
      );
      return;
    }
    if (trimmed.startsWith('## ')) {
      elements.push(
        <h2 key={`h2-${index}`} className="article-h2">
          {renderInlineMarkdown(trimmed.replace(/^##\s+/, ''))}
        </h2>
      );
      return;
    }
    if (trimmed.startsWith('# ')) {
      elements.push(
        <h1 key={`h1-${index}`} className="article-h1">
          {renderInlineMarkdown(trimmed.replace(/^#\s+/, ''))}
        </h1>
      );
      return;
    }

    // Paragraph
    elements.push(
      <p key={`p-${index}`} className="article-p">
        {renderInlineMarkdown(trimmed)}
      </p>
    );
  });

  // Flush remaining quotes or lists
  flushQuote(rawLines.length);
  flushList(rawLines.length);

  return <div className="article-content-body">{elements}</div>;
}

