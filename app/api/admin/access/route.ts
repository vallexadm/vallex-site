import { NextResponse } from "next/server";
import { resolvePlatformAdmin } from "@/lib/server/platform-admin";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const resolved = await resolvePlatformAdmin(request);
  if (!resolved.ok) return resolved.response;
  const { isOwner, permissions } = resolved.context;
  return NextResponse.json({ ok: true, isAdmin: isOwner, isStaff: !isOwner, permissions }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
