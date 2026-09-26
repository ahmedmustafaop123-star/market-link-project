/**
 * LLM connector for the shopping assistant.
 *  • OPENAI_API_KEY  → OpenAI Chat Completions (OPENAI_MODEL, default gpt-4o-mini)
 *  • GEMINI_API_KEY  → Google Gemini generateContent (GEMINI_MODEL, default gemini-1.5-flash)
 * Returns null when no key is configured or the call fails, so callers can fall back to the rule engine.
 */
export type ChatTurn = { role: "user" | "assistant"; content: string };
export type LlmEngine = "openai" | "gemini";

export const llmEngine = (): LlmEngine | null => (process.env.OPENAI_API_KEY ? "openai" : process.env.GEMINI_API_KEY ? "gemini" : null);

const SYSTEM = `You are "MarketLink Assistant", the shopping assistant of MarketLink Agri-Hub, a Pakistani B2B agricultural marketplace connecting farmers with wholesalers, supermarkets, exporters and food processors.
Rules:
- Reply in the user's language: English, or Roman Urdu if the user writes in Roman Urdu (e.g. "gandum ka rate kya hai"). Never reply in Urdu script unless the user uses it.
- Use ONLY the facts in the CONTEXT JSON (live database results). Never invent sellers, prices, ratings or stock. If the context has no data, say so and suggest a related query.
- Prices are in Pakistani Rupees (Rs.), per kg and per maund (40 kg). Mention the seller's trust score/rating when relevant.
- Be concise: 1–4 short sentences, or a short list. The UI already shows result cards from CONTEXT.cards, so summarise and compare rather than repeating every field.
- Platform facts: payments are held in escrow and released to the farmer only after the buyer confirms delivery (1.5% fee from the farmer); bids can be countered; orders go Placed → Quality Inspected → Dispatched → In Transit → Delivered; disputes freeze escrow until an admin resolves them.`;

async function withTimeout<T>(p: Promise<T>, ms: number) {
  return Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error("LLM timeout")), ms))]);
}

export async function llmReply(message: string, context: unknown, history: ChatTurn[] = []): Promise<{ text: string; engine: LlmEngine } | null> {
  const engine = llmEngine();
  if (!engine) return null;
  const ctx = `CONTEXT (live marketplace data, JSON):\n${JSON.stringify(context).slice(0, 12000)}`;
  const turns = history.slice(-6);
  try {
    if (engine === "openai") {
      const res = await withTimeout(
        fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: process.env.OPENAI_MODEL || "gpt-4o-mini",
            temperature: 0.3,
            max_tokens: 350,
            messages: [{ role: "system", content: SYSTEM }, { role: "system", content: ctx }, ...turns, { role: "user", content: message }],
          }),
        }),
        15000,
      );
      if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const text = data.choices?.[0]?.message?.content?.trim();
      return text ? { text, engine } : null;
    }
    const model = process.env.GEMINI_MODEL || "gemini-1.5-flash";
    const res = await withTimeout(
      fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: `${SYSTEM}\n\n${ctx}` }] },
          contents: [...turns.map((t) => ({ role: t.role === "assistant" ? "model" : "user", parts: [{ text: t.content }] })), { role: "user", parts: [{ text: message }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 350 },
        }),
      }),
      15000,
    );
    if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim();
    return text ? { text, engine } : null;
  } catch (e) {
    console.error("[llm]", (e as Error).message);
    return null;
  }
}
