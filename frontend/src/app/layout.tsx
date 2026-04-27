import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import ConditionalLayout from "@/components/ConditionalLayout";
import { AuthProvider } from "@/lib/auth";

const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"] });

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
      <body className={inter.className}>
        <AuthProvider>
          <ConditionalLayout>{children}</ConditionalLayout>
        </AuthProvider>
      </body>
    </html>
  );
}

