import { handle, num, oneOf, readJson, str } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { createInspection, listInspections } from "@/lib/services/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    await requireUser(["inspector", "admin"]);
    return listInspections();
  });
}

/** POST /api/inspections – quality inspector uploads soil/crop inspection report */
export async function POST(req: Request) {
  return handle(async () => {
    const user = await requireUser(["inspector", "admin"]);
    const b = await readJson(req);
    return createInspection(user, {
      cropId: num(b, "cropId", { required: true, min: 1 })!,
      gradeAssigned: oneOf(b, "gradeAssigned", ["A", "B", "C"] as const, true)!,
      moistureLevelPercentage: num(b, "moistureLevelPercentage", { required: true, min: 0, max: 100 })!,
      soilPh: num(b, "soilPh", { min: 0, max: 14 }),
      inspectionNotes: str(b, "inspectionNotes", { max: 2000 }),
      reportAttachment: typeof b.reportAttachment === "string" ? b.reportAttachment : undefined,
      reportFileName: str(b, "reportFileName", { max: 200 }),
      status: oneOf(b, "status", ["pending", "passed", "failed"] as const, true)!,
    });
  }, 201);
}
