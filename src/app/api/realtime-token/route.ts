import { createClientToken } from "@/lib/decart/client-token";

export async function POST(request: Request): Promise<Response> {
  try {
    const origin = request.headers.get("origin") ?? undefined;
    const token = await createClientToken(origin);
    return Response.json(token);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "token mint failed" },
      { status: 500 },
    );
  }
}
