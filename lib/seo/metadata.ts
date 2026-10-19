import { Metadata } from "next";
import { site } from "@/lib/data/site";

type BuildMetadataArgs = {
  title: string;
  description: string;
  path: string; // e.g. "/conditions/anxiety"
  image?: string;
  noIndex?: boolean;
  // Use the title exactly as given, without the "| Chaitanya Raj" suffix.
  absoluteTitle?: boolean;
  type?: "website" | "article";
  publishedTime?: string;
  modifiedTime?: string;
};

// The root layout's title template appends " | Chaitanya Raj".
const BRAND_SUFFIX = ` | ${site.shortName}`;
const TITLE_LIMIT = 60;

export const DEFAULT_OG_IMAGE = `${site.url}/og-default.jpg`;

// Collapses whitespace and drops brand segments that some page and CMS titles
// already carry, so the template never produces "| Chaitanya Raj | Chaitanya Raj".
export function cleanTitle(title: string) {
  return title
    .split("|")
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter((part) => part && !/^chaitanya raj(\s+psychology(\s*&\s*counselling)?)?$/i.test(part))
    .join(" | ");
}

export function cleanText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

// Next.js serialises the root canonical without a trailing slash, so the
// sitemap and structured data use the same form for the homepage.
export function canonicalUrl(path: string) {
  return path === "/" ? site.url : `${site.url}${path}`;
}

export function buildMetadata({
  title,
  description,
  path,
  image,
  noIndex,
  absoluteTitle,
  type = "website",
  publishedTime,
  modifiedTime
}: BuildMetadataArgs): Metadata {
  const url = canonicalUrl(path);
  const ogImage = image ?? DEFAULT_OG_IMAGE;
  const pageTitle = absoluteTitle ? cleanText(title) : cleanTitle(title);
  const desc = cleanText(description);
  // Keep the brand suffix only when the full title still fits in search results.
  const useTemplate = !absoluteTitle && pageTitle.length + BRAND_SUFFIX.length <= TITLE_LIMIT;

  return {
    title: useTemplate ? pageTitle : { absolute: pageTitle },
    description: desc,
    alternates: { canonical: url },
    robots: noIndex
      ? { index: false, follow: true }
      : { index: true, follow: true },
    openGraph: {
      title: pageTitle,
      description: desc,
      url,
      siteName: site.name,
      // Only the default image is known to be 1200×630.
      images: [image ? { url: ogImage, alt: pageTitle } : { url: ogImage, width: 1200, height: 630, alt: pageTitle }],
      locale: "en_IN",
      type,
      ...(type === "article" ? { publishedTime, modifiedTime } : {})
    },
    twitter: {
      card: "summary_large_image",
      title: pageTitle,
      description: desc,
      images: [ogImage]
    }
  };
}
