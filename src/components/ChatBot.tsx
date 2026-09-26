"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Logo } from "@/components/Logo";
import type { AssistantCard, AssistantReply, DealerCard, ListingCard, RateCard } from "@/lib/services/assistant";

/* ------------------------------------------------------------------ */
/* Types & config                                                      */
/* ------------------------------------------------------------------ */
type Msg = { id: string; role: "user" | "bot"; text: string; cards?: AssistantCard[]; suggestions?: string[]; link?: { label: string; href: string }; offline?: boolean };

export type ChatBotProps = {
  /** "app" leaves room for the mobile bottom navigation; "public" sits in the corner */
  placement?: "app" | "public";
  /** Buyer's home city: used for greeting context */
  userCity?: string;
  /** Endpoint that returns AssistantReply JSON (override to plug in an LLM backend) */
  endpoint?: string;
  title?: string;
};

const STORAGE_KEY = "ml-assistant-v1";
const HINT_KEY = "ml-assistant-hint-seen";
const STARTERS = ["Top-rated dealers", "High-quality fruits", "Cheapest wheat", "Mango mandi rate", "How does escrow work?"];

const uid = () => Math.random().toString(36).slice(2, 10);
const rs = (n: number) => "Rs. " + Math.round(n).toLocaleString("en-US");

/** Offline fallback used when the assistant API is unreachable. */
function mockReply(input: string): AssistantReply {
  const t = input.toLowerCase();
  if (/dealer|seller|farmer|supplier|rated/.test(t))
    return { reply: "Top-rated sellers are verified farmers with the most completed deliveries and clean dispute records. Open the marketplace and look for the ✔ verified badge and 🔬 inspected listings.", suggestions: ["High-quality grains", "How does escrow work?"] };
  if (/quality|grade|premium|best/.test(t))
    return { reply: "For the best quality, filter the marketplace by Grade A and prefer listings marked 🔬 Inspected. Those passed a MarketLink quality check (moisture, foreign matter, size).", suggestions: ["Top-rated dealers", "Cheapest wheat"] };
  if (/rate|mandi|price|bhav/.test(t))
    return { reply: "Live mandi rates (per kg and per 40 kg maund) for 10 Pakistani mandis are on the Mandi Insights page, and the ticker at the top shows today's averages.", suggestions: ["Top-rated dealers"] };
  if (/escrow|pay|refund/.test(t))
    return { reply: "Your money is held in escrow and released to the farmer only after you confirm delivery. Disputes freeze the funds until an admin resolves them.", suggestions: ["How do I place a bid?"] };
  return { reply: "I'm having trouble reaching the marketplace right now. Please try again in a moment, or browse the marketplace directly.", suggestions: STARTERS.slice(0, 3) };
}

/* ------------------------------------------------------------------ */
/* Result cards                                                        */
/* ------------------------------------------------------------------ */
function Stars({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = Math.max(0, Math.min(1, value - (i - 1)));
        return (
          <svg key={i} viewBox="0 0 20 20" className="h-3.5 w-3.5" aria-hidden>
            <defs>
              <linearGradient id={`s${i}-${Math.round(fill * 100)}`}>
                <stop offset={`${fill * 100}%`} stopColor="#f1c232" />
                <stop offset={`${fill * 100}%`} stopColor="currentColor" stopOpacity="0.2" />
              </linearGradient>
            </defs>
            <path d="M10 1.8l2.5 5.2 5.7.8-4.1 4 1 5.7L10 14.8l-5.1 2.7 1-5.7-4.1-4 5.7-.8z" fill={`url(#s${i}-${Math.round(fill * 100)})`} />
          </svg>
        );
      })}
    </span>
  );
}

