"""Bygger content/baseline.json – CW Enterprise AB:s ursprungliga innehåll – och den första publicerade versionen i
databasen (supabase/migrations/20261002120400_baseline.sql).

Kör:  python3 tools/make_baseline.py   (efter npm run photos om bilderna ändrats)

Texterna bygger på den tidigare hemsidan cwenterprise.se. Där den sidan inte säger något (förvaltningens innehåll,
tjänsternas längre texter) är texterna förslag att gå igenom; de är märkta FÖRSLAG nedan. Uppgifterna om byggtjänsterna
och certifikaten kommer från vastkustbygg.se. När sajten är kopplad till Supabase ändras innehållet i adminpanelen.
"""
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
SIZES = json.loads((ROOT / "lib/photo-sizes.json").read_text())

NAME = "CW Enterprise AB"
PHONE = "+46 709 188 160"
EMAIL = "info@cwenterprise.se"
SITE_URL = "https://elevatestudio018.github.io/CW-enterprise"
CONTACT = {"label": "Kontakta oss", "href": "#offert"}
NO_LINK = {"label": "", "href": "/"}

KONSULT, FORV, BYGG = "#34506E", "#E2601A", "#1F86EC"


def img(name, alt, focus=None):
    widths = SIZES[name]
    variants = [{"width": w, "src": f"/photos/{name}-{w}.webp"} for w in widths[:-1]]
    variants.append({"width": widths[-1], "src": f"/photos/{name}.webp"})
    out = {"src": f"/photos/{name}.webp", "variants": variants, "alt": alt}
    if focus:
        out["focus"] = focus
    return out


def png(name, alt):
    return {"src": f"/photos/{name}.png", "variants": [], "alt": alt}


def coll(items, prefix="i"):
    order, out = [], {}
    for n, item in enumerate(items, 1):
        item = dict(item)
        key = item.pop("_id", f"{prefix}{n}")
        order.append(key)
        out[key] = item
    return {"order": order, "items": out}


def sec(type_, anchor="", eyebrow="", **fields):
    return {"type": type_, "hidden": False, "anchor": anchor, "label": "", "eyebrow": eyebrow, **fields}


def link(label, href):
    return {"label": label, "href": href}


FJALL = img("fjall", "En vandrare med ryggsäck på en stig över kalfjället", "50% 62%")
STIG = img("fjall-stig", "Vandrare på en stig över fjället", "50% 55%")
VIDD = img("fjall-vidd", "Fjällvidd med blånande berg i fjärran", "50% 50%")

UI = {
    "skipLink": "Hoppa till innehållet", "openMenu": "Öppna meny", "closeMenu": "Stäng meny", "menuLabel": "Meny",
    "mainMenuLabel": "Huvudmeny", "quickLinksLabel": "Snabblänkar", "callPrefix": "Ring", "homeLinkLabel": f"{NAME} – startsida",
    "breadcrumbsLabel": "Brödsmulor", "breadcrumbHome": "Start", "carouselPrevious": "Föregående", "carouselNext": "Nästa",
    "carouselGoTo": "Gå till position {n} av {total}", "uppdragFilterLabel": "Filtrera uppdrag", "stepPrefix": "Steg",
    "mapTitlePrefix": "Karta:", "closeLabel": "Stäng", "ratingLabel": "{n} av 5 stjärnor",
    "cookieText": "Vi vill använda kakor för att se hur besökare använder sidan, så att vi kan göra den bättre. Godkänner du det?",
    "cookieAccept": "Godkänn", "cookieDecline": "Nej tack", "cookieSettings": "Kakinställningar",
}

# ---------------------------------------------------------------------------------------------------------------------
# Tjänster (egna sidor under /tjanster/…)

