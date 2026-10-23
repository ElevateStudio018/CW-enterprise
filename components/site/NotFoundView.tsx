import { Btn, Eyebrow } from "../vk/parts";
import type { SiteData } from "@/lib/site/schema.ts";

/** The page shown for an address that does not exist. Also used by the admin preview. */
export function NotFoundView({ site }: { site: SiteData }) {
  const texts = site.notFound;
  return (
    <section className="sec">
      <div className="wrap narrow">
        <Eyebrow text={texts.eyebrow} />
        <h1>{texts.heading}</h1>
        {texts.text && <p className="lead">{texts.text}</p>}
        <div className="btns">
          <Btn link={texts.button} kind="blue" arrow />
        </div>
      </div>
    </section>
  );
}
