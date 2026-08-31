"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import {
  deleteAnnouncement,
  markAllNotificationsRead,
  markNotificationRead,
  saveAnnouncement,
  saveResource,
  updateSiteContent,
  type ContentFormState,
} from "@/lib/content/actions";

const initial: ContentFormState = { ok: false };

function Notice({ state }: { state: ContentFormState }) {
  if (!state.message) return null;
  return (
    <p
      role="status"
      className={`mt-3 rounded px-3 py-2 font-ui text-sm ${
        state.ok
          ? "border border-lgs-200 bg-lgs-50 text-ink-strong"
          : "border border-cell-coral/40 bg-cell-coral/5 text-ink-strong"
      }`}
    >
      {state.message}
    </p>
  );
}

function Busy({ label, busy, tone = "primary" }: { label: string; busy: string; tone?: "primary" | "quiet" }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`rounded px-4 py-2 font-ui text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
        tone === "primary"
          ? "bg-cell-ink text-white hover:bg-cell-ink-deep"
          : "border border-border-subtle text-ink-body hover:border-lgs-500 hover:text-lgs-600"
      }`}
    >
      {pending ? busy : label}
    </button>
  );
}

// -----------------------------------------------------------------------------

export type ContentRow = {
  key: string;
  label: string;
  value: string | null;
  format: string;
  description: string | null;
};

