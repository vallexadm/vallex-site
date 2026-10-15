import { requirePlatformPermission } from "@/lib/server/platform-admin";

export const requireTrafficAdmin = (request: Request, action: string = "view") =>
  requirePlatformPermission(request, "traffic", action);