services = [
    {
        "_id": "management-consulting",
        "slug": "management-consulting",
        "name": "Management Consulting",
        "shortDescription": "Projektledning, affärsutveckling och affärsprocessanalys, IS/IT.",
        "lead": "Projektledning, affärsutveckling och affärsprocessanalys, IS/IT.",
        # FÖRSLAG: korta förklaringar; uppdragen är från den tidigare hemsidan.
        "description": [
            "Vi leder projekt där verksamhet och affärssystem förändras, från Proof of Concept och analys till utveckling och idrifttagande.",
            "De senaste uppdragen har gällt alla europeiska affärsenheter inom Logisnext Mitsubishi Forklift Trucks Europe: en Proof of Concept för nytt ERP-system, utveckling och idrifttagande av ett CRM/CPQ-system och analysfasen inför implementation av Microsoft Business Central.",
        ],
        "includes": ["Projektledning", "Affärsutveckling", "Affärsprocessanalys", "IS/IT: ERP, CRM och CPQ", "Proof of Concept och analysfas", "Utveckling och idrifttagande"],
        "galleryHeading": "", "galleryLink": NO_LINK, "gallery": coll([]),
        "icon": "Route",
        "image": STIG,
        "seo": {"title": "Management Consulting – projektledning och IS/IT",
                "description": "Projektledning, affärsutveckling och affärsprocessanalys, IS/IT. Erfarenhet av ERP- och CRM/CPQ-projekt för alla europeiska affärsenheter."},
    },
    {
        "_id": "forvaltning",
        "slug": "forvaltning",
        "name": "Förvaltning",
        "shortDescription": "Finansiell och teknisk förvaltning av bostadsfastigheter och kommersiella fastigheter.",
        "lead": "Finansiell och teknisk förvaltning av bostadsfastigheter och kommersiella fastigheter, under namnet CWE Fastighetsförvaltning.",
        # FÖRSLAG: vad förvaltningen omfattar.
        "description": [
            "Den finansiella förvaltningen handlar om fastighetens ekonomi: hyror och avgifter, budget, uppföljning och rapportering till ägaren.",
            "Den tekniska förvaltningen handlar om fastighetens skick: drift, tillsyn och planering av underhåll, så att byggnaden fungerar och behåller sitt värde. När något behöver byggas om finns byggtjänster inom samma företag, genom Västkust Bygg & Montage AB.",
        ],
        "includes": ["Finansiell förvaltning", "Teknisk förvaltning", "Bostadsfastigheter", "Kommersiella fastigheter"],
        "galleryHeading": "", "galleryLink": NO_LINK, "gallery": coll([]),
        "icon": "Building2",
        "image": VIDD,
        "seo": {"title": "Förvaltning – CWE Fastighetsförvaltning",
                "description": "Finansiell och teknisk förvaltning av bostadsfastigheter och kommersiella fastigheter."},
    },
    {
        "_id": "byggtjanster",
        "slug": "byggtjanster",
        "name": "Byggtjänster",
        "shortDescription": "Via helägda Västkust Bygg & Montage AB tillhandahåller vi byggtjänster, från idé till färdigt projekt.",
        "lead": "Via helägda Västkust Bygg & Montage AB tillhandahåller vi byggtjänster. Vi är med er hela vägen, från idé till färdigt projekt.",
        "description": [
            "Vi erbjuder en helhetslösning där kompetens, noggrannhet och tydlighet är viktiga faktorer för oss. Vår erfarenhet och expertis inom byggbranschen gör oss till det optimala valet för ditt projekt.",
            "Västkust Bygg & Montage AB nås på 076-882 03 33 och info@vastkustbygg.se, måndag–fredag 08.00–17.00.",
        ],
        "includes": ["Nybyggnation", "Renovering och ombyggnad", "Badrumsrenovering enligt BBV", "Köksrenovering", "Kontor och lokalanpassning"],
        "galleryHeading": "Bilder från Västkust Bygg & Montages projekt",
        "galleryLink": link("Till vastkustbygg.se", "https://vastkustbygg.se/"),
        "gallery": coll([
            {"image": img("badrum-a", "Renoverat badrum med nya plattor"), "caption": "Badrum"},
            {"image": img("kok-a", "Nytt kök med ljusa trästommar och massiv bänkskiva"), "caption": "Kök"},
            {"image": img("kontor-glas", "Glasvägg mot mötesrum i en ombyggd kontorslokal"), "caption": "Kontor"},
            {"image": img("badrum-b", "Badrum med dusch och nya plattor"), "caption": "Badrum"},
            {"image": img("kok-b", "Det nya köket med fönster och spotlightskena"), "caption": "Kök"},
            {"image": img("kontor-b", "Ombyggd kontorslokal"), "caption": "Kontor"},
        ], "g"),
        "icon": "Hammer",
        "image": img("kok-a", "Nytt kök byggt av Västkust Bygg & Montage", "50% 60%"),
        "seo": {"title": "Byggtjänster via Västkust Bygg & Montage AB",
                "description": "Byggtjänster via helägda Västkust Bygg & Montage AB: nybyggnation, renovering, badrum, kök och kontor. Från idé till färdigt projekt."},
    },
]

