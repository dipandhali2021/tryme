import { createClientToken } from "@/lib/decart/client-token";

export async function POST(request: Request): Promise<Response> {
  try {
    const origin = request.headers.get("origin") ?? undefined;
    const token = await createClientToken(origin);
    return Response.json(token);
  } catch (err) {
    console.error("[realtime-token] failed:", err);
    const message =
      err instanceof Error
        ? err.message
        : typeof err === "string"
          ? err
          : "token mint failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
