import React, { useState } from "react";

/**
 * 轻量 Markdown 渲染器。
 * 直接产出 React 元素（不使用 dangerouslySetInnerHTML），因此天然免疫 XSS。
 */

const LIST_RE = /^(\s*)([-*+]|\d{1,9}[.)])\s+(.*)$/;
const FENCE_RE = /^\s*(`{3,}|~{3,})\s*([\w+#.-]*)\s*$/;
const HEADING_RE = /^(#{1,6})\s+(.*)$/;
const HR_RE = /^\s*([-*_])(\s*\1){2,}\s*$/;
const QUOTE_RE = /^\s*>/;
const TABLE_DELIM_RE = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;

const INLINE_RE =
  /(`[^`\n]+`|\*\*(?:[^*\n]|\*(?!\*))+\*\*|__[^_\n]+__|~~[^~\n]+~~|\*[^*\n]+\*|_[^_\n]+_|\[[^\]\n]*\]\([^()\s]+\)|https?:\/\/[^\s<>()[\]]+)/g;

const safeHref = (raw) => {
  const value = String(raw).trim();
  return /^(https?:\/\/|mailto:)/i.test(value) ? value : null;
};

function renderInline(text, keyPrefix) {
  const nodes = [];
  const parts = String(text).split(INLINE_RE);
  parts.forEach((part, index) => {
    if (!part) return;
    const key = `${keyPrefix}-${index}`;
    const wraps = (mark) =>
      part.startsWith(mark) &&
      part.endsWith(mark) &&
      part.length > mark.length * 2;

    if (wraps("`"))
      return nodes.push(
        <code className="md-inline-code" key={key}>
          {part.slice(1, -1)}
        </code>,
      );
    if (wraps("**") || wraps("__"))
      return nodes.push(
        <strong key={key}>{renderInline(part.slice(2, -2), key)}</strong>,
      );
    if (wraps("~~"))
      return nodes.push(<s key={key}>{renderInline(part.slice(2, -2), key)}</s>);
    if (wraps("*") || wraps("_"))
      return nodes.push(
        <em key={key}>{renderInline(part.slice(1, -1), key)}</em>,
      );

    const link = /^\[([^\]]*)\]\(([^()\s]+)\)$/.exec(part);
    if (link) {
      const href = safeHref(link[2]);
      return nodes.push(
        href ? (
          <a key={key} href={href} target="_blank" rel="noreferrer noopener">
            {renderInline(link[1], key)}
          </a>
        ) : (
          <span key={key}>{link[1]}</span>
        ),
      );
    }
    if (/^https?:\/\//.test(part)) {
      return nodes.push(
        <a key={key} href={part} target="_blank" rel="noreferrer noopener">
          {part}
        </a>,
      );
    }
    nodes.push(part);
  });
  return nodes;
}

function CodeBlock({ lang, code }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* 剪贴板不可用时静默忽略 */
    }
  };
  return (
    <figure className="md-code-block">
      <figcaption>
        <span>{lang || "code"}</span>
        <button type="button" onClick={copy}>
          {copied ? "已复制" : "复制"}
        </button>
      </figcaption>
      <pre>
        <code>{code}</code>
      </pre>
    </figure>
  );
}

const stripIndent = (line, count) => {
  let index = 0;
  while (index < count && line[index] === " ") index += 1;
  return line.slice(index);
};

const startsBlock = (line) =>
  FENCE_RE.test(line) ||
  HEADING_RE.test(line) ||
  HR_RE.test(line) ||
  QUOTE_RE.test(line) ||
  LIST_RE.test(line);

function renderListItems(block, keyPrefix) {
  const items = [];
  for (const line of block) {
    const match = LIST_RE.exec(line);
    if (match && (!items.length || match[1].length <= items[0].indent)) {
      items.push({
        body: [match[3]],
        indent: match[1].length,
        offset: match[1].length + match[2].length + 1,
      });
    } else if (items.length) {
      const current = items[items.length - 1];
      current.body.push(stripIndent(line, current.offset));
    }
  }
  return items.map((item, index) => {
    const body = item.body.join("\n").trim();
    return (
      <li key={`${keyPrefix}-li${index}`}>
        {body.includes("\n")
          ? parseBlocks(body)
          : renderInline(body, `${keyPrefix}-li${index}`)}
      </li>
    );
  });
}

