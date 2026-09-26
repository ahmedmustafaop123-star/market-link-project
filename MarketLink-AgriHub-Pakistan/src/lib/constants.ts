export type Role = "farmer" | "buyer" | "admin" | "inspector";
export type Category = "grains" | "vegetables" | "fruits" | "cash_crops";
export type Grade = "A" | "B" | "C";
export type DeliveryStage = "confirmed" | "quality_checked" | "dispatched" | "in_transit" | "delivered";
export type PaymentStatus = "awaiting_escrow" | "escrow_locked" | "released" | "refunded" | "disputed";

export const PLATFORM_FEE_RATE = 0.015; // 1.5% commission deducted on escrow release
export const MAUND_KG = 40; // 1 Mann (maund) = 40 kg — standard Pakistani mandi unit
export const CURRENCY = "PKR";

export type Province = "Punjab" | "Sindh" | "Khyber Pakhtunkhwa" | "Balochistan" | "Islamabad (ICT)" | "Gilgit-Baltistan" | "Azad Kashmir";

export const CITIES: Record<string, { lat: number; lng: number; province: Province; urdu: string }> = {
  // Punjab
  Lahore: { lat: 31.5204, lng: 74.3587, province: "Punjab", urdu: "لاہور" },
  Faisalabad: { lat: 31.4504, lng: 73.135, province: "Punjab", urdu: "فیصل آباد" },
  Rawalpindi: { lat: 33.5651, lng: 73.0169, province: "Punjab", urdu: "راولپنڈی" },
  Multan: { lat: 30.1575, lng: 71.5249, province: "Punjab", urdu: "ملتان" },
  Gujranwala: { lat: 32.1877, lng: 74.1945, province: "Punjab", urdu: "گوجرانوالہ" },
  Sialkot: { lat: 32.4945, lng: 74.5229, province: "Punjab", urdu: "سیالکوٹ" },
  Bahawalpur: { lat: 29.3544, lng: 71.6911, province: "Punjab", urdu: "بہاولپور" },
  Sargodha: { lat: 32.074, lng: 72.6861, province: "Punjab", urdu: "سرگودھا" },
  Sahiwal: { lat: 30.6682, lng: 73.1114, province: "Punjab", urdu: "ساہیوال" },
  Okara: { lat: 30.8138, lng: 73.4534, province: "Punjab", urdu: "اوکاڑہ" },
  "Rahim Yar Khan": { lat: 28.4212, lng: 70.2989, province: "Punjab", urdu: "رحیم یار خان" },
  Sheikhupura: { lat: 31.7131, lng: 73.9783, province: "Punjab", urdu: "شیخوپورہ" },
  Kasur: { lat: 31.1187, lng: 74.4507, province: "Punjab", urdu: "قصور" },
  Jhang: { lat: 31.2681, lng: 72.3181, province: "Punjab", urdu: "جھنگ" },
  Vehari: { lat: 30.0452, lng: 72.3489, province: "Punjab", urdu: "وہاڑی" },
  Khanewal: { lat: 30.3017, lng: 71.9321, province: "Punjab", urdu: "خانیوال" },
  "Dera Ghazi Khan": { lat: 30.0459, lng: 70.6403, province: "Punjab", urdu: "ڈیرہ غازی خان" },
  "Toba Tek Singh": { lat: 30.9709, lng: 72.4826, province: "Punjab", urdu: "ٹوبہ ٹیک سنگھ" },
  // Sindh
  Karachi: { lat: 24.8607, lng: 67.0011, province: "Sindh", urdu: "کراچی" },
  Hyderabad: { lat: 25.396, lng: 68.3578, province: "Sindh", urdu: "حیدرآباد" },
  Sukkur: { lat: 27.7052, lng: 68.8574, province: "Sindh", urdu: "سکھر" },
  Larkana: { lat: 27.557, lng: 68.2264, province: "Sindh", urdu: "لاڑکانہ" },
  "Mirpur Khas": { lat: 25.5276, lng: 69.0111, province: "Sindh", urdu: "میرپور خاص" },
  Nawabshah: { lat: 26.2442, lng: 68.41, province: "Sindh", urdu: "نوابشاہ" },
  Umerkot: { lat: 25.3616, lng: 69.7362, province: "Sindh", urdu: "عمرکوٹ" },
  Badin: { lat: 24.656, lng: 68.837, province: "Sindh", urdu: "بدین" },
  // Khyber Pakhtunkhwa
  Peshawar: { lat: 34.0151, lng: 71.5249, province: "Khyber Pakhtunkhwa", urdu: "پشاور" },
  Mardan: { lat: 34.1986, lng: 72.0404, province: "Khyber Pakhtunkhwa", urdu: "مردان" },
  Swat: { lat: 34.7717, lng: 72.36, province: "Khyber Pakhtunkhwa", urdu: "سوات" },
  "Dera Ismail Khan": { lat: 31.8314, lng: 70.9019, province: "Khyber Pakhtunkhwa", urdu: "ڈیرہ اسماعیل خان" },
  Charsadda: { lat: 34.1482, lng: 71.7406, province: "Khyber Pakhtunkhwa", urdu: "چارسدہ" },
  Abbottabad: { lat: 34.1688, lng: 73.2215, province: "Khyber Pakhtunkhwa", urdu: "ایبٹ آباد" },
  // Balochistan
  Quetta: { lat: 30.1798, lng: 66.975, province: "Balochistan", urdu: "کوئٹہ" },
  Turbat: { lat: 26.0023, lng: 63.044, province: "Balochistan", urdu: "تربت" },
  "Dera Murad Jamali": { lat: 28.546, lng: 68.223, province: "Balochistan", urdu: "ڈیرہ مراد جمالی" },
  // Federal / North
  Islamabad: { lat: 33.6844, lng: 73.0479, province: "Islamabad (ICT)", urdu: "اسلام آباد" },
  Gilgit: { lat: 35.9208, lng: 74.308, province: "Gilgit-Baltistan", urdu: "گلگت" },
  Mirpur: { lat: 33.1484, lng: 73.7518, province: "Azad Kashmir", urdu: "میرپور" },
};
export const CITY_NAMES = Object.keys(CITIES);
export const PROVINCES: Province[] = ["Punjab", "Sindh", "Khyber Pakhtunkhwa", "Balochistan", "Islamabad (ICT)", "Gilgit-Baltistan", "Azad Kashmir"];

