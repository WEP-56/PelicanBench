import { assertNotBanned } from "@/server/bans";
import { getResult, toPublic } from "@/server/data";
import { getIp, HttpError, jsonError } from "@/server/http";

export const dynamic = "force-dynamic";

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await assertNotBanned(getIp(req));
    const { id } = await context.params;
    const row = await getResult(id);
    if (!row || row.status !== "published") throw new HttpError(404, "没有这条公示");
    return Response.json(toPublic(row));
  } catch (error) {
    return jsonError(error);
  }
}
