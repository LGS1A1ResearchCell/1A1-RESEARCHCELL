"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Photograph upload with a draggable focal point.
 *
 * On automatic face-centring, which the specification asks for "if practical":
 * it is not, and deliberately so. The only browser-native option is the
 * FaceDetector API, which is unshipped outside a Chromium flag; everything else
 * means bundling a detection model or calling a third-party service. The brief
 * rules out adding such a service without asking, and rightly rules out
 * biometric processing of children's photographs altogether.
 *
 * So the "automatic" part is a sensible default rather than detection: the
 * focal point starts at 50% across and 40% down, which frames a head-and-
 * shoulders portrait correctly almost every time. Where it does not, the
 * student drags the circle to fix it. That is the manual fallback the brief
 * accepts, and it never analyses the image at all -- no face is detected,
 * matched or stored, only a pair of coordinates the student chose.
 */

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];

export type CropValue = { focalX: number; focalY: number };

export function PhotoCropper({
  initialUrl,
  initialFocal,
  onChange,
}: {
  initialUrl: string | null;
  initialFocal: CropValue;
  onChange: (file: File | null, focal: CropValue) => void;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(initialUrl);
  const [file, setFile] = useState<File | null>(null);
  const [focal, setFocal] = useState<CropValue>(initialFocal);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);
  const objectUrlRef = useRef<string | null>(null);

  // Revoke the object URL when it is replaced or the component goes away,
  // otherwise each new selection leaks the previous blob.
  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  const pick = (chosen: File | null) => {
    setError(null);
    if (!chosen) return;

    if (!ACCEPTED.includes(chosen.type)) {
      setError("Please choose a JPEG, PNG or WebP image.");
      return;
    }
    if (chosen.size > MAX_BYTES) {
      setError("Please choose an image under 5 MB.");
      return;
    }

    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const url = URL.createObjectURL(chosen);
    objectUrlRef.current = url;

    // A new photograph resets the framing to the default, since the previous
    // focal point described a different image.
    const reset = { focalX: 0.5, focalY: 0.4 };
    setPreviewUrl(url);
    setFile(chosen);
    setFocal(reset);
    onChange(chosen, reset);
  };

  const moveFocal = useCallback(
    (clientX: number, clientY: number) => {
      const box = frameRef.current?.getBoundingClientRect();
      if (!box) return;
      const next = {
        focalX: Math.min(1, Math.max(0, (clientX - box.left) / box.width)),
        focalY: Math.min(1, Math.max(0, (clientY - box.top) / box.height)),
      };
      setFocal(next);
      onChange(file, next);
    },
    [file, onChange],
  );

  // Keyboard adjustment, so framing does not require a pointer.
  const nudge = (dx: number, dy: number) => {
    const next = {
      focalX: Math.min(1, Math.max(0, focal.focalX + dx)),
      focalY: Math.min(1, Math.max(0, focal.focalY + dy)),
    };
    setFocal(next);
    onChange(file, next);
  };

  return (
    <div>
      <div className="flex flex-wrap items-start gap-6">
        <div>
          <div
            ref={frameRef}
            role={previewUrl ? "application" : undefined}
            aria-label={previewUrl ? "Photograph framing. Drag, or use the arrow keys, to choose which part of the picture is shown." : undefined}
            tabIndex={previewUrl ? 0 : -1}
            onPointerDown={(e) => {
              if (!previewUrl) return;
              e.currentTarget.setPointerCapture(e.pointerId);
              setDragging(true);
              moveFocal(e.clientX, e.clientY);
            }}
            onPointerMove={(e) => {
              if (dragging) moveFocal(e.clientX, e.clientY);
            }}
            onPointerUp={(e) => {
              e.currentTarget.releasePointerCapture(e.pointerId);
              setDragging(false);
            }}
            onKeyDown={(e) => {
              const step = e.shiftKey ? 0.1 : 0.02;
              if (e.key === "ArrowLeft") { e.preventDefault(); nudge(-step, 0); }
              if (e.key === "ArrowRight") { e.preventDefault(); nudge(step, 0); }
              if (e.key === "ArrowUp") { e.preventDefault(); nudge(0, -step); }
              if (e.key === "ArrowDown") { e.preventDefault(); nudge(0, step); }
            }}
            className={`relative h-40 w-40 overflow-hidden rounded-full bg-lgs-100 ring-1 ring-border-subtle ${
              previewUrl ? "cursor-move touch-none" : ""
            }`}
          >
            {previewUrl ? (
              /* A plain <img>: this previews a blob: URL from the file the
                 student just picked, which the image optimiser cannot handle. */
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt=""
                draggable={false}
                className="h-full w-full object-cover select-none"
                style={{ objectPosition: `${focal.focalX * 100}% ${focal.focalY * 100}%` }}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center px-4 text-center font-ui text-xs text-ink-muted">
                No photograph yet
              </div>
            )}
          </div>

          {previewUrl && (
            <p className="mt-2 max-w-40 font-ui text-xs leading-relaxed text-ink-muted">
              Drag, or use the arrow keys, to centre your face.
            </p>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <label
            htmlFor="photo"
            className="block font-ui text-sm font-medium text-ink-strong"
          >
            Photograph
          </label>
          <input
            id="photo"
            type="file"
            accept={ACCEPTED.join(",")}
            onChange={(e) => pick(e.target.files?.[0] ?? null)}
            className="mt-1.5 block w-full font-ui text-sm text-ink-body file:mr-3 file:rounded file:border-0 file:bg-cell-ink file:px-3 file:py-2 file:font-ui file:text-sm file:font-semibold file:text-white"
          />
          <p className="mt-1.5 font-ui text-xs text-ink-muted">
            JPEG, PNG or WebP, up to 5 MB. Shown as a circle.
          </p>

          {error && (
            <p role="alert" className="mt-2 font-ui text-xs text-cell-coral">
              {error}
            </p>
          )}

          <p className="mt-4 rounded border border-border-subtle bg-surface-muted px-3 py-2.5 font-ui text-xs leading-relaxed text-ink-muted">
            Your photograph is only shown publicly if school administration has
            made your profile public. Uploading one does not publish it.
          </p>
        </div>
      </div>
    </div>
  );
}