/** Wholesale mandis (market key = city) with their real market names. */
export const MANDIS: { key: string; name: string; urdu: string }[] = [
  { key: "Lahore", name: "Badami Bagh Mandi, Lahore", urdu: "بادامی باغ منڈی" },
  { key: "Karachi", name: "Sabzi Mandi Super Highway, Karachi", urdu: "سبزی منڈی کراچی" },
  { key: "Multan", name: "Ghalla Mandi, Multan", urdu: "غلہ منڈی ملتان" },
  { key: "Faisalabad", name: "Grain Market, Faisalabad", urdu: "غلہ منڈی فیصل آباد" },
  { key: "Islamabad", name: "I-11 Sabzi Mandi, Islamabad", urdu: "آئی الیون منڈی" },
  { key: "Hyderabad", name: "Sabzi Mandi, Hyderabad", urdu: "سبزی منڈی حیدرآباد" },
  { key: "Peshawar", name: "Ghalla Mandi, Peshawar", urdu: "غلہ منڈی پشاور" },
  { key: "Quetta", name: "Fruit Mandi, Quetta", urdu: "فروٹ منڈی کوئٹہ" },
  { key: "Sukkur", name: "Grain Market, Sukkur", urdu: "غلہ منڈی سکھر" },
  { key: "Gujranwala", name: "Rice Market, Gujranwala", urdu: "چاول منڈی گوجرانوالہ" },
];
export const MANDI_MARKETS = MANDIS.map((m) => m.key);
export const mandiName = (key: string) => MANDIS.find((m) => m.key === key)?.name ?? key;

