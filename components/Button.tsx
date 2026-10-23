import { Icon } from "./Icon";

/**
 * "solid": the filled button. "outline": its outlined twin on light backgrounds. The "on-…" variants are the outlined
 * button on a dark surface — the menu, the footer or a band in the primary colour — in that surface's text colour.
 */
export type ButtonVariant = "solid" | "outline" | "on-nav" | "on-footer" | "on-primary";

// Pressing a button squeezes it in a touch.
const pillBase =
  "inline-flex items-center justify-center gap-2 rounded-full px-8 py-4 text-center font-button text-[16px] font-semibold transition duration-200 active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";

const pillVariants: Record<ButtonVariant, string> = {
  solid: "bg-button text-button-text hover:bg-button-hover focus-visible:outline-button",
  outline: "border-[1.5px] border-button text-button hover:bg-button hover:text-button-text focus-visible:outline-button",
  "on-nav": "border-[1.5px] border-nav-text text-nav-text hover:bg-nav-text hover:text-nav focus-visible:outline-nav-text",
  "on-footer": "border-[1.5px] border-footer-text text-footer-text hover:bg-footer-text hover:text-footer focus-visible:outline-footer-text",
  "on-primary": "border-[1.5px] border-on-primary text-on-primary hover:bg-on-primary hover:text-primary focus-visible:outline-on-primary",
};

export function buttonClasses(variant: ButtonVariant = "solid", className = ""): string {
  return `${pillBase} ${pillVariants[variant]} ${className}`;
}

/** An invisible margin around a small link, making it a full-size tap target without moving anything. */
export const tapTarget = "relative before:absolute before:-inset-x-2 before:-inset-y-3";

/** Uppercase, letter-spaced text link with a chevron — the site's secondary call to action. */
export function arrowLinkClasses(className = ""): string {
  return `${tapTarget} group/arrow inline-block text-left text-label uppercase transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-current text-link hover:text-accent ${className}`;
}

/**
 * Label + chevron for arrow links. The last word and the chevron share a no-wrap span,
 * so a label that breaks over several lines still ends with "word >" instead of the
 * chevron drifting off on its own.
 */
export function ArrowLabel({ children, spaced = false }: { children: string; spaced?: boolean }) {
  const splitAt = children.lastIndexOf(" ") + 1;
  return (
    <>
      {children.slice(0, splitAt)}
      <span className="whitespace-nowrap">
        {children.slice(splitAt)}
        <Icon
          name="ChevronRight"
          strokeWidth={1.5}
          aria-hidden="true"
          className={`inline-block h-6 w-6 align-[-0.36em] transition-transform duration-200 group-hover/arrow:translate-x-1 ${
            spaced ? "ml-1.5" : ""
          }`}
        />
      </span>
    </>
  );
}