function ListingItem({ c, onNavigate }: { c: ListingCard; onNavigate: () => void }) {
  return (
    <Link href={c.href} onClick={onNavigate} className="group flex gap-3 rounded-2xl border border-slate-200 bg-white p-2.5 transition hover:border-brand-400 hover:shadow-md dark:border-white/10 dark:bg-white/5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={c.image} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-sm font-semibold">{c.title}</p>
          <span className={`shrink-0 rounded px-1 text-[10px] font-bold text-white ${c.grade === "A" ? "bg-emerald-600" : c.grade === "B" ? "bg-amber-500" : "bg-slate-500"}`}>{c.grade}</span>
          {c.inspected && <span className="shrink-0 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">🔬 Inspected</span>}
        </div>
        <p className="truncate text-xs text-slate-500 dark:text-slate-400">
          {c.seller}{c.verified && <span className="text-brand-600"> ✔</span>} · {c.location}{c.distanceKm !== null ? ` · ${c.distanceKm} km` : ""}
        </p>
        <div className="mt-1 flex items-baseline justify-between gap-2">
          <p className="text-sm font-bold text-brand-700 dark:text-brand-400">{rs(c.pricePerKg)}<span className="text-[11px] font-normal text-slate-500">/kg</span></p>
          <p className="text-[11px] text-slate-500">{rs(c.pricePerMaund)}/maund</p>
        </div>
      </div>
    </Link>
  );
}

function DealerItem({ c, onNavigate }: { c: DealerCard; onNavigate: () => void }) {
  const initials = c.name.split(" ").map((p) => p[0]).slice(0, 2).join("");
  return (
    <Link href={c.href} onClick={onNavigate} className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-3 transition hover:border-brand-400 hover:shadow-md dark:border-white/10 dark:bg-white/5">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-900 text-sm font-bold text-gold-400">{initials}</span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1 text-sm font-semibold">
          <span className="truncate">{c.business ?? c.name}</span>
          {c.verified && <span className="shrink-0 text-xs text-brand-600" title="Verified seller" aria-label="Verified seller">✔</span>}
        </p>
        <div className="flex flex-wrap items-center gap-x-1.5 text-xs text-slate-500 dark:text-slate-400">
          <Stars value={c.rating} />
          <span className="font-semibold text-slate-700 dark:text-slate-200">{c.rating.toFixed(1)}</span>
          <span className="whitespace-nowrap">· {c.deliveries} deliveries · {c.city}</span>
        </div>
        <p className="mt-0.5 truncate text-[11px] text-slate-500">{c.crops}</p>
      </div>
    </Link>
  );
}

