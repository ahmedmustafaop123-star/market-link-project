import { fail } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { getInspectionReport } from "@/lib/services/admin";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/inspections/:id/report – streams the uploaded report file */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    await requireUser(["inspector", "admin"]);
    const dataUrl = await getInspectionReport(Number((await params).id));
    const m = /^data:([^;]+);base64,(.*)$/.exec(dataUrl);
    if (!m) return new Response(dataUrl, { headers: { "content-type": "text/plain" } });
    return new Response(Buffer.from(m[2], "base64"), { headers: { "content-type": m[1] } });
  } catch (e) {
    return fail(e);
  }
}
