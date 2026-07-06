import { redirect } from "next/navigation";

/** /tokens is now the screener; token detail lives at /tokens/[asset]. */
export default function TokensPage() {
  redirect("/screener");
}
