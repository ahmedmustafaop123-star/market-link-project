import { sql } from "drizzle-orm";
import { db } from "@/db";
import { listCrops } from "@/lib/services/crops";
import { latestRates } from "@/lib/services/mandi";
import { CATEGORIES, CITY_NAMES, CROP_CATALOGUE, MAUND_KG, categoryLabel, cropImage, mandiName, type Category, type Grade } from "@/lib/constants";

/* ------------------------------------------------------------------ */
/* Types shared with the ChatBot widget                                */
/* ------------------------------------------------------------------ */
export type ListingCard = {
  kind: "listing";
  id: number;
  title: string;
  image: string;
  pricePerKg: number;
  pricePerMaund: number;
  grade: Grade;
  inspected: boolean;
  seller: string;
  verified: boolean;
  location: string;
  distanceKm: number | null;
  availableKg: number;
  href: string;
};
export type DealerCard = {
  kind: "dealer";
  id: number;
  name: string;
  business: string | null;
  city: string;
  rating: number;
  deliveries: number;
  crops: string;
  verified: boolean;
  href: string;
};
export type RateCard = {
  kind: "rate";
  crop: string;
  avgPerMaund: number;
  low: { mandi: string; perMaund: number };
  high: { mandi: string; perMaund: number };
  changePct: number | null;
};
export type AssistantCard = ListingCard | DealerCard | RateCard;
export type AssistantReply = { reply: string; cards?: AssistantCard[]; suggestions?: string[]; link?: { label: string; href: string } };

/* ------------------------------------------------------------------ */
/* Entity extraction (English + common Roman Urdu terms)               */
/* ------------------------------------------------------------------ */
const CROP_ALIASES: Record<string, string> = {
  wheat: "Wheat", gandum: "Wheat", gehun: "Wheat",
  rice: "Basmati Rice", basmati: "Basmati Rice", chawal: "Basmati Rice",
  maize: "Maize", corn: "Maize", makai: "Maize", makki: "Maize",
  chickpea: "Chickpea (Chana)", chana: "Chickpea (Chana)", gram: "Chickpea (Chana)",
  tomato: "Tomato", tamatar: "Tomato",
  potato: "Potato", aloo: "Potato", aalu: "Potato",
  onion: "Onion", pyaz: "Onion", piyaz: "Onion",
  mango: "Mango (Chaunsa)", aam: "Mango (Chaunsa)", chaunsa: "Mango (Chaunsa)", sindhri: "Mango (Chaunsa)",
  kinnow: "Kinnow", kinno: "Kinnow", orange: "Kinnow", santra: "Kinnow",
  dates: "Dates (Khajoor)", date: "Dates (Khajoor)", khajoor: "Dates (Khajoor)", khajur: "Dates (Khajoor)",
  cotton: "Cotton (Phutti)", kapas: "Cotton (Phutti)", phutti: "Cotton (Phutti)",
  sugarcane: "Sugarcane", ganna: "Sugarcane", cane: "Sugarcane",
  chilli: "Red Chilli (Kunri)", chili: "Red Chilli (Kunri)", mirch: "Red Chilli (Kunri)",
};
const CATEGORY_ALIASES: Record<string, Category> = {
  grain: "grains", grains: "grains", pulses: "grains", anaaj: "grains", cereal: "grains",
  vegetable: "vegetables", vegetables: "vegetables", veggies: "vegetables", sabzi: "vegetables", sabziyan: "vegetables",
  fruit: "fruits", fruits: "fruits", phal: "fruits",
  "cash crop": "cash_crops", "cash crops": "cash_crops", fibre: "cash_crops", fiber: "cash_crops",
};

/** Whole-word match; a trailing "*" allows prefix matching (e.g. "negotiat*"). */
const has = (text: string, words: string[]) =>
  words.some((w) => new RegExp(w.endsWith("*") ? `\\b${w.slice(0, -1)}` : `\\b${w}\\b`, "i").test(text));

function extract(message: string) {
  const text = ` ${message.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, " ")} `;
  let crop: string | undefined;
  for (const [alias, name] of Object.entries(CROP_ALIASES)) if (new RegExp(`\\b${alias}\\b`).test(text)) { crop = name; break; }
  let category: Category | undefined;
  for (const [alias, cat] of Object.entries(CATEGORY_ALIASES)) if (new RegExp(`\\b${alias}\\b`).test(text)) { category = cat; break; }
  if (!category && crop) category = CROP_CATALOGUE.find((c) => c.name === crop)?.category;
  const city = CITY_NAMES.find((c) => new RegExp(`\\b${c.toLowerCase()}\\b`).test(text));
  const gradeMatch = text.match(/\bgrade\s*([abc])\b/);
  const quality = has(text, ["high quality", "high-quality", "best quality", "top quality", "premium", "export", "grade a", "a grade", "behtareen", "acha", "achha", "best"]);
  const grade: Grade | undefined = gradeMatch ? (gradeMatch[1].toUpperCase() as Grade) : quality ? "A" : undefined;
  return { text, crop, category, city, grade, quality };
}

