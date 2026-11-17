// The address of the site the person is using (live site, preview or your
// computer), so links in emails point back to the same place.
import "server-only";
import { headers } from "next/headers";
import { siteUrl } from "@/lib/site";

export async function requestOrigin() {
  const h = await headers();
  const origin = h.get("origin");
  if (origin) return origin;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return siteUrl;
  const protocol = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${protocol}://${host}`;
}