export const CATEGORIES: { value: Category; label: string; urdu: string; emoji: string }[] = [
  { value: "grains", label: "Grains & Pulses", urdu: "اناج", emoji: "🌾" },
  { value: "vegetables", label: "Vegetables", urdu: "سبزیاں", emoji: "🧅" },
  { value: "fruits", label: "Fruits", urdu: "پھل", emoji: "🥭" },
  { value: "cash_crops", label: "Cotton / Sugarcane", urdu: "نقد فصلیں", emoji: "🌿" },
];

const px = (id: number) => `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200`;

/** Base prices are PKR per kg, calibrated to typical Pakistani mandi rates. */
export const CROP_CATALOGUE: { name: string; urdu: string; category: Category; mandiBase: number; image: string }[] = [
  { name: "Wheat", urdu: "گندم", category: "grains", mandiBase: 95, image: px(38129076) },
  { name: "Basmati Rice", urdu: "باسمتی چاول", category: "grains", mandiBase: 290, image: px(7421207) },
  { name: "Maize", urdu: "مکئی", category: "grains", mandiBase: 70, image: px(8108170) },
  { name: "Chickpea (Chana)", urdu: "چنا", category: "grains", mandiBase: 240, image: px(10111952) },
  { name: "Tomato", urdu: "ٹماٹر", category: "vegetables", mandiBase: 120, image: px(37408649) },
  { name: "Potato", urdu: "آلو", category: "vegetables", mandiBase: 55, image: px(37091858) },
  { name: "Onion", urdu: "پیاز", category: "vegetables", mandiBase: 110, image: px(37091856) },
  { name: "Mango (Chaunsa)", urdu: "آم چونسا", category: "fruits", mandiBase: 180, image: px(30893290) },
  { name: "Kinnow", urdu: "کینو", category: "fruits", mandiBase: 90, image: px(14766928) },
  { name: "Dates (Khajoor)", urdu: "کھجور", category: "fruits", mandiBase: 260, image: px(17877978) },
  { name: "Cotton (Phutti)", urdu: "کپاس", category: "cash_crops", mandiBase: 210, image: px(5640079) },
  { name: "Sugarcane", urdu: "گنا", category: "cash_crops", mandiBase: 11, image: px(9622985) },
  { name: "Red Chilli (Kunri)", urdu: "لال مرچ", category: "cash_crops", mandiBase: 480, image: px(6902055) },
];

export const FALLBACK_IMAGE: Record<Category, string> = {
  grains: CROP_CATALOGUE[0].image,
  vegetables: CROP_CATALOGUE[5].image,
  fruits: CROP_CATALOGUE[7].image,
  cash_crops: CROP_CATALOGUE[10].image,
};

export function cropImage(images: string[] | null | undefined, cropName: string, category: Category) {
  if (images && images.length > 0) return images[0];
  const c = CROP_CATALOGUE.find((x) => x.name.toLowerCase() === cropName.toLowerCase());
  return c?.image ?? FALLBACK_IMAGE[category];
}

export const cropUrdu = (name: string) => CROP_CATALOGUE.find((c) => c.name === name)?.urdu ?? "";

export const DELIVERY_STAGES: { key: DeliveryStage; label: string; short: string; actor: Role }[] = [
  { key: "confirmed", label: "Order Placed", short: "Placed", actor: "farmer" },
  { key: "quality_checked", label: "Quality Inspected", short: "Inspected", actor: "admin" },
  { key: "dispatched", label: "Dispatched", short: "Dispatched", actor: "farmer" },
  { key: "in_transit", label: "In Transit", short: "Transit", actor: "farmer" },
  { key: "delivered", label: "Delivered", short: "Delivered", actor: "buyer" },
];

