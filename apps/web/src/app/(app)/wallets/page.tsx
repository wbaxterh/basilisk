import { redirect } from "next/navigation";

/** Wallet profiling merged into /portfolio — one wallet lookup surface. */
export default function WalletsPage() {
  redirect("/portfolio");
}