certificates = [
    {"_id": "vatrum", "name": "Våtrumsbehörighet", "issuer": "Byggkeramikrådet", "validUntil": "",
     "description": "Västkust Bygg & Montage är utbildade hos Byggkeramikrådet och arbetar efter branschreglerna för våtrum, BBV. Efter varje våtrumsprojekt lämnas ett kvalitetsdokument.",
     "image": png("badge-vatrum", "Behörig våtrum – Byggkeramikrådet")},
    {"_id": "id06", "name": "ID06", "issuer": "", "validUntil": "",
     "description": "Närvaroregistrering på arbetsplatsen, digitala utbildningsbevis och behörighetskontroll.",
     "image": png("badge-id06", "ID06")},
    {"_id": "bas", "name": "BAS P och BAS U", "issuer": "", "validUntil": "",
     "description": "Utbildade byggarbetsmiljösamordnare för planering och projektering (BAS P) och för utförande (BAS U).",
     "image": None},
    {"_id": "forsakring", "name": "Allrisk- och ansvarsförsäkring", "issuer": "Länsförsäkringar", "validUntil": "",
     "description": "Allrisk- och ansvarsförsäkring genom Länsförsäkringar.",
     "image": png("badge-lf", "Länsförsäkringar")},
    {"_id": "fora", "name": "Kollektivavtalade försäkringar", "issuer": "Fora", "validUntil": "",
     "description": "De anställda omfattas av kollektivavtalade försäkringar genom Fora.",
     "image": png("badge-fora", "FORA")},
]

TIMELINE = sec(
    "timeline", "uppdrag", "Management Consulting",
    heading="Slutförda uppdrag",
    text="Tre uppdrag i följd som projektledare för alla europeiska affärsenheter inom Logisnext Mitsubishi Forklift Trucks Europe.",
    items=coll([
        {"title": "Proof of Concept för nytt ERP-system", "start": "2023-11", "end": "2024-04",
         "text": "Projektledare för Proof of Concept för nytt ERP-system för alla europeiska affärsenheter inom Logisnext Mitsubishi Forklift Trucks Europe."},
        {"title": "Utveckling och idrifttagande av CRM/CPQ-system", "start": "2024-06", "end": "2025-05",
         "text": "Projektledare för utveckling och idrifttagande av ett CRM/CPQ-system för alla europeiska affärsenheter inom Logisnext Mitsubishi Forklift Trucks Europe."},
        {"title": "Analysfas inför nytt ERP-system (Microsoft Business Central)", "start": "2025-06", "end": "2026-04",
         "text": "Projektledare för analysfasen inför implementation av ett nytt ERP-system (Microsoft Business Central) för alla europeiska affärsenheter inom Logisnext Mitsubishi Forklift Trucks Europe."},
    ]),
)

CONTACT_SEC = sec(
    "contact", "kontakt", "Kontakt",
    heading="Hör av dig",
    text="Berätta kort om ditt projekt, så återkommer vi. Vill du hellre ringa går det lika bra.",
    phoneLabel="Telefon", emailLabel="E-post", addressLabel="Adress", openingHoursLabel="Öppettider", orgLabel="Org.nr",
    formHeading="Skicka en förfrågan",
)

