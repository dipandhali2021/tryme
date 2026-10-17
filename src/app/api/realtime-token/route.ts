import { createClientToken } from "@/lib/decart/client-token";

export async function POST(request: Request): Promise<Response> {
  try {
    const origin = request.headers.get("origin") ?? undefined;
    const token = await createClientToken(origin);
    return Response.json(token);
  } catch (err) {
    console.error("[realtime-token] failed:", err);
    return Response.json(
      { error: "Could not mint a session token." },
      { status: 500 },
    );
  }
}
