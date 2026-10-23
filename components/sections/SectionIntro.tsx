import { Reveal } from "../Reveal";

/** The heading and optional introduction most sections open with. */
export function SectionIntro({ heading, text, tone = "light" }: { heading: string; text?: string; tone?: "light" | "primary" }) {
  if (!heading && !text) return null;
  return (
    <Reveal className="max-w-3xl">
      {heading && <h2 className={`text-h2 lg:text-h2-lg ${tone === "primary" ? "" : "text-heading"}`}>{heading}</h2>}
      {text && <p className={`mt-5 text-copy lg:text-lead ${tone === "primary" ? "" : "text-body"}`}>{text}</p>}
    </Reveal>
  );
}
