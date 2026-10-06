import { requireAdmin } from "@/server/auth";
import { getAdminOverview } from "@/server/data";
import { jsonError } from "@/server/http";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    requireAdmin(req);
    return Response.json(await getAdminOverview());
  } catch (error) {
    return jsonError(error);
  }
}
