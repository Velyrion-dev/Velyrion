import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "https://velyrion.onrender.com";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Proxy the request to the Render backend with a generous timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s for cold starts
    
    const backendRes = await fetch(`${BACKEND_URL}/api/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    
    const data = await backendRes.json();
    
    return NextResponse.json(data, { status: backendRes.status });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    
    // If first attempt fails, retry once (handles cold starts)
    try {
      const body = await req.clone().json().catch(() => null);
      if (!body) {
        return NextResponse.json({ detail: `Proxy error: ${msg}` }, { status: 502 });
      }
      
      // Wait 3s then retry
      await new Promise(r => setTimeout(r, 3000));
      
      const retryRes = await fetch(`${BACKEND_URL}/api/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(60000),
      });
      
      const retryData = await retryRes.json();
      return NextResponse.json(retryData, { status: retryRes.status });
    } catch (retryError: unknown) {
      const retryMsg = retryError instanceof Error ? retryError.message : "Unknown";
      return NextResponse.json(
        { detail: `Backend unreachable after retry: ${retryMsg}` },
        { status: 502 }
      );
    }
  }
}
