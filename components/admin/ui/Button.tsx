import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const variants: Record<Variant, string> = {
  primary: "bg-admin text-admin-contrast hover:brightness-110 active:brightness-95",
  secondary: "bg-white text-admin-ink ring-1 ring-inset ring-admin-line hover:bg-stone-50 hover:ring-stone-300",
  ghost: "text-admin-ink hover:bg-stone-900/[0.05]",
  danger: "bg-red-700 text-white hover:bg-red-800",
};

const sizes = { md: "min-h-11 px-4 text-[14px] sm:min-h-10", sm: "min-h-10 px-3 text-[13px] sm:min-h-9" } as const;

/** The button look, for links that should look like buttons. */
export function buttonClasses(variant: Variant = "secondary", size: "md" | "sm" = "md", extra = ""): string {
  return `inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-admin disabled:cursor-not-allowed disabled:opacity-55 ${sizes[size]} ${variants[variant]} ${extra}`;
}

export interface AdminButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: "md" | "sm";
  icon?: LucideIcon;
  /** Shown instead of the label while something is in progress; the button is disabled meanwhile. */
  busyLabel?: string;
  busy?: boolean;
  children?: ReactNode;
}

export const AdminButton = forwardRef<HTMLButtonElement, AdminButtonProps>(function AdminButton(
  { variant = "secondary", size = "md", icon: Icon, busy = false, busyLabel, children, className = "", disabled, type = "button", ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={buttonClasses(variant, size, `${busy ? "admin-busy" : ""} ${className}`)}
      {...rest}
    >
      {Icon && <Icon aria-hidden="true" className="h-4 w-4 shrink-0" strokeWidth={2} />}
      {busy && busyLabel ? busyLabel : children}
    </button>
  );
});
