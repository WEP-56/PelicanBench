import { isAdmin } from "@/server/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return Response.json({ ok: isAdmin(req), configured: Boolean(process.env.ADMIN_PASSWORD) }, {
    headers: { "Cache-Control": "no-store" },
  });
}
