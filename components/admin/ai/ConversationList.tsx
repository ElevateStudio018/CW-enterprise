"use client";

import { useState } from "react";
import { Check, MessageSquare, Pencil, Plus, Trash2, X } from "lucide-react";
import { AdminButton } from "../ui/Button";
import { Dialog } from "../ui/Dialog";
import { Skeleton } from "../ui/Skeleton";
import { formatRelative } from "@/lib/admin/dates";
import type { AiConversation } from "@/lib/admin/ai";

/** The saved conversations: open one, start a new one, rename or delete. */
export function ConversationList({
  conversations,
  activeId,
  disabled,
  onOpen,
  onNew,
  onRename,
  onDelete,
}: {
  conversations: AiConversation[] | null;
  activeId: string | null;
  disabled: boolean;
  onOpen: (id: string) => void;
  onNew: () => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [removing, setRemoving] = useState<AiConversation | null>(null);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <AdminButton variant="primary" icon={Plus} onClick={onNew} disabled={disabled} className="w-full">
        Ny konversation
      </AdminButton>
      <h2 className="mb-1.5 mt-5 px-1 text-[13px] font-semibold text-admin-muted">Tidigare</h2>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {conversations === null ? (
          <div className="space-y-2" role="status" aria-label="Laddar konversationer">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-xl" />
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <p className="px-1 text-[14px] text-admin-muted">Inga konversationer än.</p>
        ) : (
          <ul className="space-y-1">
            {conversations.map((conversation) => {
              const active = conversation.id === activeId;
              return (
                <li key={conversation.id}>
                  {editing === conversation.id ? (
                    <form
                      className="flex items-center gap-1 rounded-xl bg-white p-1 ring-2 ring-admin"
                      onSubmit={(event) => {
                        event.preventDefault();
                        if (title.trim()) onRename(conversation.id, title.trim());
                        setEditing(null);
                      }}
                    >
                      <label className="sr-only" htmlFor={`rename-${conversation.id}`}>
                        Nytt namn
                      </label>
                      <input
                        id={`rename-${conversation.id}`}
                        value={title}
                        onChange={(event) => setTitle(event.target.value)}
                        onKeyDown={(event) => event.key === "Escape" && setEditing(null)}
                        maxLength={120}
                        autoFocus
                        className="min-h-9 min-w-0 flex-1 rounded-lg px-2 text-[16px] sm:text-[14px] text-admin-ink focus:outline-none"
                      />
                      <button type="submit" aria-label="Spara namnet" className="flex h-9 w-9 items-center justify-center rounded-lg text-admin hover:bg-admin/10">
                        <Check aria-hidden="true" className="h-4 w-4" />
                      </button>
                      <button type="button" aria-label="Avbryt" onClick={() => setEditing(null)} className="flex h-9 w-9 items-center justify-center rounded-lg text-admin-muted hover:bg-stone-100">
                        <X aria-hidden="true" className="h-4 w-4" />
                      </button>
                    </form>
                  ) : (
                    <div className={`group flex items-center rounded-xl transition ${active ? "bg-white ring-1 ring-admin-line" : "hover:bg-stone-900/5"}`}>
                      <button
                        type="button"
                        onClick={() => onOpen(conversation.id)}
                        disabled={disabled}
                        aria-current={active || undefined}
                        className="flex min-h-12 min-w-0 flex-1 items-center gap-2.5 rounded-xl px-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-admin disabled:cursor-not-allowed"
                      >
                        <MessageSquare aria-hidden="true" className={`h-4 w-4 shrink-0 ${active ? "text-admin" : "text-admin-muted"}`} />
                        <span className="min-w-0">
                          <span className="block truncate text-[14px] font-semibold text-admin-ink">{conversation.title}</span>
                          <span className="block text-[12px] text-admin-muted">{formatRelative(conversation.updated_at)}</span>
                        </span>
                      </button>
                      <button
                        type="button"
                        aria-label={`Byt namn på ”${conversation.title}”`}
                        onClick={() => {
                          setEditing(conversation.id);
                          setTitle(conversation.title);
                        }}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-admin-muted opacity-70 hover:bg-stone-100 hover:text-admin-ink group-hover:opacity-100 focus-visible:opacity-100"
                      >
                        <Pencil aria-hidden="true" className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Ta bort ”${conversation.title}”`}
                        onClick={() => setRemoving(conversation)}
                        className="mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-admin-muted opacity-70 hover:bg-red-50 hover:text-red-700 group-hover:opacity-100 focus-visible:opacity-100"
                      >
                        <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <Dialog
        open={removing !== null}
        onClose={() => setRemoving(null)}
        title="Ta bort konversationen?"
        description="Själva konversationen försvinner. Ändringar som redan publicerats finns kvar på hemsidan och i versionshistoriken."
        size="sm"
        footer={
          <>
            <AdminButton variant="secondary" onClick={() => setRemoving(null)} data-autofocus>
              Behåll
            </AdminButton>
            <AdminButton
              variant="danger"
              onClick={() => {
                if (removing) onDelete(removing.id);
                setRemoving(null);
              }}
            >
              Ta bort
            </AdminButton>
          </>
        }
      />
    </div>
  );
}
