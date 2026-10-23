import { Fragment, type ReactNode } from "react";

/** **bold** inside a line; everything else stays plain text (React escapes it). */
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
    part.startsWith("**") && part.endsWith("**") && part.length > 4 ? (
      <strong key={index} className="font-semibold">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <Fragment key={index}>{part}</Fragment>
    )
  );
}

/** The assistant's replies: paragraphs, "-" lists and bold, nothing more. */
export function RichText({ text, className = "" }: { text: string; className?: string }) {
  const blocks = text.trim().split(/\n\s*\n/);
  return (
    <div className={`space-y-2.5 text-[15px] leading-relaxed ${className}`}>
      {blocks.map((block, index) => {
        const lines = block.split("\n");
        if (lines.every((line) => /^\s*[-•*]\s+/.test(line))) {
          return (
            <ul key={index} className="list-disc space-y-1 pl-5">
              {lines.map((line, i) => (
                <li key={i}>{inline(line.replace(/^\s*[-•*]\s+/, ""))}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={index}>
            {lines.map((line, i) => (
              <Fragment key={i}>
                {i > 0 && <br />}
                {inline(line)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
