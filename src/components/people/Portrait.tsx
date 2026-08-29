import { env } from "@/lib/env";

/**
 * Circular portrait with a stored focal point.
 *
 * The crop is not baked into the file. The original upload is kept intact and
 * positioned at render time via object-position, using the focal point stored
 * on the person. That means the framing can be corrected later without asking
 * the student to upload their photograph again, and the same file serves every
 * size on the site.
 *
 * Focal coordinates are fractions of width and height, so they hold at any
 * rendered size. The default sits above centre, which frames a head-and-
 * shoulders portrait far better than dead centre does.
 */

export function photoUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return `${env.supabaseUrl}/storage/v1/object/public/profile-photos/${path}`;
}

/** Initials, used when no photograph has been uploaded. */
function initialsOf(name: string): string {
  const parts = name.replace(/\[.*?\]\s*/g, "").trim().split(/\s+/);
  if (parts.length === 0) return "?";
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase() || "?";
}

export function Portrait({
  name,
  photoPath,
  focalX = 0.5,
  focalY = 0.4,
  size = 128,
  className = "",
}: {
  name: string;
  photoPath?: string | null;
  focalX?: number;
  focalY?: number;
  size?: number;
  className?: string;
}) {
  const url = photoUrl(photoPath);

  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-full bg-lgs-100 ring-1 ring-border-subtle ${className}`}
      style={{ width: size, height: size }}
    >
      {url ? (
        /* A plain <img> rather than next/image: the storage host is not in
           next.config images.remotePatterns, and adding it would tie every
           portrait to the optimiser being configured for whichever Supabase
           project the school eventually owns. Portraits are small, lazily
           loaded and already size-capped by the upload limit. */
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={`Portrait of ${name}`}
          width={size}
          height={size}
          loading="lazy"
          className="h-full w-full object-cover"
          style={{ objectPosition: `${focalX * 100}% ${focalY * 100}%` }}
        />
      ) : (
        <div
          aria-hidden="true"
          className="flex h-full w-full items-center justify-center font-heading font-bold text-lgs-700"
          style={{ fontSize: Math.round(size * 0.34) }}
        >
          {initialsOf(name)}
        </div>
      )}
    </div>
  );
}
