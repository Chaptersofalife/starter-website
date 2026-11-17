// The list of public pages for search engines: chaptersofalife.co.uk/sitemap.xml
// When you add a new public page, add it here too.
import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages: { path: string; priority: number }[] = [
    { path: "", priority: 1 },
    { path: "/how-it-works", priority: 0.8 },
    { path: "/contact", priority: 0.6 },
    { path: "/signup", priority: 0.5 },
    { path: "/privacy", priority: 0.3 },
    { path: "/terms", priority: 0.3 },
  ];
  return pages.map(({ path, priority }) => ({
    url: `${siteUrl}${path}`,
    changeFrequency: "monthly",
    priority,
  }));
}
