"use client";

import { useState } from "react";
import { ShieldAlert, Undo2 } from "lucide-react";
import { Card } from "../ui/Card";
import { AdminButton } from "../ui/Button";
import { Dialog } from "../ui/Dialog";
import { TextArea, TextField } from "../ui/Field";
import { useToast } from "../ui/Toast";
import { useAdminData } from "@/contexts/admin/AdminDataContext";
import { callFunction, errorMessage } from "@/lib/admin/supabase";
import { formatDateTime } from "@/lib/admin/dates";

/** "Rensa alla ändringar": a request that Elevate Studio approves or denies; nothing changes before that. */
export function DangerTab() {
  const toast = useToast();
  const { pendingReset, refreshReset } = useAdminData();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function request() {
    setBusy(true);
    try {
      await callFunction("reset-request", { confirm: "RENSA", reason: reason.trim() || undefined });
      await refreshReset();
      toast.success("Begäran är skickad till Elevate Studio. Du får ett mejl när den är behandlad.");
      setOpen(false);
      setTyped("");
      setReason("");
    } catch (error) {
      toast.error(errorMessage(error, "Begäran kunde inte skickas. Försök igen."));
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    setBusy(true);
    try {
      await callFunction("reset-request", undefined, "DELETE");
      await refreshReset();
      toast.success("Begäran är återkallad. Ingenting har ändrats.");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="max-w-3xl ring-1 ring-red-200">
      <div className="flex items-start gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-red-700">
          <ShieldAlert aria-hidden="true" className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[17px] font-semibold text-admin-ink">Rensa alla ändringar</h2>
          <p className="mt-1 text-[15px] leading-relaxed text-admin-muted">
            Hemsidan återställs till den ursprungliga versionen: alla ändringar av texter, färger, typsnitt och sektioner tas bort. Offertförfrågningar,
            bilder, credits, historik och inloggningar påverkas inte. Elevate Studio måste godkänna begäran, och en säkerhetskopia tas innan något
            ändras – så även en rensning går att ångra.
          </p>

          {pendingReset ? (
            <div className="mt-5 rounded-xl bg-amber-50 p-4">
              <p className="font-semibold text-amber-900">Begäran väntar på godkännande från Elevate Studio</p>
              <p className="mt-1 text-[14px] text-amber-900/80">
                Skickad {formatDateTime(pendingReset.created_at)}. Den går ut {formatDateTime(pendingReset.expires_at)} om ingen tar ställning.
              </p>
              <AdminButton size="sm" icon={Undo2} className="mt-3" onClick={() => void cancel()} busy={busy} busyLabel="Återkallar…">
                Återkalla begäran
              </AdminButton>
            </div>
          ) : (
            <AdminButton variant="danger" className="mt-5" onClick={() => setOpen(true)}>
              Rensa alla ändringar
            </AdminButton>
          )}
        </div>
      </div>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Rensa alla ändringar?"
        size="md"
        footer={
          <>
            <AdminButton variant="secondary" onClick={() => setOpen(false)} disabled={busy}>
              Avbryt
            </AdminButton>
            <AdminButton variant="danger" onClick={() => void request()} disabled={typed.trim() !== "RENSA"} busy={busy} busyLabel="Skickar…">
              Skicka begäran
            </AdminButton>
          </>
        }
      >
        <div className="space-y-4">
          <ul className="space-y-2 text-[15px] leading-relaxed text-admin-ink">
            <li>• Hemsidan blir som den ursprungliga versionen, med alla texter, färger, typsnitt och sektioner.</li>
            <li>• Ingenting händer förrän Elevate Studio har godkänt. Du får ett mejl när det är gjort.</li>
            <li>• Offertförfrågningar, bilder, credits och historik finns kvar.</li>
            <li>• Du kan återkalla begäran så länge den väntar.</li>
          </ul>
          <TextArea label="Anledning (valfritt)" value={reason} onChange={setReason} rows={2} recommended={300} />
          <TextField
            label="Skriv RENSA för att bekräfta"
            value={typed}
            onChange={setTyped}
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            data-autofocus
          />
        </div>
      </Dialog>
    </Card>
  );
}
