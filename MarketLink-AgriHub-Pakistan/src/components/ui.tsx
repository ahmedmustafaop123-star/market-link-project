"use client";

import { useEffect, type ReactNode } from "react";
import { STATUS_LABELS, STATUS_STYLES } from "@/lib/constants";
import { useI18n } from "@/components/providers";

export async function api<T = unknown>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
    body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({ success: false, error: "Invalid server response" }));
  if (!res.ok || !data.success) throw new Error(data.error || `Request failed (${res.status})`);
  return data.data as T;
}

export function Badge({ status, label, dot = true }: { status: string; label?: string; dot?: boolean }) {
  const style = STATUS_STYLES[status] ?? "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ring-1 ring-current/15 ring-inset ${style}`}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" aria-hidden />}
      {label ?? STATUS_LABELS[status] ?? status.replace(/_/g, " ")}
    </span>
  );
}

export function GradeBadge({ grade }: { grade: string }) {
  const c =
    grade === "A"
      ? "bg-emerald-600 text-white"
      : grade === "B"
        ? "bg-amber-500 text-white"
        : "bg-slate-500 text-white";
  return <span className={`inline-flex h-6 min-w-6 items-center justify-center rounded-md px-1.5 text-xs font-bold ${c}`}>Grade {grade}</span>;
}

export function StatCard({ label, value, sub, icon, tone = "brand" }: { label: string; value: ReactNode; sub?: ReactNode; icon: string; tone?: "brand" | "amber" | "sky" | "rose" | "violet" }) {
  const tones = {
    brand: { chip: "bg-brand-900 text-white", bar: "from-brand-500 to-brand-900" },
    amber: { chip: "bg-gold-400 text-brand-950", bar: "from-gold-300 to-gold-500" },
    sky: { chip: "bg-sky-600 text-white", bar: "from-sky-400 to-sky-700" },
    rose: { chip: "bg-rose-600 text-white", bar: "from-rose-400 to-rose-700" },
    violet: { chip: "bg-violet-600 text-white", bar: "from-violet-400 to-violet-700" },
  };
  return (
    <div className="card relative overflow-hidden p-4 sm:p-5">
      <span className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${tones[tone].bar}`} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold tracking-wider text-slate-500 uppercase dark:text-slate-400">{label}</p>
          <p className="mt-2 text-lg leading-tight font-extrabold tracking-tight whitespace-nowrap tabular-nums sm:text-xl 2xl:text-2xl">{value}</p>
          {sub && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{sub}</p>}
        </div>
        <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-xl shadow-sm ${tones[tone].chip}`}>{icon}</div>
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions, urdu }: { title: string; subtitle?: string; actions?: ReactNode; urdu?: string }) {
  const { lang } = useI18n();
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <div className="mb-2 flex items-center gap-2">
          <span className="h-0.5 w-7 rounded-full bg-gradient-to-r from-brand-900 to-gold-400" aria-hidden />
          <span className="text-[10px] font-bold tracking-[0.18em] text-brand-700 uppercase dark:text-gold-400">MARKETLINK AGRI-HUB</span>
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight text-brand-950 sm:text-3xl dark:text-white">{lang === "ur" && urdu ? urdu : title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ icon, title, body, action }: { icon: string; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center px-6 py-14 text-center">
      <div className="text-5xl">{icon}</div>
      <p className="mt-3 font-semibold">{title}</p>
      {body && <p className="mt-1 max-w-md text-sm text-slate-500 dark:text-slate-400">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return <span className={`inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent ${className}`} />;
}

export function LoadingBlock() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="card h-40 animate-pulse bg-slate-100 dark:bg-slate-800/60" />
      ))}
    </div>
  );
}

function useEscape(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", h);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  useEscape(open, onClose);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className={`animate-fade-in card max-h-[92vh] w-full overflow-y-auto rounded-b-none sm:rounded-2xl ${wide ? "sm:max-w-3xl" : "sm:max-w-lg"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/95 px-5 py-3.5 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
          <h3 className="font-semibold">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Close">✕</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Drawer({ open, onClose, title, children, wide = false }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; wide?: boolean }) {
  useEscape(open, onClose);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm" onClick={onClose}>
      <aside
        className={`animate-slide-in absolute top-0 right-0 flex h-full w-full flex-col bg-white shadow-2xl dark:bg-[#0d1f16] ${wide ? "max-w-xl" : "max-w-md"}`}
        onClick={(e) => e.stopPropagation()}
        dir="ltr"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <h3 className="font-semibold">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Close">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </aside>
    </div>
  );
}

/** Resize + JPEG-compress an image file client-side to a data URL. */
export function compressImage(file: File, maxDim = 960, quality = 0.72): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Invalid image"));
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
