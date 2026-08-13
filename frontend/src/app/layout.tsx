import type { Metadata } from "next";
import "./globals.css";
import Providers from "@/components/Providers";

export const metadata: Metadata = {
  title: "VELYRION — Agent Governance & Audit Intelligence",
  description: "Monitor, log, evaluate, and report on all AI agent activity. The governance layer for autonomous AI agents.",
  keywords: "AI governance, agent monitoring, audit trail, compliance, anomaly detection, HITL",
  openGraph: {
    title: "VELYRION — Agent Governance & Audit Intelligence",
    description: "The governance layer for autonomous AI agents. Datadog + Okta for the AI era.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ fontFamily: "'Inter', sans-serif" }}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
