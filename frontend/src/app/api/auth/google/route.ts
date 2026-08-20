import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "https://velyrion.onrender.com";

// Allow up to 60s for Render backend cold starts (default is 10s which times out)
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let body: string;
  try {
    const json = await req.json();
    body = JSON.stringify(json);
  } catch {
    return NextResponse.json({ detail: "Invalid request body" }, { status: 400 });
  }

  // Try up to 2 times (handles cold starts)
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      const backendRes = await fetch(`${BACKEND_URL}/api/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const data = await backendRes.json();
      return NextResponse.json(data, { status: backendRes.status });
    } catch (error: unknown) {
      if (attempt < 2) {
        // Wait 3s before retry
        await new Promise(r => setTimeout(r, 3000));
        continue;
      }
      const msg = error instanceof Error ? error.message : "Unknown error";
      return NextResponse.json(
        { detail: `Backend unreachable: ${msg}` },
        { status: 502 }
      );
    }
  }

  return NextResponse.json({ detail: "Unexpected error" }, { status: 500 });
}
