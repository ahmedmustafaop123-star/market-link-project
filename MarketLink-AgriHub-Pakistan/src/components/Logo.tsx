type LogoProps = {
  /** "full" displays the brand lockup; "mark" shows only the infinity/wheat symbol. */
  variant?: "full" | "mark";
  /** Height of the vector symbol in pixels. */
  size?: number;
  /** Force white text when placed over a dark/green surface. */
  tone?: "auto" | "light";
  /** Add a small Pakistan label beneath the wordmark for large placements. */
  tagline?: boolean;
  className?: string;
};

/**
 * MARKETLINK AGRI-HUB logo. One transparent SVG symbol is shared by the
 * navigation, dashboards, auth screens, chatbot, favicon and email templates.
 * The lockup stays readable in both light and dark themes.
 */
export function Logo({ variant = "full", size = 38, tone = "auto", tagline = false, className = "" }: LogoProps) {
  const image = (
    <span
      className="inline-grid shrink-0 place-items-center overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-brand-900/10"
      style={{ width: Math.round(size * 1.64), height: size, padding: Math.max(2, Math.round(size * 0.04)) }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/marketlink-symbol.svg"
        alt={variant === "mark" ? "MARKETLINK AGRI-HUB" : ""}
        width={Math.round(size * 1.58)}
        height={Math.round(size * 0.96)}
        className="block h-full w-full object-contain"
      />
    </span>
  );

  if (variant === "mark") return <span className={`inline-flex ${className}`}>{image}</span>;

  return (
    <span className={`inline-flex items-center gap-2.5 whitespace-nowrap ${className}`}>
      {image}
      <span className="block leading-none">
        <span
          className={`block font-black tracking-[0.035em] ${tone === "light" ? "text-white" : "text-brand-950 dark:text-white"}`}
          style={{ fontSize: Math.max(14, Math.round(size * 0.42)) }}
        >
          MARKETLINK
        </span>
        <span
          className="mt-1 flex items-center gap-1.5 font-bold tracking-[0.27em] text-[#d69924]"
          style={{ fontSize: Math.max(9, Math.round(size * 0.25)) }}
        >
          AGRI-HUB
          {tagline && <span className={`font-medium tracking-[0.04em] ${tone === "light" ? "text-white/60" : "text-slate-400"}`}>PAKISTAN</span>}
        </span>
      </span>
    </span>
  );
}