/* ------------------------------------------------------------------ */
/* Data helpers                                                        */
/* ------------------------------------------------------------------ */
const marketHref = (p: Record<string, string | number | undefined>, isBuyer: boolean) => {
  const qs = new URLSearchParams(Object.entries(p).filter(([, v]) => v !== undefined && v !== "").map(([k, v]) => [k, String(v)]));
  return `/marketplace${qs.toString() ? `?${qs}` : ""}`;
};

async function findListings(
  f: { crop?: string; category?: Category; grade?: Grade; city?: string; sort?: "price_asc" | "distance" | "quality" },
  isBuyer: boolean,
  limit = 4,
): Promise<ListingCard[]> {
  const rows = await listCrops({
    q: f.crop,
    category: f.crop ? undefined : f.category,
    grade: f.grade,
    originCity: f.city,
    sort: f.sort === "price_asc" ? "price_asc" : f.sort === "distance" ? "distance" : "newest",
  });
  const ranked = f.sort === "quality" || (!f.sort && f.grade)
    ? [...rows].sort((a, b) => Number(!!b.inspectionGrade) - Number(!!a.inspectionGrade) || Number(b.farmerVerified) - Number(a.farmerVerified) || a.qualityGrade.localeCompare(b.qualityGrade))
    : rows;
  return ranked.slice(0, limit).map((c) => ({
    kind: "listing",
    id: c.cropId,
    title: c.cropName,
    image: cropImage(c.imagesJson, c.cropName, c.category),
    pricePerKg: c.basePricePerKg,
    pricePerMaund: Math.round(c.basePricePerKg * MAUND_KG),
    grade: c.qualityGrade,
    inspected: !!c.inspectionGrade,
    seller: c.farmName ?? c.farmerName,
    verified: c.farmerVerified,
    location: c.farmLocation,
    distanceKm: c.distanceKm,
    availableKg: c.totalQuantityKg,
    href: `/crop/${c.cropId}`,
  }));
}

/**
 * Seller rating (1–5) derived from real platform signals:
 * delivered orders, verification, passed inspections, dispute rate.
 */
async function topDealers(f: { crop?: string; category?: Category; city?: string }, isBuyer: boolean, limit = 4): Promise<DealerCard[]> {
  const res = await db.execute(sql`
    select u.id, u.full_name, u.business_name, u.city, u.is_verified, u.trust_score as trust, u.rating_count as reviews,
      (select count(*) from orders_logistics o where o.farmer_id = u.id and o.payment_status = 'released')::int as delivered,
      (select count(*) from disputes d join orders_logistics o on o.order_id = d.order_id where o.farmer_id = u.id)::int as disputes,
      (select count(*) from quality_inspections qi join crops_inventory c on c.crop_id = qi.crop_id where c.farmer_id = u.id and qi.status = 'passed')::int as passed,
      (select string_agg(distinct c.crop_name, ', ') from crops_inventory c where c.farmer_id = u.id and c.status = 'active') as crops
    from users u
    where u.role = 'farmer'
      ${f.crop ? sql`and exists (select 1 from crops_inventory c where c.farmer_id = u.id and c.status = 'active' and c.crop_name = ${f.crop})` : sql``}
      ${!f.crop && f.category ? sql`and exists (select 1 from crops_inventory c where c.farmer_id = u.id and c.status = 'active' and c.category = ${f.category})` : sql``}
  `);
  const dealers = (res.rows as { trust: number; reviews: number; id: number; full_name: string; business_name: string | null; city: string; is_verified: boolean; delivered: number; disputes: number; passed: number; crops: string | null }[])
    .filter((d) => d.crops)
    .map((d) => {
      const delivered = Number(d.delivered);
      const disputeRate = delivered ? Number(d.disputes) / delivered : 0;
      const score = Number(d.trust) > 0 ? Number(d.trust) : 3.4 + Math.min(1, delivered / 10) + (d.is_verified ? 0.3 : 0) + Math.min(0.3, Number(d.passed) * 0.1) - disputeRate * 1.5;
      return {
        kind: "dealer" as const,
        id: Number(d.id),
        name: d.full_name,
        business: d.business_name,
        city: d.city,
        rating: Math.round(Math.max(1, Math.min(5, score)) * 10) / 10,
        deliveries: delivered,
        crops: d.crops ?? "",
        verified: d.is_verified,
        href: marketHref({ farmerId: d.id }, isBuyer),
      };
    });
  if (f.city) dealers.sort((a, b) => Number(b.city === f.city) - Number(a.city === f.city));
  return dealers.sort((a, b) => (f.city ? Number(b.city === f.city) - Number(a.city === f.city) : 0) || b.rating - a.rating || b.deliveries - a.deliveries).slice(0, limit);
}

