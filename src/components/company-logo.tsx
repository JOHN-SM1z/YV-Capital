import Image from "next/image";

/**
 * Portfolio logo from YV's public media host, or initials when there is none. Optimized by next/image:
 * source files are up to ~1 MB, while a 44 px logo needs a few KB of WebP.
 */
export function CompanyLogo({ name, url, size = 40 }: { name: string; url: string | null | undefined; size?: number }) {
  if (url) {
    return (
      <Image
        src={url}
        alt=""
        width={size}
        height={size}
        className="shrink-0 rounded-lg border border-line bg-card object-contain"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-lg bg-ink font-display text-sm font-semibold text-white"
      style={{ width: size, height: size }}
    >
      {name.slice(0, 2).toUpperCase()}
    </div>
  );
}
