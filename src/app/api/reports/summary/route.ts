import { requireUser } from "@/lib/auth";
import { fail } from "@/lib/api";
import { adminStats, farmerStats } from "@/lib/services/analytics";
import { formatPKR } from "@/lib/constants";

export const dynamic = "force-dynamic";

type Cell = string | number | null | undefined;

/** Escape CSV values and prevent spreadsheet formula execution in free-text fields. */
function csvCell(value: Cell) {
  let text = String(value ?? "").replace(/[\r\n]+/g, " ");
  if (/^[=+@\t]/.test(text) || /^-(?!\d)/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

const toCsv = (rows: Cell[][]) => "\uFEFF" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";

/** GET /api/reports/summary — downloads a live, role-scoped CSV summary for admin or farmer. */
export async function GET() {
  try {
    const user = await requireUser(["farmer", "admin"]);
    const date = new Date().toLocaleString("en-GB", { timeZone: "Asia/Karachi", dateStyle: "medium", timeStyle: "short" });
    const rows: Cell[][] = [
      ["MARKETLINK AGRI-HUB", user.role === "admin" ? "Platform summary" : "Farmer sales summary"],
      ["Generated (PKT)", date],
      ["Prepared for", user.fullName],
      [],
      ["Metric", "Value"],
    ];

    if (user.role === "admin") {
      const report = await adminStats();
      rows.push(
        ["Transaction volume", formatPKR(report.totalVolume)],
        ["Orders", report.totalOrders],
        ["Active bids", report.activeBids],
        ["Shipments in progress", report.activeShipments],
        ["Held in escrow", formatPKR(report.escrowHeld)],
        ["Open disputes", report.openDisputes],
        ["Active farmers", report.farmers],
        ["Buyers", report.buyers],
        ["Platform fees", formatPKR(report.platformFees)],
        [],
        ["Month", "Transaction volume (PKR)", "Orders"],
        ...report.monthly.map((m) => [m.month, m.volume, m.orders]),
        [],
        ["Region", "Transaction volume (PKR)", "Orders"],
        ...report.topRegions.map((r) => [r.region, r.volume, r.orders]),
      );
    } else {
      const report = await farmerStats(user.id);
      rows.push(
        ["Active listings", report.activeListings],
        ["Available inventory (kg)", report.inventoryKg],
        ["Inventory value", formatPKR(report.inventoryValue)],
        ["New bids to review", report.pendingBids],
        ["Counter-offers awaiting buyer", report.counteredBids],
        ["Active orders", report.activeOrders],
        ["Funds in escrow", formatPKR(report.inEscrow)],
        ["Total payout earnings", formatPKR(report.totalEarned)],
        ["Earnings this month", formatPKR(report.earnedThisMonth)],
        ["Verified buyer reviews", user.ratingCount],
        ["Trust score (out of 5)", user.trustScore],
        [],
        ["Month", "Sales volume (PKR)", "Orders"],
        ...report.monthly.map((m) => [m.month, m.volume, m.orders]),
        [],
        ["Crop", "Sales volume (PKR)"],
        ...report.byCrop.map((crop) => [crop.name, crop.value]),
      );
    }

    const filename = `marketlink-${user.role}-summary-${new Date().toISOString().slice(0, 10)}.csv`;
    return new Response(toCsv(rows), {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${filename}"`,
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    return fail(error);
  }
}
