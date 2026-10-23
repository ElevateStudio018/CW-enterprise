"use client";

import { useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";

// 16px on phones: smaller text makes the iPhone zoom in on every field.
const control =
  "w-full rounded-xl border-0 bg-white px-3.5 py-2.5 text-[16px] text-admin-ink ring-1 ring-inset ring-admin-line placeholder:text-stone-400 transition hover:ring-stone-300 focus:outline-none focus:ring-2 focus:ring-admin disabled:bg-stone-50 disabled:text-admin-muted sm:text-[15px]";

interface FieldShellProps {
  label: string;
  hint?: ReactNode;
  error?: string;
  /** Characters that fit well; a counter shows how many are used. */
  recommended?: number;
  length?: number;
  children: (props: { id: string; describedBy?: string }) => ReactNode;
  className?: string;
}

export function FieldShell({ label, hint, error, recommended, length = 0, children, className = "" }: FieldShellProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const over = recommended !== undefined && length > recommended;
  return (
    <div className={`group/field ${className}`}>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-[14px] font-medium text-admin-ink">
          {label}
        </label>
        {recommended !== undefined && (
          // Only while typing in the field, or when the text has grown too long.
          <span
            className={`text-[12px] tabular-nums ${over ? "font-semibold text-amber-700" : "invisible text-admin-subtle group-focus-within/field:visible"}`}
          >
            {length}/{recommended}
          </span>
        )}
      </div>
      {children({ id, describedBy: hint || error || over ? hintId : undefined })}
      {(error || hint || over) && (
        <p id={hintId} className={`mt-1.5 text-[13px] leading-snug ${error ? "text-red-700" : over ? "text-amber-800" : "text-admin-muted"}`}>
          {error ?? (over ? "Lite långt – kortare text brukar se bättre ut här." : hint)}
        </p>
      )}
    </div>
  );
}

export function TextField({
  label,
  hint,
  error,
  recommended,
  value,
  onChange,
  className,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> & {
  label: string;
  hint?: ReactNode;
  error?: string;
  recommended?: number;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <FieldShell label={label} hint={hint} error={error} recommended={recommended} length={value.length} className={className}>
      {({ id, describedBy }) => (
        <input
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-describedby={describedBy}
          aria-invalid={Boolean(error) || undefined}
          className={control}
          {...rest}
        />
      )}
    </FieldShell>
  );
}

export function TextArea({
  label,
  hint,
  error,
  recommended,
  value,
  onChange,
  className,
  rows = 4,
  ...rest
}: Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange" | "value"> & {
  label: string;
  hint?: ReactNode;
  error?: string;
  recommended?: number;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <FieldShell label={label} hint={hint} error={error} recommended={recommended} length={value.length} className={className}>
      {({ id, describedBy }) => (
        <textarea
          id={id}
          value={value}
          rows={rows}
          onChange={(event) => onChange(event.target.value)}
          aria-describedby={describedBy}
          aria-invalid={Boolean(error) || undefined}
          className={`${control} min-h-[96px] resize-y leading-relaxed`}
          {...rest}
        />
      )}
    </FieldShell>
  );
}

export const controlClasses = control;
