import { Icon } from "../Icon";
import { SiteLink } from "../SiteLink";
import { SecHead } from "../vk/parts";
import { list } from "@/lib/site/collection.ts";
import { focusStyle, imageProps } from "@/lib/site/images.ts";
import type { SiteData } from "@/lib/site/schema.ts";
import type { SectionProps } from "./types";

type Project = SiteData["uppdrag"]["items"][string] & { id: string };

export function ProjectCard({ project, more }: { project: Project; more: string }) {
  return (
    <li className="card">
      <SiteLink href={project.href}>
        <span className="card-ph">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img {...imageProps(project.image, "(min-width: 960px) 33vw, 100vw")} alt={project.image.alt} style={focusStyle(project.image)} loading="lazy" />
          {project.tag && <span className="card-tag">{project.tag}</span>}
        </span>
        <span className="card-body">
          <b>{project.title}</b>
          {project.text && <span>{project.text}</span>}
          {more && (
            <span className="card-more">
              {more} <Icon name="ArrowRight" className="ic" />
            </span>
          )}
        </span>
      </SiteLink>
    </li>
  );
}

/** The projects as cards with a photo, a tag, a title and a line of text. */
export function UppdragGridSection({ section, ctx }: SectionProps<"uppdragGrid">) {
  const projects = list(ctx.site.uppdrag);
  return (
    <section id={section.anchor || undefined} className="sec">
      <div className="wrap">
        <SecHead eyebrow={section.eyebrow} heading={section.heading} right={section.text ? <p>{section.text}</p> : undefined} />
        <ul className={`cards${projects.length === 2 ? " c2" : ""}`}>
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} more={section.filterAllLabel} />
          ))}
        </ul>
      </div>
    </section>
  );
}