export function SiteContentEditor({ row }: { row: ContentRow }) {
  const [state, action] = useActionState(updateSiteContent, initial);
  const isPlaceholder = !row.value || /^\s*\[PLACEHOLDER/i.test(row.value);

  return (
    <form action={action} className="rounded-lg border border-border-subtle bg-surface p-5">
      <input type="hidden" name="key" value={row.key} />

      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <label htmlFor={`c-${row.key}`} className="font-ui text-sm font-semibold text-ink-strong">
          {row.label}
        </label>
        <span className="font-ui text-xs text-ink-muted">{row.key}</span>
      </div>

      {row.description && (
        <p className="mt-1.5 max-w-prose font-ui text-xs leading-relaxed text-ink-muted">
          {row.description}
        </p>
      )}

      {isPlaceholder && (
        <p className="mt-2 rounded border border-cell-coral/30 bg-cell-coral/5 px-2.5 py-1.5 font-ui text-xs text-ink-body">
          Still a placeholder. Public pages omit this rather than showing it to visitors.
        </p>
      )}

      <textarea
        id={`c-${row.key}`}
        name="value"
        rows={row.format === "text" ? 2 : 5}
        defaultValue={row.value ?? ""}
        className="mt-3 w-full rounded border border-border-subtle bg-surface px-3 py-2.5 text-sm text-ink-strong"
      />

      <div className="mt-3">
        <Busy label="Save" busy="Saving…" tone="quiet" />
      </div>
      <Notice state={state} />
    </form>
  );
}

// -----------------------------------------------------------------------------

export type AnnouncementRow = {
  id: string;
  title: string;
  body: string | null;
  starts_on: string;
  ends_on: string | null;
  is_visible: boolean;
};

export function AnnouncementForm({ row }: { row?: AnnouncementRow }) {
  const [state, action] = useActionState(saveAnnouncement, initial);
  const [delState, remove] = useActionState(deleteAnnouncement, initial);

  return (
    <div className="rounded-lg border border-border-subtle bg-surface p-5">
      <form action={action}>
        {row && <input type="hidden" name="announcement_id" value={row.id} />}

        <div>
          <label htmlFor={`a-title-${row?.id ?? "new"}`} className="block font-ui text-sm font-medium text-ink-strong">
            Title
          </label>
          <input
            id={`a-title-${row?.id ?? "new"}`}
            name="title"
            required
            defaultValue={row?.title ?? ""}
            className="mt-1.5 w-full rounded border border-border-subtle bg-surface px-3 py-2.5 text-sm text-ink-strong"
          />
        </div>

        <div className="mt-4">
          <label htmlFor={`a-body-${row?.id ?? "new"}`} className="block font-ui text-sm font-medium text-ink-strong">
            Body
          </label>
          <textarea
            id={`a-body-${row?.id ?? "new"}`}
            name="body"
            rows={3}
            defaultValue={row?.body ?? ""}
            className="mt-1.5 w-full rounded border border-border-subtle bg-surface px-3 py-2.5 text-sm text-ink-strong"
          />
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div>
            <label htmlFor={`a-start-${row?.id ?? "new"}`} className="block font-ui text-xs text-ink-muted">
              Shown from
            </label>
            <input
              id={`a-start-${row?.id ?? "new"}`}
              name="starts_on"
              type="date"
              defaultValue={row?.starts_on ?? new Date().toISOString().slice(0, 10)}
              className="mt-1 w-full rounded border border-border-subtle bg-surface px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor={`a-end-${row?.id ?? "new"}`} className="block font-ui text-xs text-ink-muted">
              Stops showing after
            </label>
            <input
              id={`a-end-${row?.id ?? "new"}`}
              name="ends_on"
              type="date"
              defaultValue={row?.ends_on ?? ""}
              className="mt-1 w-full rounded border border-border-subtle bg-surface px-3 py-2 text-sm"
            />
          </div>
          <label className="flex items-center gap-2 pb-2 font-ui text-sm text-ink-body">
            <input
              type="checkbox"
              name="is_visible"
              defaultChecked={row?.is_visible ?? true}
              className="h-4 w-4"
            />
            Visible
          </label>
        </div>

        <p className="mt-2 font-ui text-xs text-ink-muted">
          Leave the end date empty to show it indefinitely. An announcement stops
          appearing on its end date automatically.
        </p>

        <div className="mt-4">
          <Busy label={row ? "Save changes" : "Create announcement"} busy="Saving…" />
        </div>
        <Notice state={state} />
      </form>

      {row && (
        <form action={remove} className="mt-3 border-t border-border-subtle pt-3">
          <input type="hidden" name="announcement_id" value={row.id} />
          <button
            type="submit"
            className="rounded border border-border-subtle px-3 py-1.5 font-ui text-xs text-ink-body transition-colors hover:border-cell-coral hover:text-cell-coral"
          >
            Remove
          </button>
          <Notice state={delState} />
        </form>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------

export type ResourceRow = {
  id: string;
  category: string;
  title: string;
  description: string | null;
  body: string | null;
  external_url: string | null;
  is_published: boolean;
};

export function ResourceEditor({ row }: { row: ResourceRow }) {
  const [state, action] = useActionState(saveResource, initial);
  const [open, setOpen] = useState(false);

  return (
    <li className="rounded-lg border border-border-subtle bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <h3 className="font-ui text-sm font-semibold text-ink-strong">{row.title}</h3>
          <p className="font-ui text-xs text-ink-muted">{row.category}</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span
            className={`rounded-full px-2.5 py-0.5 font-ui text-xs font-medium ${
              row.is_published ? "bg-lgs-100 text-lgs-700" : "bg-surface-sunken text-ink-muted"
            }`}
          >
            {row.is_published ? "Published" : "Draft"}
          </span>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="rounded border border-border-subtle px-3 py-1.5 font-ui text-xs font-semibold text-ink-body"
          >
            {open ? "Close" : "Edit"}
          </button>
        </div>
      </div>

      {open && (
        <form action={action} className="border-t border-border-subtle p-4">
          <input type="hidden" name="resource_id" value={row.id} />

          <div>
            <label htmlFor={`r-title-${row.id}`} className="block font-ui text-xs text-ink-muted">Title</label>
            <input id={`r-title-${row.id}`} name="title" required defaultValue={row.title}
              className="mt-1 w-full rounded border border-border-subtle bg-surface px-3 py-2 text-sm" />
          </div>

          <div className="mt-3">
            <label htmlFor={`r-desc-${row.id}`} className="block font-ui text-xs text-ink-muted">Short description</label>
            <input id={`r-desc-${row.id}`} name="description" defaultValue={row.description ?? ""}
              className="mt-1 w-full rounded border border-border-subtle bg-surface px-3 py-2 text-sm" />
          </div>

          <div className="mt-3">
            <label htmlFor={`r-body-${row.id}`} className="block font-ui text-xs text-ink-muted">Content</label>
            <textarea id={`r-body-${row.id}`} name="body" rows={5} defaultValue={row.body ?? ""}
              className="mt-1 w-full rounded border border-border-subtle bg-surface px-3 py-2 text-sm" />
          </div>

          <div className="mt-3">
            <label htmlFor={`r-url-${row.id}`} className="block font-ui text-xs text-ink-muted">
              External link (optional)
            </label>
            <input id={`r-url-${row.id}`} name="external_url" type="url" placeholder="https://"
              defaultValue={row.external_url ?? ""}
              className="mt-1 w-full rounded border border-border-subtle bg-surface px-3 py-2 text-sm" />
          </div>

          <label className="mt-4 flex items-center gap-2 font-ui text-sm text-ink-body">
            <input type="checkbox" name="is_published" defaultChecked={row.is_published} className="h-4 w-4" />
            Publish this on the public Resources page
          </label>

          <div className="mt-4">
            <Busy label="Save" busy="Saving…" tone="quiet" />
          </div>
          <Notice state={state} />
        </form>
      )}
    </li>
  );
}

// -----------------------------------------------------------------------------

export function MarkRead({ id }: { id: string }) {
  const [, action] = useActionState(markNotificationRead, initial);
  return (
    <form action={action}>
      <input type="hidden" name="notification_id" value={id} />
      <button
        type="submit"
        className="rounded border border-border-subtle px-2.5 py-1 font-ui text-xs text-ink-body transition-colors hover:border-lgs-500 hover:text-lgs-600"
      >
        Mark as read
      </button>
    </form>
  );
}

export function MarkAllRead() {
  return (
    <form action={markAllNotificationsRead}>
      <button
        type="submit"
        className="rounded border border-border-subtle px-3 py-1.5 font-ui text-sm text-ink-body transition-colors hover:border-lgs-500 hover:text-lgs-600"
      >
        Mark all as read
      </button>
    </form>
  );
}
