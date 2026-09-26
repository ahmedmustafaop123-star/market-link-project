import { handle, num, readJson, str } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { recordGpsPing } from "@/lib/services/tracking";

type Ctx = { params: Promise<{ id: string }> };

/** POST { lat, lng, label? }: GPS ping from the driver's phone / tracker while the shipment is moving */
export async function POST(req: Request, { params }: Ctx) {
  return handle(async () => {
    const user = await requireUser(["farmer", "admin"]);
    const b = await readJson(req);
    return recordGpsPing(user, Number((await params).id), num(b, "lat", { required: true })!, num(b, "lng", { required: true })!, str(b, "label", { max: 120 }));
  }, 201);
}
