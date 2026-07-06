import type { Metadata } from "next";
import { APP_URL } from "../lib/site";
import LandingClient from "./landing";

const TITLE = "Basilisk — The Cardano terminal for humans and AI agents";
const DESCRIPTION =
  "TapTools is gone. Basilisk is live — real-time Cardano screener, token analytics, and wallet intelligence. Free open API, hosted MCP server, no NFT passes.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: APP_URL,
    siteName: "Basilisk",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function LandingPage() {
  return <LandingClient />;
}