home = {
    "_id": "hem", "slug": "", "title": "Hem",
    "seo": {"title": "CW Enterprise AB – Leder, utvecklar och förvaltar dina projekt",
            "description": "CW Enterprise AB i Kullavik: management consulting, finansiell och teknisk fastighetsförvaltning samt byggtjänster via helägda Västkust Bygg & Montage AB."},
    "sections": coll([
        dict(sec("hero", heading="Leder, utvecklar och förvaltar dina projekt!",
                 text="Management consulting, förvaltning av fastigheter och byggtjänster genom vårt helägda dotterbolag Västkust Bygg & Montage AB.",
                 image=FJALL, button=link("Företagets tjänster", "/#tjanster")), _id="hero"),
        dict(sec("services", "tjanster", "Företagets tjänster", heading="Tre verksamheter, samma ägare",
                 link=NO_LINK, cardLinkPrefix="", moreHeading="", moreItems=coll([]),
                 ctaHeading="", ctaText="", ctaButton=CONTACT), _id="tjanster"),
        dict(sec("model", "", "Samma ägare", heading="Projekt, fastighet och bygge på en grund",
                 text="Management Consulting leder och utvecklar, CWE Fastighetsförvaltning förvaltar och Västkust Bygg & Montage bygger. Du kan anlita oss för en del eller för helheten. Peka på en verksamhet för att se den i modellen.",
                 model="koncern", caption="Dra i modellen för att vrida den.",
                 parts=coll([{"label": "Konsult", "color": KONSULT}, {"label": "Förvaltning", "color": FORV}, {"label": "Bygg", "color": BYGG}])), _id="modell"),
        dict(TIMELINE, _id="uppdrag"),
        dict(sec("text", "", "Byggtjänster", heading="Med er hela vägen, från idé till färdigt projekt",
                 paragraphs=["Via helägda Västkust Bygg & Montage AB tillhandahåller vi byggtjänster. Vi erbjuder en helhetslösning där kompetens, noggrannhet och tydlighet är viktiga faktorer för oss.",
                             "Vår erfarenhet och expertis inom byggbranschen gör oss till det optimala valet för ditt projekt."],
                 image=png("logo-vastkust", "Västkust Bygg & Montage AB"), imageSide="left",
                 button=link("Till Västkust Bygg & Montages hemsida", "https://vastkustbygg.se/"), tone="card"), _id="bygg"),
        dict(CONTACT_SEC, _id="kontakt"),
    ]),
}

contact_page = {
    "_id": "kontakt", "slug": "kontakt", "title": "Kontakt",
    "seo": {"title": "Kontakt", "description": f"Kontakta {NAME}, Kullaviks Kvarnfallsväg 11, 429 33 Kullavik. Telefon {PHONE}, e-post {EMAIL}."},
    "sections": coll([
        dict(sec("pageHero", "", "Kontakt", heading="Hör av dig", text="Ring, mejla eller skriv några rader om ditt projekt.",
                 button=NO_LINK, image=FJALL, size="medium"), _id="bild"),
        dict(CONTACT_SEC, _id="s2"),
        dict(sec("map", "", "Hitta hit", heading="Kullavik", addressPrefix="", linkLabel="Öppna i Google Maps", zoom=12), _id="s3"),
    ]),
}

