"use client";

import { useEffect, useState } from "react";
import { TextField } from "../ui/Field";

/**
 * A number typed as text: half-typed values ("57,", "") stay on screen and only whole numbers are saved. Decimals
 * accept a comma, as Swedes write them.
 */
export function NumberField({
  label,
  value,
  onChange,
  decimals = false,
  min,
  max,
  hint,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  decimals?: boolean;
  min?: number;
  max?: number;
  hint?: string;
}) {
  const format = (number: number) => (decimals ? String(number).replace(".", ",") : String(number));
  const [text, setText] = useState(() => format(value));
  const [focused, setFocused] = useState(false);

  // Changes from elsewhere (undo, another device) show up unless the field is being typed in.
  useEffect(() => {
    if (!focused) setText(format(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, focused]);

  const parsed = decimals ? Number(text.replace(",", ".").trim()) : Number.parseInt(text.trim(), 10);
  const valid = text.trim() !== "" && Number.isFinite(parsed) && (decimals || /^-?\d+$/.test(text.trim()));
  const outside = valid && ((min !== undefined && parsed < min) || (max !== undefined && parsed > max));
  const error = text.trim() === "" ? undefined : !valid ? "Skriv ett tal." : outside ? `Mellan ${min} och ${max}.` : undefined;

  return (
    <TextField
      label={label}
      value={text}
      inputMode={decimals ? "decimal" : "numeric"}
      hint={hint}
      error={error}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        setText(format(value));
      }}
      onChange={(next) => {
        setText(next);
        const number = decimals ? Number(next.replace(",", ".").trim()) : Number.parseInt(next.trim(), 10);
        const ok = next.trim() !== "" && Number.isFinite(number) && (decimals || /^-?\d+$/.test(next.trim()));
        if (ok && (min === undefined || number >= min) && (max === undefined || number <= max)) onChange(number);
      }}
    />
  );
}
