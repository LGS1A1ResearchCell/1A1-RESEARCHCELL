"use client";

import { useActionState, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { PhotoCropper, type CropValue } from "@/components/people/PhotoCropper";
import { updateProfile, type ProfileFormState } from "@/lib/profile/actions";

const initial: ProfileFormState = { ok: false };

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded bg-cell-ink px-5 py-2.5 font-ui text-sm font-semibold text-white transition-colors hover:bg-cell-ink-deep disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Saving…" : "Save profile"}
    </button>
  );
}

export function ProfileForm({
  initialUrl,
  initialFocal,
  initialQuote,
}: {
  initialUrl: string | null;
  initialFocal: CropValue;
  initialQuote: string;
}) {
  const [state, action] = useActionState(updateProfile, initial);
  const [focal, setFocal] = useState<CropValue>(initialFocal);
  const fileRef = useRef<File | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // The cropper owns the file input, so the chosen file is carried onto the
  // FormData here rather than relying on a second, hidden input.
  const onCropChange = (file: File | null, next: CropValue) => {
    fileRef.current = file;
    setFocal(next);
  };

  return (
    <form
      ref={formRef}
      action={(formData) => {
        formData.set("focal_x", String(focal.focalX));
        formData.set("focal_y", String(focal.focalY));
        if (fileRef.current) formData.set("photo", fileRef.current);
        else formData.delete("photo");
        return action(formData);
      }}
      className="space-y-8"
    >
      {state.message && (
        <p
          role="status"
          className={`rounded px-3 py-2.5 font-ui text-sm ${
            state.ok
              ? "border border-lgs-200 bg-lgs-50 text-ink-strong"
              : "border border-cell-coral/40 bg-cell-coral/5 text-ink-strong"
          }`}
        >
          {state.message}
        </p>
      )}

      <PhotoCropper
        initialUrl={initialUrl}
        initialFocal={initialFocal}
        onChange={onCropChange}
      />

      <div>
        <label htmlFor="quote" className="block font-ui text-sm font-medium text-ink-strong">
          Your quote
        </label>
        <textarea
          id="quote"
          name="quote"
          rows={3}
          maxLength={500}
          defaultValue={initialQuote}
          aria-describedby="quote-hint"
          className="mt-1.5 w-full rounded border border-border-subtle bg-surface px-3 py-2.5 text-sm text-ink-strong"
        />
        <p id="quote-hint" className="mt-1.5 font-ui text-xs text-ink-muted">
          Shown beneath your name on the People page. Up to 500 characters.
        </p>
      </div>

      <SaveButton />
    </form>
  );
}
