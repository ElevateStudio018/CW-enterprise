"use client";

import { useEffect, useRef, useState } from "react";
import { TextArea } from "../ui/Field";

const split = (text: string) =>
  text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

/** Several paragraphs in one box, separated by an empty line. What is typed stays as typed while the list is saved. */
export function ParagraphsField({ label, value, onChange, hint }: { label: string; value: string[]; onChange: (paragraphs: string[]) => void; hint?: string }) {
  const [text, setText] = useState(() => value.join("\n\n"));
  const lastSent = useRef(value);

  // Changes from elsewhere (undo, another device) replace the text; one's own typing does not come back round.
  useEffect(() => {
    if (value !== lastSent.current && value.join("\n\n") !== split(text).join("\n\n")) setText(value.join("\n\n"));
    lastSent.current = value;
  }, [value, text]);

  return (
    <TextArea
      label={label}
      hint={hint ?? "Tom rad mellan stycken."}
      rows={Math.min(14, Math.max(5, text.split("\n").length + 1))}
      value={text}
      onChange={(next) => {
        setText(next);
        const paragraphs = split(next);
        lastSent.current = paragraphs;
        onChange(paragraphs);
      }}
    />
  );
}
