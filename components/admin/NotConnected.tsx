import Link from "next/link";
import { AuthCard } from "./AuthCard";

/** What the admin shows on a build that has no Supabase project configured. */
export function NotConnected() {
  return (
    <AuthCard
      title="Adminpanelen är inte ansluten"
      intro="Den här versionen av hemsidan är byggd utan koppling till en databas, så det går inte att logga in här. Kontakta Elevate Studio om du behöver ändra något på hemsidan."
    >
      <Link
        href="/"
        className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-white px-5 text-[15px] font-semibold text-admin-ink ring-1 ring-inset ring-admin-line hover:bg-stone-50"
      >
        Till hemsidan
      </Link>
    </AuthCard>
  );
}
