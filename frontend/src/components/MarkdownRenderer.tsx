import React from "react";

interface MarkdownRendererProps {
  content: string;
}

export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
  if (!content) return null;

  // Split content by lines to process structurally
  const lines = content.split("\n");
  const parsedElements: React.ReactNode[] = [];
  let tableRows: string[][] = [];
  let isTable = false;
  let keyIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Check if we are inside a table structure
    if (line.startsWith("|") && line.endsWith("|")) {
      // Split cells and clean up empty elements
      const cells = line
        .split("|")
        .map((cell) => cell.trim())
        .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);

      // Check for separator line e.g., | :--- | :--- |
      if (line.includes("---") || line.includes("-:-")) {
        continue;
      }

      isTable = true;
      tableRows.push(cells);
      continue;
    } else {
      // If we were inside a table list but just left it
      if (isTable && tableRows.length > 0) {
        const hasHeader = tableRows.length > 1;
        const headers = hasHeader ? tableRows[0] : [];
        const bodyRows = hasHeader ? tableRows.slice(1) : tableRows;

        parsedElements.push(
          <div key={`table-${keyIndex++}`} className="my-5 overflow-x-auto rounded-none border border-editorial-text/15 bg-editorial-paper shadow-none">
            <table className="w-full text-left border-collapse text-xs md:text-sm">
              {headers.length > 0 && (
                <thead>
                  <tr className="bg-editorial-accent/30 border-b border-editorial-text/15">
                    {headers.map((header, idx) => (
                      <th key={`th-${idx}`} className="px-4 py-3 font-bold text-editorial-text uppercase tracking-wider font-mono">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
              )}
              <tbody>
                {bodyRows.map((row, rowIdx) => (
                  <tr key={`tr-${rowIdx}`} className="border-b border-editorial-text/10 last:border-b-0 hover:bg-editorial-accent/10 transition-colors">
                    {row.map((cell, cellIdx) => (
                      <td key={`td-${cellIdx}`} className="px-4 py-3 text-editorial-text/80 font-sans leading-relaxed">
                        {renderInlineBoldItalic(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        tableRows = [];
        isTable = false;
      }
    }

    if (line === "") {
      parsedElements.push(<div key={`space-${keyIndex++}`} className="h-2" />);
      continue;
    }

    // Bold Headings (H1/H2/H3)
    if (line.startsWith("###")) {
      parsedElements.push(
        <h4 key={`h3-${keyIndex++}`} className="text-xs uppercase tracking-wider font-mono font-bold text-editorial-text mt-4 mb-1.5">
          {renderInlineBoldItalic(line.substring(3).trim())}
        </h4>
      );
    } else if (line.startsWith("##")) {
      parsedElements.push(
        <h3 key={`h2-${keyIndex++}`} className="text-sm serif font-bold text-editorial-text mt-5 mb-2.5 border-b border-editorial-text/15 pb-1">
          {renderInlineBoldItalic(line.substring(2).trim())}
        </h3>
      );
    } else if (line.startsWith("#")) {
      parsedElements.push(
        <h2 key={`h1-${keyIndex++}`} className="text-base serif font-bold text-editorial-text mt-6 mb-3">
          {renderInlineBoldItalic(line.substring(1).trim())}
        </h2>
      );
    }
    // Bullet Listings
    else if (line.startsWith("*") || line.startsWith("-")) {
      parsedElements.push(
        <div key={`bullet-${keyIndex++}`} className="flex items-start gap-2.5 my-1.5 pl-1.5">
          <span className="w-1.5 h-1.5 rounded-none bg-editorial-text mt-2 shrink-0 opacity-70" />
          <p className="text-xs md:text-sm text-editorial-text/80 leading-relaxed font-sans">
            {renderInlineBoldItalic(line.substring(1).trim())}
          </p>
        </div>
      );
    }
    // Numbered lists
    else if (/^\d+\./.test(line)) {
      const match = line.match(/^(\d+)\.(.*)/);
      const num = match ? match[1] : "•";
      const rest = match ? match[2].trim() : line;
      parsedElements.push(
        <div key={`num-${keyIndex++}`} className="flex items-start gap-3 my-2 pl-1">
          <span className="flex items-center justify-center w-5 h-5 rounded-none bg-editorial-text text-editorial-bg font-bold font-mono text-[10px] shrink-0 mt-0.5">
            {num}
          </span>
          <p className="text-xs md:text-sm text-editorial-text/80 leading-relaxed font-sans">
            {renderInlineBoldItalic(rest)}
          </p>
        </div>
      );
    }
    // Divider
    else if (line === "---" || line === "***") {
      parsedElements.push(<hr key={`hr-${keyIndex++}`} className="my-5 border-editorial-text/15" />);
    }
    // Standard paragraphs
    else {
      parsedElements.push(
        <p key={`p-${keyIndex++}`} className="text-xs md:text-sm text-editorial-text/85 leading-relaxed font-sans my-2.5">
          {renderInlineBoldItalic(line)}
        </p>
      );
    }
  }

  // Final loose table handle
  if (isTable && tableRows.length > 0) {
    const hasHeader = tableRows.length > 1;
    const headers = hasHeader ? tableRows[0] : [];
    const bodyRows = hasHeader ? tableRows.slice(1) : tableRows;

    parsedElements.push(
      <div key={`table-final`} className="my-5 overflow-x-auto rounded-none border border-editorial-text/15 bg-editorial-paper shadow-none">
        <table className="w-full text-left border-collapse text-xs md:text-sm">
          {headers.length > 0 && (
            <thead>
              <tr className="bg-editorial-accent/30 border-b border-editorial-text/15">
                {headers.map((header, idx) => (
                  <th key={`th-${idx}`} className="px-4 py-3 font-bold text-editorial-text uppercase tracking-wider font-mono">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {bodyRows.map((row, rowIdx) => (
              <tr key={`tr-${rowIdx}`} className="border-b border-editorial-text/10 last:border-b-0 hover:bg-editorial-accent/10 transition-colors">
                {row.map((cell, cellIdx) => (
                  <td key={`td-${cellIdx}`} className="px-4 py-3 text-editorial-text/80 font-sans leading-relaxed">
                    {renderInlineBoldItalic(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return <div className="space-y-1">{parsedElements}</div>;
}

// Simple and highly effective regex parser for **bolding** and *italics*
function renderInlineBoldItalic(text: string): React.ReactNode[] {
  if (!text) return [];

  // Split on bold delimiters
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={index} className="font-bold text-editorial-text font-sans">
          {part.slice(2, -2)}
        </strong>
      );
    } else if (part.startsWith("*") && part.endsWith("*")) {
      return (
        <em key={index} className="italic text-editorial-text/90 font-sans">
          {part.slice(1, -1)}
        </em>
      );
    }
    return <span key={index}>{part}</span>;
  });
}
