import { withBasePath } from "@/lib/site/images.ts";

// Elevate Studio's mark (public/elevate-mark.png, from elevatestudio.nu) used as a mask, so it is drawn in the footer's
// text colour on any footer.
const MARK = "/elevate-mark.png";

/** The web agency's credit under the footer: its mark and name, the whole of it one link to its site. */
export function ElevateCredit() {
  const mask = `url(${withBasePath(MARK)}) center / contain no-repeat`;
  return (
    <p className="mt-6 flex justify-center">
      <a
        href="https://elevatestudio.nu"
        target="_blank"
        rel="noopener"
        className="inline-flex items-center gap-2 py-2 text-[13px] text-footer-text/55 transition-colors duration-200 hover:text-footer-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-footer-text lg:text-[14px]"
      >
        <span aria-hidden="true" className="block h-4 w-4 shrink-0 bg-current" style={{ mask, WebkitMask: mask }} />
        Byggd av Elevate Studio
      </a>
    </p>
  );
}
