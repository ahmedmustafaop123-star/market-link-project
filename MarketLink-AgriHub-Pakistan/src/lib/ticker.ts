import { latestRates } from "@/lib/services/mandi";
import { cropUrdu } from "@/lib/constants";
import type { TickerItem } from "@/components/mandi-ticker";

/** Per-crop national average of the latest mandi rates with average day change. */
export async function getTicker(): Promise<TickerItem[]> {
  try {
    const rows = await latestRates();
    const acc = new Map<string, { s: number; n: number; c: number; cn: number }>();
    for (const r of rows) {
      const a = acc.get(r.cropName) ?? { s: 0, n: 0, c: 0, cn: 0 };
      a.s += r.avgPricePerKg;
      a.n += 1;
      if (r.changePct !== null) {
        a.c += r.changePct;
        a.cn += 1;
      }
      acc.set(r.cropName, a);
    }
    return [...acc.entries()].map(([crop, a]) => ({ crop, urdu: cropUrdu(crop), avg: a.s / a.n, change: a.cn ? a.c / a.cn : null }));
  } catch {
    return [];
  }
}