cert_page = {
    "_id": "certifikat", "slug": "certifikat", "title": "Certifikat",
    "seo": {"title": "Certifikat och försäkringar – byggtjänster",
            "description": "Västkust Bygg & Montage AB: våtrumsbehörighet enligt BBV, ID06, BAS P/U, allrisk- och ansvarsförsäkring via Länsförsäkringar och kollektivavtalade försäkringar via Fora."},
    "sections": coll([
        dict(sec("pageHero", "", "Byggtjänster", heading="Certifikat och försäkringar",
                 text="Det som skyddar dig som kund i byggprojekten, och som visar att arbetet görs enligt branschens regler.",
                 button=NO_LINK, image=img("badrum-a", "Renoverat badrum med nya plattor", "50% 55%"), size="medium"), _id="bild"),
        dict(sec("certificates", "", "Västkust Bygg & Montage AB", heading="Behörigheter och försäkringar", text="",
                 issuerPrefix="", validUntilPrefix="Giltigt till", emptyHeading="Certifikat", emptyText="Fråga oss gärna om behörigheterna på"), _id="s2"),
        dict(sec("cta", heading="Har du ett byggprojekt på gång?", text="Berätta vad du vill göra, så återkommer vi.", button=CONTACT), _id="s3"),
    ]),
}

