import { Icon } from "../Icon";
import { SecHead } from "../vk/parts";
import { list } from "@/lib/site/collection.ts";
import { toTelHref } from "@/lib/site/format.ts";
import { withBasePath } from "@/lib/site/images.ts";
import type { SectionProps } from "./types";

/** Every certificate and insurance as a card with its badge. */
export function CertificatesSection({ section, ctx }: SectionProps<"certificates">) {
  const certificates = list(ctx.site.certificates);
  const { phone } = ctx.site.company;
  return (
    <section id={section.anchor || undefined} className="sec">
      <div className="wrap">
        <SecHead eyebrow={section.eyebrow} heading={section.heading} right={section.text ? <p>{section.text}</p> : undefined} />
        {certificates.length === 0 ? (
          <div className="cert">
            <h3>{section.emptyHeading}</h3>
            <p>
              {`${section.emptyText} `}
              {phone && <a href={toTelHref(phone)}>{phone}</a>}
            </p>
          </div>
        ) : (
          <ul className="certs">
            {certificates.map((cert) => (
              <li key={cert.id} id={cert.id} className="cert">
                <div className={`cert-logos${cert.image ? "" : " cert-text"}`}>
                  {cert.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={withBasePath(cert.image.src)} alt={cert.image.alt} loading="lazy" />
                  ) : (
                    <>
                      <Icon name="HardHat" className="ic" />
                      <b>{cert.name}</b>
                    </>
                  )}
                </div>
                <h3>{cert.name}</h3>
                {cert.issuer && section.issuerPrefix && <p className="small">{`${section.issuerPrefix} ${cert.issuer}`}</p>}
                <p>{cert.description}</p>
                {cert.validUntil && section.validUntilPrefix && <p className="small">{`${section.validUntilPrefix} ${cert.validUntil}`}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
