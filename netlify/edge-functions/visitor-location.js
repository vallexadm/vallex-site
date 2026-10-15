export default async (_request, context) => {
  const location = context.geo ?? {};

  return new Response(JSON.stringify({
    city: location.city || null,
    timezone: location.timezone || null,
    latitude: typeof location.latitude === "number" ? location.latitude : null,
    longitude: typeof location.longitude === "number" ? location.longitude : null,
  }), {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
    },
  });
};

export const config = { path: "/api/visitor-location" };
