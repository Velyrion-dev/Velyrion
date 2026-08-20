import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "https://velyrion.onrender.com";

// Allow up to 60s for Render backend cold starts (Hobby plan max)
export const maxDuration = 60;

// Wake the backend first, then make the actual request
async function wakeBackend(): Promise<boolean> {
  try {
    const r = await fetch(`${BACKEND_URL}/health`, {
      signal: AbortSignal.timeout(55000),
    });
    return r.ok;
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  let body: string;
  try {
    const json = await req.json();
    body = JSON.stringify(json);
  } catch {
    return NextResponse.json({ detail: "Invalid request body" }, { status: 400 });
  }

  // Step 1: Wake backend if sleeping (health check is fast once awake)
  const awake = await wakeBackend();
  if (!awake) {
    return NextResponse.json(
      { detail: "Backend is starting up. Please try again in 30 seconds." },
      { status: 503 }
    );
  }

  // Step 2: Backend is awake, forward the Google auth request
  try {
    const backendRes = await fetch(`${BACKEND_URL}/api/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal: AbortSignal.timeout(15000), // 15s is enough when backend is awake
    });

    const data = await backendRes.json();
    return NextResponse.json(data, { status: backendRes.status });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { detail: `Backend error: ${msg}` },
      { status: 502 }
    );
  }
}