async function rateCard(crop: string): Promise<RateCard | null> {
  const rates = await latestRates({ crop });
  if (!rates.length) return null;
  const sorted = [...rates].sort((a, b) => a.avgPricePerKg - b.avgPricePerKg);
  const avg = rates.reduce((s, r) => s + r.avgPricePerKg, 0) / rates.length;
  const changes = rates.map((r) => r.changePct).filter((c): c is number => c !== null);
  return {
    kind: "rate",
    crop,
    avgPerMaund: Math.round(avg * MAUND_KG),
    low: { mandi: mandiName(sorted[0].marketLocation), perMaund: Math.round(sorted[0].avgPricePerKg * MAUND_KG) },
    high: { mandi: mandiName(sorted[sorted.length - 1].marketLocation), perMaund: Math.round(sorted[sorted.length - 1].avgPricePerKg * MAUND_KG) },
    changePct: changes.length ? Math.round((changes.reduce((a, b) => a + b, 0) / changes.length) * 100) / 100 : null,
  };
}

/* ------------------------------------------------------------------ */
/* Intent routing                                                      */
/* ------------------------------------------------------------------ */
export const DEFAULT_SUGGESTIONS = ["Top-rated dealers", "High-quality fruits", "Cheapest wheat", "Mango mandi rate", "How does escrow work?"];

