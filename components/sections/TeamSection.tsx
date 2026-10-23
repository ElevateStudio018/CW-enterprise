import { Photo } from "../Photo";
import { Reveal } from "../Reveal";
import { tapTarget } from "../Button";
import { Icon } from "../Icon";
import { SectionIntro } from "./SectionIntro";
import { list } from "@/lib/site/collection.ts";
import { focusStyle, imageProps } from "@/lib/site/images.ts";
import { toTelHref } from "@/lib/site/format.ts";
import type { SectionProps } from "./types";

/** The people in the company: photo, name, role and how to reach each of them. */
export function TeamSection({ section }: SectionProps<"team">) {
  return (
    <section id={section.anchor || undefined} className="scroll-mt-20">
      <div className="mx-auto max-w-content px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-28">
        <SectionIntro heading={section.heading} text={section.text} />
        <ul className="mt-10 grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-4">
          {list(section.members).map((member, index) => (
            <Reveal key={member.id} as="li" delayMs={(index % 4) * 70} className="flex flex-col bg-card">
              {member.image && (
                <div className="relative aspect-[4/5] overflow-hidden bg-primary/20">
                  <Photo
                    {...imageProps(member.image, "(min-width: 1024px) 25vw, 50vw")}
                    alt={member.image.alt}
                    className="absolute inset-0 h-full w-full object-cover"
                    style={focusStyle(member.image)}
                  />
                </div>
              )}
              <div className="flex flex-1 flex-col px-4 py-4 sm:px-6 sm:py-6">
                <h3 className="text-[17px] font-semibold leading-snug text-heading sm:text-h3">{member.name}</h3>
                {member.role && <p className="mt-1 text-[15px] text-muted sm:text-[16px]">{member.role}</p>}
                {(member.phone || member.email) && (
                  <ul className="mt-auto space-y-2 pt-4 text-[15px] text-heading sm:text-[16px]">
                    {member.phone && (
                      <li>
                        <a href={toTelHref(member.phone)} className={`${tapTarget} inline-flex items-center gap-2 transition-colors hover:text-accent`}>
                          <Icon name="Phone" strokeWidth={2.25} className="h-4 w-4 shrink-0 text-accent" />
                          {member.phone}
                        </a>
                      </li>
                    )}
                    {member.email && (
                      <li>
                        <a href={`mailto:${member.email}`} className={`${tapTarget} inline-flex items-center gap-2 transition-colors hover:text-accent`}>
                          <Icon name="Mail" strokeWidth={2.25} className="h-4 w-4 shrink-0 text-accent" />
                          <span className="break-all">{member.email}</span>
                        </a>
                      </li>
                    )}
                  </ul>
                )}
              </div>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
