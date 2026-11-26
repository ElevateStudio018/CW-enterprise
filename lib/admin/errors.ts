/** A Swedish message for a failure, for toasts and inline errors. */
export function errorMessage(error: unknown, fallback = "Något gick fel. Försök igen."): string {
  if (error && typeof error === "object" && "message" in error && typeof (error as { message: unknown }).message === "string") {
    const message = (error as { message: string }).message;
    if (/failed to fetch|networkerror|load failed/i.test(message)) return "Ingen kontakt med GitHub. Kontrollera internetanslutningen.";
    if (/[åäöÅÄÖ]/.test(message)) return message;
  }
  return fallback;
}