export async function answer(message: string, ctx: { isBuyer: boolean; city?: string }): Promise<AssistantReply> {
  const e = extract(message);
  const t = e.text;
  const place = e.city ?? ctx.city;
  const what = e.crop ?? (e.category ? categoryLabel(e.category).toLowerCase() : "produce");

  // Greetings / help
  if (has(t, ["hi", "hello", "hey", "salam", "assalam", "aoa", "help", "start"]) && !e.crop && !e.category && t.trim().split(/\s+/).length <= 4) {
    return {
      reply: "Assalam-o-Alaikum! I can find trusted sellers, high-quality produce, the best prices, and today's mandi rates. What are you looking for?",
      suggestions: DEFAULT_SUGGESTIONS,
    };
  }

  // FAQ: escrow / payment
  if (has(t, ["escrow", "payment", "pay", "wallet", "refund", "safe", "paisa", "paise"])) {
    return {
      reply:
        "Payments are protected by escrow:\n1. When a farmer accepts your bid, you lock the order amount from your wallet.\n2. The crop is inspected, dispatched and tracked.\n3. You confirm delivery, and only then is the farmer paid (a flat 1.5% fee is deducted from the farmer).\nIf something is wrong, raise a dispute and the funds stay frozen until an admin resolves it.",
      suggestions: ["How do I place a bid?", "Track my order", "Top-rated dealers"],
      link: ctx.isBuyer ? { label: "Open wallet", href: "/wallet" } : undefined,
    };
  }
  // FAQ: bidding
  if (has(t, ["bid", "offer", "negotiat*", "counter", "rfq", "bargain", "boli"])) {
    return {
      reply:
        "To buy in bulk: open a listing, tap Place Bid, and enter your price per kg, quantity and delivery date. The farmer can accept, reject or counter. You can then accept the counter-offer or revise your price. Accepted bids become orders automatically.",
      suggestions: ["High-quality grains", "Cheapest onion", "How does escrow work?"],
      link: ctx.isBuyer ? { label: "My bids", href: "/buyer/bids" } : { label: "Create buyer account", href: "/login?role=buyer" },
    };
  }
  // FAQ: tracking
  if (has(t, ["track", "delivery", "shipment", "truck", "where is my", "status", "order"])) {
    return {
      reply: "Every order moves through 5 stages: Placed → Quality Inspected → Dispatched → In Transit → Delivered. You can see live checkpoints and the full history on your orders page.",
      suggestions: ["How does escrow work?", "Top-rated dealers"],
      link: ctx.isBuyer ? { label: "Track orders", href: "/buyer/orders" } : { label: "Sign in", href: "/login" },
    };
  }

  // Dealers / sellers
  if (has(t, ["dealer", "dealers", "seller", "sellers", "supplier", "suppliers", "farmer", "farmers", "vendor", "trusted", "reliable", "top rated", "top-rated", "rated", "kisan", "beopari"])) {
    const cards = await topDealers({ crop: e.crop, category: e.category, city: e.city }, ctx.isBuyer);
    if (!cards.length) return { reply: `No active sellers found for ${what} right now. Try another crop or category.`, suggestions: DEFAULT_SUGGESTIONS };
    return {
      reply: `Top-rated sellers${e.crop || e.category ? ` for ${what}` : ""}${e.city ? ` (${e.city} first)` : ""}. Trust scores combine verified buyer reviews, completed deliveries, identity verification and dispute history:`,
      cards,
      suggestions: [e.crop ? `High-quality ${e.crop.split(" ")[0].toLowerCase()}` : "High-quality vegetables", "Cheapest wheat", "How does escrow work?"],
    };
  }

  // Mandi rates
  if (has(t, ["rate", "rates", "mandi", "bhav", "bhao", "market price", "price today", "qeemat", "kya chal"])) {
    const crops = e.crop ? [e.crop] : e.category ? CROP_CATALOGUE.filter((c) => c.category === e.category).map((c) => c.name) : ["Wheat", "Basmati Rice", "Mango (Chaunsa)"];
    const cards = (await Promise.all(crops.slice(0, 3).map(rateCard))).filter((c): c is RateCard => !!c);
    if (!cards.length) return { reply: `I couldn't find mandi rates for ${what} yet.`, suggestions: DEFAULT_SUGGESTIONS };
    return {
      reply: `Today's mandi rates per maund (40 kg)${e.crop ? ` for ${e.crop}` : ""}. The lowest mandi is usually the best place to source:`,
      cards,
      suggestions: e.crop ? [`Cheapest ${e.crop.split(" ")[0].toLowerCase()} listings`, `High-quality ${e.crop.split(" ")[0].toLowerCase()}`, `Top ${e.crop.split(" ")[0].toLowerCase()} dealers`] : DEFAULT_SUGGESTIONS,
      link: { label: "All mandi rates", href: "/mandi-rates" },
    };
  }

  // Listings: cheapest / nearby / quality / generic crop or category
  const cheap = has(t, ["cheap", "cheapest", "lowest", "low price", "budget", "affordable", "sasta", "sasti", "kam qeemat"]);
  const near = has(t, ["near", "nearby", "nearest", "close to", "around", "qareeb", "paas"]) || (!!e.city && !cheap);
  const quality = !!e.grade || e.quality;
  if (cheap || near || quality || e.crop || e.category || has(t, ["buy", "find", "show", "list", "available", "stock", "khareed"])) {
    const sort = cheap ? "price_asc" : near ? "distance" : quality ? "quality" : undefined;
    let cards = await findListings({ crop: e.crop, category: e.category, grade: e.grade, city: near || cheap ? place : undefined, sort }, ctx.isBuyer);
    let relaxed = false;
    if (!cards.length && e.grade) {
      cards = await findListings({ crop: e.crop, category: e.category, city: place, sort: "quality" }, ctx.isBuyer);
      relaxed = cards.length > 0;
    }
    if (!cards.length) {
      return { reply: `There are no active listings for ${what} right now. I can show you similar produce or today's mandi rates instead.`, suggestions: DEFAULT_SUGGESTIONS };
    }
    const intro = relaxed
      ? `No Grade ${e.grade} ${what} is listed right now. Here are the best available options:`
      : cheap ? `Lowest-priced ${what}${place ? ` (distance from ${place})` : ""}:`
      : quality ? `Highest-quality ${what}. Grade ${e.grade ?? "A"} and inspected listings come first:`
      : near && place ? `${what[0].toUpperCase() + what.slice(1)} closest to ${place}:`
      : `Here's what's available for ${what}:`;
    return {
      reply: intro,
      cards,
      suggestions: [
        e.crop ? `${e.crop.split(" ")[0]} mandi rate` : "Mandi rates today",
        e.crop ? `Top ${e.crop.split(" ")[0].toLowerCase()} dealers` : "Top-rated dealers",
        cheap ? `High-quality ${e.crop?.split(" ")[0].toLowerCase() ?? "produce"}` : `Cheapest ${e.crop?.split(" ")[0].toLowerCase() ?? "vegetables"}`,
      ],
      link: { label: "Open marketplace", href: marketHref({ q: e.crop, category: e.crop ? undefined : e.category, grade: e.grade, sort: cheap ? "price_asc" : undefined }, ctx.isBuyer) },
    };
  }

  // Fallback
  return {
    reply: `I'm not sure I understood. Try asking about a crop (e.g. "Grade A basmati"), a category (${CATEGORIES.map((c) => c.label.toLowerCase()).join(", ")}), sellers, or mandi rates.`,
    suggestions: DEFAULT_SUGGESTIONS,
  };
}