function RateItem({ c }: { c: RateCard }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-white/5">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-semibold">{c.crop}</p>
        {c.changePct !== null && <span className={`text-xs font-semibold ${c.changePct >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{c.changePct >= 0 ? "▲" : "▼"} {Math.abs(c.changePct).toFixed(1)}%</span>}
      </div>
      <p className="text-lg font-extrabold text-brand-700 dark:text-brand-400">{rs(c.avgPerMaund)}<span className="text-xs font-normal text-slate-500"> /maund avg</span></p>
      <div className="mt-1.5 grid grid-cols-2 gap-2 text-[11px]">
        <div className="rounded-lg bg-emerald-50 px-2 py-1 dark:bg-emerald-500/10"><p className="text-emerald-700 dark:text-emerald-300">Lowest · {rs(c.low.perMaund)}</p><p className="truncate text-slate-500">{c.low.mandi}</p></div>
        <div className="rounded-lg bg-amber-50 px-2 py-1 dark:bg-amber-500/10"><p className="text-amber-700 dark:text-amber-300">Highest · {rs(c.high.perMaund)}</p><p className="truncate text-slate-500">{c.high.mandi}</p></div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Widget                                                              */
/* ------------------------------------------------------------------ */
export function ChatBot({ placement = "public", userCity, endpoint = "/api/assistant", title = "MARKETLINK AGRI-HUB" }: ChatBotProps) {
  const greeting = useCallback(
    (): Msg => ({
      id: "hello",
      role: "bot",
      text: `Assalam-o-Alaikum! 👋 I can help you find trusted sellers, high-quality produce, the best prices${userCity ? ` near ${userCity}` : ""}, and today's mandi rates.`,
      suggestions: STARTERS,
    }),
    [userCity],
  );

  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [hint, setHint] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Restore conversation (per browser tab session)
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMsgs(saved ? (JSON.parse(saved) as Msg[]) : [greeting()]);
    } catch {
      setMsgs([greeting()]);
    }
    if (!localStorage.getItem(HINT_KEY)) {
      const id = setTimeout(() => setHint(true), 4000);
      return () => clearTimeout(id);
    }
  }, [greeting]);

  useEffect(() => {
    if (msgs.length) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(msgs.slice(-40)));
  }, [msgs]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, typing, open]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function toggle() {
    setOpen((v) => !v);
    setHint(false);
    localStorage.setItem(HINT_KEY, "1");
  }

  async function send(raw: string) {
    const text = raw.trim().slice(0, 500);
    if (!text || typing) return;
    setInput("");
    setMsgs((m) => [...m, { id: uid(), role: "user", text }]);
    setTyping(true);
    const started = Date.now();
    let reply: AssistantReply;
    let offline = false;
    try {
      const res = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: text, history: msgs.slice(-8).map((m) => ({ role: m.role === "bot" ? "assistant" : "user", content: m.text })) }) });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Request failed");
      reply = data.data as AssistantReply;
    } catch {
      reply = mockReply(text);
      offline = true;
    }
    // Small natural delay so the typing indicator doesn't flash
    const wait = Math.max(0, 450 - (Date.now() - started));
    await new Promise((r) => setTimeout(r, wait));
    setTyping(false);
    setMsgs((m) => [...m, { id: uid(), role: "bot", text: reply.reply, cards: reply.cards, suggestions: reply.suggestions, link: reply.link, offline }]);
  }

  function reset() {
    sessionStorage.removeItem(STORAGE_KEY);
    setMsgs([greeting()]);
  }

  const bottom = placement === "app" ? "bottom-20 lg:bottom-6" : "bottom-5 sm:bottom-6";
  const lastBot = [...msgs].reverse().find((m) => m.role === "bot");

  return (
    <div dir="ltr">
      {/* Chat window */}
      {open && (
        <section
          role="dialog"
          aria-label={title}
          className={`animate-fade-in fixed right-3 z-[60] flex w-[calc(100vw-1.5rem)] origin-bottom-right flex-col overflow-hidden rounded-3xl border border-slate-200 bg-slate-50 shadow-2xl shadow-brand-950/20 sm:right-6 sm:w-[400px] dark:border-white/10 dark:bg-[#0a1a12] ${
            placement === "app" ? "bottom-36 h-[min(600px,calc(100dvh-10.5rem))] lg:bottom-24 lg:h-[min(640px,calc(100dvh-8rem))]" : "bottom-24 h-[min(640px,calc(100dvh-8rem))]"
          }`}
        >
          <header className="pk-pattern relative flex items-center gap-3 bg-gradient-to-br from-brand-800 to-brand-950 px-4 py-3.5 text-white">
            <Logo variant="mark" size={36} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{title}</p>
              <p className="flex items-center gap-1.5 text-[11px] text-white/70">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Shopping assistant · Online
              </p>
            </div>
            <button onClick={reset} className="rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white" title="New conversation" aria-label="New conversation">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></svg>
            </button>
            <button onClick={() => setOpen(false)} className="rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white" aria-label="Close chat">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
            </button>
          </header>

          <div ref={listRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4" aria-live="polite">
            {msgs.map((m) =>
              m.role === "user" ? (
                <div key={m.id} className="flex justify-end">
                  <p className="max-w-[80%] rounded-2xl rounded-br-md bg-brand-700 px-3.5 py-2 text-sm whitespace-pre-line text-white shadow-sm">{m.text}</p>
                </div>
              ) : (
                <div key={m.id} className="flex gap-2">
                  <span className="mt-0.5 shrink-0"><Logo variant="mark" size={26} /></span>
                  <div className="min-w-0 flex-1 space-y-2">
                    <p className="w-fit max-w-full rounded-2xl rounded-tl-md bg-white px-3.5 py-2 text-sm whitespace-pre-line text-slate-800 shadow-sm ring-1 ring-slate-200/70 dark:bg-white/5 dark:text-slate-100 dark:ring-white/10">
                      {m.text}
                      {m.offline && <span className="mt-1 block text-[10px] text-amber-600">Offline answer</span>}
                    </p>
                    {m.cards && m.cards.length > 0 && (
                      <div className="space-y-2">
                        {m.cards.map((c, i) =>
                          c.kind === "listing" ? <ListingItem key={i} c={c} onNavigate={() => setOpen(false)} />
                          : c.kind === "dealer" ? <DealerItem key={i} c={c} onNavigate={() => setOpen(false)} />
                          : <RateItem key={i} c={c} />,
                        )}
                      </div>
                    )}
                    {m.link && (
                      <Link href={m.link.href} onClick={() => setOpen(false)} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline dark:text-brand-400">
                        {m.link.label} →
                      </Link>
                    )}
                    {m === lastBot && m.suggestions && m.suggestions.length > 0 && !typing && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {m.suggestions.map((s) => (
                          <button
                            key={s}
                            onClick={() => send(s)}
                            className="rounded-full border border-brand-200 bg-white px-3 py-1 text-xs font-medium text-brand-800 transition hover:border-brand-500 hover:bg-brand-50 dark:border-brand-800 dark:bg-transparent dark:text-brand-300 dark:hover:bg-brand-950"
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ),
            )}
            {typing && (
              <div className="flex gap-2">
                <Logo variant="mark" size={26} />
                <span className="flex items-center gap-1 rounded-2xl rounded-tl-md bg-white px-3.5 py-3 shadow-sm ring-1 ring-slate-200/70 dark:bg-white/5 dark:ring-white/10" aria-label="Assistant is typing">
                  {[0, 1, 2].map((i) => <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-600" style={{ animationDelay: `${i * 120}ms` }} />)}
                </span>
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => { e.preventDefault(); send(input); }}
            className="flex items-end gap-2 border-t border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-[#0d1f16]"
          >
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              maxLength={500}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
              placeholder="Ask about crops, sellers or prices…"
              aria-label="Message"
              className="max-h-28 min-h-[40px] flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-white/10 dark:bg-white/5"
            />
            <button type="submit" disabled={!input.trim() || typing} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-700 text-white transition hover:bg-brand-800 disabled:opacity-40" aria-label="Send">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor"><path d="M3.4 20.4 21 12 3.4 3.6 3.4 10l12.6 2-12.6 2z" /></svg>
            </button>
          </form>
        </section>
      )}

      {/* Hint bubble */}
      {hint && !open && (
        <button onClick={toggle} className={`animate-fade-in fixed right-24 z-[60] hidden max-w-[220px] rounded-2xl rounded-br-sm bg-white px-4 py-2.5 text-left text-sm shadow-xl ring-1 ring-slate-200 sm:block dark:bg-[#0d1f16] dark:ring-white/10 ${placement === "app" ? "bottom-24 lg:bottom-9" : "bottom-8"}`}>
          <span className="font-semibold">Need help finding produce?</span>
          <span className="block text-xs text-slate-500">Ask me for top sellers or today&apos;s rates.</span>
        </button>
      )}

      {/* Floating action button */}
      <button
        onClick={toggle}
        aria-label={open ? "Close assistant" : "Open shopping assistant"}
        aria-expanded={open}
        className={`fixed right-4 z-[60] grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-brand-600 to-brand-900 text-white shadow-xl shadow-brand-900/30 ring-4 ring-white transition hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-400 sm:right-6 dark:ring-[#07130d] ${bottom}`}
      >
        {open ? (
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
        ) : (
          <>
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z" />
              <path d="M8.5 11h.01M12 11h.01M15.5 11h.01" strokeWidth="2.8" />
            </svg>
            <span className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-gold-400 ring-2 ring-white dark:ring-[#07130d]" />
          </>
        )}
      </button>
    </div>
  );
}
