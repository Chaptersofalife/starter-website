// Tells search engines what they may look at: chaptersofalife.co.uk/robots.txt
// Private areas (accounts, books, invite links, admin) are kept out of search
// results. They're protected by logins and private links anyway; this just
// asks search engines not to try.
import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/my-books", "/contribute/", "/admin", "/auth/", "/reset-password", "/reminders/", "/api/"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