function parseBlocks(source) {
  const lines = String(source).replace(/\r\n?/g, "\n").split("\n");
  const out = [];
  let index = 0;
  let counter = 0;
  const nextKey = () => `b${counter++}`;

  while (index < lines.length) {
    const line = lines[index];
    const guard = index;

    const fence = FENCE_RE.exec(line);
    if (fence) {
      const closing = new RegExp(`^\\s*${fence[1][0] === "`" ? "`" : "~"}{3,}\\s*$`);
      const body = [];
      index += 1;
      while (index < lines.length && !closing.test(lines[index]))
        body.push(lines[index++]);
      index += 1;
      out.push(<CodeBlock key={nextKey()} lang={fence[2]} code={body.join("\n")} />);
      continue;
    }

    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (HR_RE.test(line)) {
      out.push(<hr key={nextKey()} />);
      index += 1;
      continue;
    }

    const heading = HEADING_RE.exec(line);
    if (heading) {
      // 整体降一级：聊天气泡里 h1 太大，从 h2 起排版更协调
      const Tag = `h${Math.min(heading[1].length + 1, 6)}`;
      const key = nextKey();
      out.push(<Tag key={key}>{renderInline(heading[2], key)}</Tag>);
      index += 1;
      continue;
    }

    if (QUOTE_RE.test(line)) {
      const body = [];
      while (index < lines.length && QUOTE_RE.test(lines[index]))
        body.push(lines[index++].replace(/^\s*>\s?/, ""));
      out.push(<blockquote key={nextKey()}>{parseBlocks(body.join("\n"))}</blockquote>);
      continue;
    }

    if (
      line.includes("|") &&
      index + 1 < lines.length &&
      TABLE_DELIM_RE.test(lines[index + 1])
    ) {
      const splitRow = (value) =>
        value
          .trim()
          .replace(/^\|/, "")
          .replace(/\|$/, "")
          .split("|")
          .map((cell) => cell.trim());
      const head = splitRow(line);
      index += 2;
      const rows = [];
      while (index < lines.length && lines[index].trim() && lines[index].includes("|"))
        rows.push(splitRow(lines[index++]));
      const key = nextKey();
      out.push(
        <div className="md-table-wrap" key={key}>
          <table>
            <thead>
              <tr>
                {head.map((cell, i) => (
                  <th key={i}>{renderInline(cell, `${key}-h${i}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, r) => (
                <tr key={r}>
                  {head.map((_, c) => (
                    <td key={c}>{renderInline(row[c] || "", `${key}-${r}-${c}`)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    const listStart = LIST_RE.exec(line);
    if (listStart) {
      const base = listStart[1].length;
      const ordered = /\d/.test(listStart[2]);
      const block = [];
      while (index < lines.length) {
        const current = lines[index];
        const match = LIST_RE.exec(current);
        if (match) {
          if (match[1].length < base) break;
          if (match[1].length === base && /\d/.test(match[2]) !== ordered) break;
          block.push(current);
          index += 1;
          continue;
        }
        if (!current.trim()) {
          const next = lines[index + 1];
          if (next && (LIST_RE.test(next) || /^\s{2,}\S/.test(next))) {
            block.push("");
            index += 1;
            continue;
          }
          break;
        }
        if (/^\s{2,}\S/.test(current)) {
          block.push(current);
          index += 1;
          continue;
        }
        break;
      }
      const Tag = ordered ? "ol" : "ul";
      const key = nextKey();
      out.push(<Tag key={key}>{renderListItems(block, key)}</Tag>);
      continue;
    }

    const paragraph = [];
    while (index < lines.length && lines[index].trim() && !startsBlock(lines[index]))
      paragraph.push(lines[index++]);
    if (index === guard) paragraph.push(lines[index++]);
    const key = nextKey();
    out.push(
      <p key={key}>
        {paragraph.map((value, i) => (
          <React.Fragment key={i}>
            {i > 0 && <br />}
            {renderInline(value, `${key}-${i}`)}
          </React.Fragment>
        ))}
      </p>,
    );
  }
  return out;
}

export function Markdown({ text }) {
  return <div className="md">{parseBlocks(text || "")}</div>;
}