export function stageIndex(stage: DeliveryStage) {
  return DELIVERY_STAGES.findIndex((s) => s.key === stage);
}

export function nextStage(stage: DeliveryStage): DeliveryStage | null {
  const i = stageIndex(stage);
  return i >= 0 && i < DELIVERY_STAGES.length - 1 ? DELIVERY_STAGES[i + 1].key : null;
}

export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** PKR with Pakistani thousands grouping, e.g. "Rs. 1,250,000". */
export function formatPKR(n: number | null | undefined, digits = 0) {
  const v = Number(n ?? 0);
  return "Rs. " + v.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** Compact PKR in Lakh / Crore (common in Pakistan), e.g. "Rs. 12.5 Lakh", "Rs. 1.78 Crore". */
export function formatPKRShort(n: number | null | undefined) {
  const v = Number(n ?? 0);
  if (Math.abs(v) >= 1e7) return `Rs. ${(v / 1e7).toFixed(2)} Crore`;
  if (Math.abs(v) >= 1e5) return `Rs. ${(v / 1e5).toFixed(1)} Lakh`;
  return formatPKR(v);
}

/** Price per maund (40 kg) — the unit Pakistani farmers and arhtis quote. */
export function perMaund(perKg: number | null | undefined) {
  return formatPKR(Number(perKg ?? 0) * MAUND_KG) + "/maund";
}

export function formatKg(n: number | null | undefined) {
  const v = Number(n ?? 0);
  if (v >= 1000) return (v / 1000).toLocaleString("en-US", { maximumFractionDigits: 2 }) + " ton";
  return v.toLocaleString("en-US", { maximumFractionDigits: 0 }) + " kg";
}

export function formatMaunds(n: number | null | undefined) {
  return Math.round(Number(n ?? 0) / MAUND_KG).toLocaleString("en-US") + " maund";
}

export function formatDate(d: string | Date | null | undefined) {
  if (!d) return "—";
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Karachi" });
}

export function todayISO(offsetDays = 0) {
  const d = new Date(Date.now() + 5 * 3600 * 1000); // Pakistan Standard Time (UTC+5)
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

export const categoryLabel = (c: string) => CATEGORIES.find((x) => x.value === c)?.label ?? c;

/** Human-readable status labels used by <Badge>. */
export const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  accepted: "Accepted",
  rejected: "Rejected",
  countered: "Countered",
  withdrawn: "Withdrawn",
  active: "Active",
  pending_inspection: "Pending inspection",
  sold_out: "Sold out",
  archived: "Archived",
  awaiting_escrow: "Awaiting escrow",
  escrow_locked: "In escrow",
  released: "Paid out",
  refunded: "Refunded",
  disputed: "Disputed",
  passed: "Passed",
  failed: "Failed",
  open: "Open",
  investigating: "Investigating",
  resolved_release: "Resolved · paid",
  resolved_refund: "Resolved · refunded",
  confirmed: "Placed",
  quality_checked: "Inspected",
  dispatched: "Dispatched",
  in_transit: "In transit",
  delivered: "Delivered",
};

export const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  accepted: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
  rejected: "bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300",
  countered: "bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300",
  withdrawn: "bg-slate-200 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300",
  active: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
  pending_inspection: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  sold_out: "bg-slate-200 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300",
  archived: "bg-slate-200 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300",
  awaiting_escrow: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  escrow_locked: "bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300",
  released: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
  refunded: "bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-300",
  disputed: "bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300",
  passed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
  failed: "bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300",
  open: "bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300",
  investigating: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  resolved_release: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
  resolved_refund: "bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-300",
  confirmed: "bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300",
  quality_checked: "bg-teal-100 text-teal-800 dark:bg-teal-500/15 dark:text-teal-300",
  dispatched: "bg-indigo-100 text-indigo-800 dark:bg-indigo-500/15 dark:text-indigo-300",
  in_transit: "bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300",
  delivered: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
};
