import { ApiError, handle, readJson, str } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { llmReply, type ChatTurn } from "@/lib/llm";
import { answer } from "@/lib/services/assistant";
import { latestRates } from "@/lib/services/mandi";

export const dynamic = "force-dynamic";

const hits = new Map<string, number[]>();
function limited(key: string) {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > 30;
}

/**
 * POST /api/assistant { message, history? } → { reply, cards?, suggestions?, link?, engine }
 * 1) Rule engine retrieves live DB results (listings / dealers / rates / FAQ) → cards
 * 2) If OPENAI_API_KEY or GEMINI_API_KEY is set, the LLM writes the reply grounded in those results
 *    (bilingual English / Roman Urdu); otherwise the rule-engine reply is returned.
 */
export async function POST(req: Request) {
  return handle(async () => {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
    if (limited(ip)) throw new ApiError(429, "Too many messages. Please wait a moment.");
    const body = await readJson(req);
    const message = str(body, "message", { required: true, max: 500 })!;
    const history: ChatTurn[] = Array.isArray(body.history)
      ? (body.history as { role?: string; content?: string }[])
          .filter((t) => (t.role === "user" || t.role === "assistant") && typeof t.content === "string")
          .slice(-6)
          .map((t) => ({ role: t.role as "user" | "assistant", content: String(t.content).slice(0, 600) }))
      : [];
    const user = await getCurrentUser();
    const base = await answer(message, { isBuyer: user?.role === "buyer", city: user?.city });

    const rates = await latestRates().catch(() => []);
    const snapshot = Object.values(
      rates.reduce<Record<string, { crop: string; avgPerMaund: number; n: number }>>((acc, r) => {
        const a = (acc[r.cropName] ??= { crop: r.cropName, avgPerMaund: 0, n: 0 });
        a.avgPerMaund += r.avgPricePerKg * 40;
        a.n += 1;
        return acc;
      }, {}),
    ).map((a) => ({ crop: a.crop, avgPerMaund: Math.round(a.avgPerMaund / a.n) }));

    const llm = await llmReply(message, { userCity: user?.city ?? null, signedInAs: user?.role ?? "visitor", draftAnswer: base.reply, cards: base.cards ?? [], mandiSnapshot: snapshot }, history);
    return { ...base, reply: llm?.text ?? base.reply, engine: llm?.engine ?? "rules" };
  });
}