site = {
    "schemaVersion": 1,
    "theme": {
        "colors": {
            "primary": KONSULT, "secondary": "#1C1F22", "accent": FORV, "background": "#FBFBF9", "surface": "#EFF1ED",
            "text": "#4A5157", "heading": "#1C1F22", "muted": "#5A6065", "subtle": "#C7CCC6", "border": "#DCDFDA",
            "input": "#FFFFFF", "link": KONSULT, "button": "#1C1F22", "buttonHover": KONSULT, "buttonText": "#FFFFFF",
            "navigation": "#FBFBF9", "navigationText": "#1C1F22", "footer": "#1C1F22", "footerText": "#C4C8CC",
            "onPrimary": "#FFFFFF", "success": "#1E7B3A", "warning": "#B45309", "error": "#B91C1C",
        },
        "fonts": {
            "heading": {"family": "Josefin Sans", "category": "sans-serif"},
            "body": {"family": "Nunito Sans", "category": "sans-serif"},
            "button": {"family": "Nunito Sans", "category": "sans-serif"},
        },
    },
    "settings": {
        "siteName": NAME, "siteUrl": SITE_URL, "language": "sv",
        "favicon": {"src": "/icon.png", "variants": [], "alt": ""},
        "logo": {"kind": "wordmark"}, "analyticsId": "",
        "maintenance": {"enabled": False, "heading": "Vi uppdaterar hemsidan",
                        "text": "Sidan är snart tillbaka. Under tiden når du oss på telefon eller e-post."},
    },
    "company": {
        "legalName": NAME, "shortName": NAME, "foundedYear": 2023, "employees": 0, "city": "Kungsbacka",
        "serviceArea": "Kullavik och Göteborgsregionen",
        "address": {"street": "Kullaviks Kvarnfallsväg 11", "postalCode": "429 33", "city": "Kullavik", "country": "SE",
                    "geo": {"lat": 57.5508, "lng": 11.9636}},
        "phone": PHONE, "email": EMAIL, "orgNumber": "", "vatNumber": "", "openingHours": "",
        "social": {"facebook": "", "instagram": "", "linkedin": ""},
    },
    "navigation": {
        "barLinks": coll([dict(link("Uppdrag", "/#uppdrag"), _id="uppdrag"),
                          dict(link("Certifikat", "/certifikat"), _id="certifikat"),
                          dict(link("Kontakt", "/kontakt"), _id="kontakt")]),
        "menu": coll([{"_id": "hem", "label": "Start", "href": "/", "kind": "link"},
                      {"_id": "tjanster", "label": "Tjänster", "href": "/#tjanster", "kind": "services"},
                      {"_id": "uppdrag", "label": "Slutförda uppdrag", "href": "/#uppdrag", "kind": "link"},
                      {"_id": "certifikat", "label": "Certifikat (bygg)", "href": "/certifikat", "kind": "link"},
                      {"_id": "kontakt", "label": "Kontakt", "href": "/kontakt", "kind": "link"}]),
        "menuButton": "Kontakta oss",
    },
    "footer": {
        "contactHeading": "Kontakt", "servicesHeading": "Tjänster", "companyHeading": "Företaget",
        "companyLinks": coll([dict(link("Slutförda uppdrag", "/#uppdrag"), _id="uppdrag"),
                              dict(link("Certifikat och försäkringar", "/certifikat"), _id="certifikat"),
                              dict(link("Västkust Bygg & Montage AB", "https://vastkustbygg.se/"), _id="vastkust"),
                              dict(link("Kontakt", "/kontakt"), _id="kontakt")]),
        "button": CONTACT, "copyrightName": NAME, "orgLabel": "Org.nr", "vatLabel": "Momsreg.nr",
    },
    "form": {
        "modalHeading": "Skicka en förfrågan",
        "labels": {"name": "Namn", "phone": "Telefon", "email": "E-post", "workType": "Vad gäller det?", "description": "Meddelande"},
        "workTypePlaceholder": "Välj tjänst", "descriptionPlaceholder": "Berätta kort om ditt projekt eller din fråga.",
        "workTypes": coll([{"label": t} for t in ["Management Consulting", "Förvaltning", "Byggtjänster", "Annat"]], "t"),
        "contactHint": "Det räcker med telefon eller e-post.",
        "errors": {"name": "Ange ditt namn.", "contact": "Ange telefonnummer eller e-postadress, så att vi kan nå dig.",
                   "phone": "Ange ett giltigt telefonnummer.", "email": "Ange en giltig e-postadress.", "workType": "Välj vad det gäller."},
        "submit": "Skicka", "sending": "Skickar…", "sendFailed": "Meddelandet kunde inte skickas. Försök igen eller ring oss på",
        "closeHint": "Du kan stänga rutan när som helst genom att klicka utanför eller på", "closeHintButton": "X",
        "confirmation": "Tack! Vi återkommer så snart vi kan.", "emailSubject": "Förfrågan från {namn}",
    },
    "ui": UI,
    "servicePage": {
        "badge": "", "eyebrow": "Företagets tjänster", "includesHeading": "Det här ingår", "galleryEyebrow": "Från projekten",
        "reviewsEyebrow": "Omdömen", "reviewsHeading": "Vad kunderna säger", "moreEyebrow": "Fler tjänster",
        "cta": {"heading": "Vill du veta mer?", "text": "Berätta om ditt projekt, så återkommer vi.", "button": CONTACT},
        "factsTitle": "Fakta",
        "factLabels": {"service": "Tjänst", "performedBy": "Utförs av", "seat": "Säte", "area": "Område", "org": "Org.nr"},
        "contactTagline": "Leder, utvecklar och förvaltar dina projekt", "contactButton": CONTACT,
        "backLink": {"label": "Tillbaka till tjänsterna", "href": "/#tjanster"}, "moreHeading": "Företagets övriga tjänster",
        "breadcrumbLabel": "Tjänster", "breadcrumbHref": "/#tjanster",
    },
    "notFound": {"eyebrow": "404", "heading": "Sidan finns inte", "text": "Länken kan vara gammal eller felstavad.",
                 "button": {"label": "Till startsidan", "href": "/"}, "seoTitle": "Sidan finns inte"},
    "services": coll(services),
    "uppdrag": coll([]),
    "certificates": coll(certificates),
    "pages": coll([home, cert_page, contact_page]),
}

text = json.dumps(site, ensure_ascii=False, indent=2) + "\n"
(ROOT / "content/baseline.json").write_text(text)

sql_path = ROOT / "supabase/migrations/20261002120400_baseline.sql"
sql = sql_path.read_text()
sql = re.sub(r"\$baseline\$.*?\$baseline\$", lambda _: "$baseline$" + json.dumps(site, ensure_ascii=False) + "$baseline$", sql, count=1, flags=re.S)
sql = re.sub(r"values \('admin', 'primary', '#[0-9A-Fa-f]{6}'\)", f"values ('admin', 'primary', '{KONSULT}')", sql)
sql_path.write_text(sql)
print("content/baseline.json:", len(site["pages"]["order"]), "sidor,", len(services), "tjänster")
