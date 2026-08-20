import { NextRequest, NextResponse } from "next/server";

// Max 60s execution (Vercel Hobby plan max)
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const BACKEND = process.env.NEXT_PUBLIC_API_URL || "https://velyrion.onrender.com";
  
  try {
    const json = await req.json();
    
    const res = await fetch(`${BACKEND}/api/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(json),
    });

    const text = await res.text();
    
    try {
      const data = JSON.parse(text);
      return NextResponse.json(data, { status: res.status });
    } catch {
      return NextResponse.json(
        { detail: `Backend returned non-JSON (${res.status})` },
        { status: 502 }
      );
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ detail: `Proxy error: ${msg}` }, { status: 502 });
  }
}
