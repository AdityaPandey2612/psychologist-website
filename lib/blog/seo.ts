import { cache } from "react";
import { getPostBySlug, getPublishedPosts, type BlogPost } from "@/lib/firebase/blogs";
import { cleanTitle } from "@/lib/seo/metadata";
import slugAliases from "./slug-aliases.json";

// Firestore document IDs double as URL slugs. Two were saved with typos, so
// they are served at clean URLs and the old URLs 301 to them (next.config.js).
const aliasToDocId: Record<string, string> = slugAliases;
const docIdToAlias: Record<string, string> = Object.fromEntries(
  Object.entries(aliasToDocId).map(([alias, id]) => [id, alias])
);

export function publicBlogSlug(docId: string) {
  return docIdToAlias[docId] ?? docId;
}

export function blogPath(docId: string) {
  return `/blog/${publicBlogSlug(docId)}`;
}

// Reads by the clean slug first so the page keeps working if the document is
// later re-saved under its clean ID in the CMS.
export const getBlogPost = cache(async (slug: string): Promise<BlogPost | null> => {
  const post = await getPostBySlug(slug);
  if (post) return post;
  const docId = aliasToDocId[slug];
  return docId ? getPostBySlug(docId) : null;
});

export const getBlogPosts = cache(() => getPublishedPosts());

type RelatedLink = { href: string; label: string };

type BlogSeo = {
  // Informational titles for posts whose CMS meta title targeted the same
  // search as a service page (e.g. "Trauma Therapy & Counselling in Navi Mumbai").
  metaTitle?: string;
  related?: RelatedLink[];
};

// Keyed by Firestore document ID. Content stays in the CMS; once the meta
// titles are updated there, the metaTitle entries here can be removed.
const blogSeo: Record<string, BlogSeo> = {
  "how-to-fix-a-relationship-before-its-too-late": {
    metaTitle: "How to Fix a Relationship Before It's Too Late",
    related: [
      { href: "/couples-counselling-navi-mumbai", label: "Couples counselling in Navi Mumbai" },
      { href: "/conditions/relationship-counselling-navi-mumbai", label: "Relationship counselling" },
    ],
  },
  "dealing-with-aggressive-people": {
    metaTitle: "Dealing With Aggressive People",
    related: [
      { href: "/conditions/anger-management-counselling-navi-mumbai", label: "Anger management counselling in Navi Mumbai" },
    ],
  },
  "how-to-overcome-emotional-trauma": {
    metaTitle: "How to Overcome Emotional Trauma",
    related: [
      { href: "/conditions/trauma-ptsd-counselling-navi-mumbai", label: "Trauma and PTSD therapy in Navi Mumbai" },
      { href: "/conditions/abuse-trauma-counselling-navi-mumbai", label: "Counselling after abuse" },
    ],
  },
  "aversion-to-sex": {
    metaTitle: "Aversion to Sex in Marriage: A Client's Story",
    related: [
      { href: "/conditions/sexual-dysfunction-counselling-navi-mumbai", label: "Sexual dysfunction counselling in Navi Mumbai" },
      { href: "/case-studies/aversion-to-sex", label: "Case study: working through an aversion to intimacy" },
    ],
  },
  "feeling-unheard-in-your-marriage-the-silent-problem-behind-most-divorces": {
    related: [{ href: "/couples-counselling-navi-mumbai", label: "Couples counselling in Navi Mumbai" }],
  },
  "intimacy-problems-in-marriage-how-to-reconnect-excerpt": {
    related: [{ href: "/couples-counselling-navi-mumbai", label: "Couples counselling in Navi Mumbai" }],
  },
  "how-to-stop-negative-thoughts": {
    related: [
      { href: "/therapies/cognitive-behavioural-therapy", label: "How Cognitive Behavioural Therapy (CBT) works" },
      { href: "/conditions/anxiety-therapy-navi-mumbai", label: "Anxiety therapy in Navi Mumbai" },
    ],
  },
  "understanding-depression-signs-research-and-real-stories": {
    related: [{ href: "/conditions/depression-therapy-navi-mumbai", label: "Depression counselling in Navi Mumbai" }],
  },
  "blogpast-life-regression-session-story-vashi": {
    related: [
      { href: "/conditions/best-past-life-regression-therapy-in-navi-mumbai", label: "Past life regression therapy in Navi Mumbai" },
    ],
  },
  "counselling-vs-therapy-vs-hypnotherapy-difference": {
    related: [
      { href: "/counselling-navi-mumbai", label: "Counselling in Navi Mumbai" },
      { href: "/hypnotherapy-navi-mumbai", label: "Clinical hypnotherapy in Navi Mumbai" },
    ],
  },
  "what-actually-happens-in-a-past-life-regression-session-and-why-people-sometimes-cry-halfway-through": {
    related: [{ href: "/conditions/best-past-life-regression-therapy-in-navi-mumbai", label: "Past life regression therapy in Navi Mumbai" }],
  },
  "understanding-ocd-in-adults": {
    related: [{ href: "/conditions/ocd-therapy-navi-mumbai", label: "OCD treatment in Navi Mumbai" }],
  },
};

export function blogDisplayTitle(post: BlogPost) {
  return cleanTitle(post.title);
}

export function blogMetaTitle(post: BlogPost) {
  return blogSeo[post.id]?.metaTitle ?? post.metaTitle ?? post.title;
}

export function blogRelatedLinks(post: BlogPost) {
  return blogSeo[post.id]?.related ?? [];
}

const plainText = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;| /g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&rsquo;|’/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

// Prepares CMS HTML for the post page: empty headings are removed; the page
// already renders the title as its H1, so a matching H1 at the top of the
// content is dropped and any other H1 becomes an H2; content headings that
// start below H2 move up so the outline has no gaps. Non-breaking spaces
// between words become normal spaces so lines can wrap on small screens.
export function prepareBlogHtml(html: string, title: string) {
  const heading = plainText(title);
  let out = html
    // Empty headings left behind by the editor (e.g. <h2><br></h2>).
    .replace(/<h([1-6])\b[^>]*>(?:\s|&nbsp;|<br\s*\/?>)*<\/h\1>/gi, "")
    .replace(/<h1\b([^>]*)>([\s\S]*?)<\/h1>/gi, (_, attrs: string, inner: string) =>
      plainText(inner) === heading ? "" : `<h2${attrs}>${inner}</h2>`
    );

  const levels = [...out.matchAll(/<h([2-6])\b/gi)].map((m) => Number(m[1]));
  const shift = levels.length ? Math.min(...levels) - 2 : 0;
  if (shift > 0) {
    out = out.replace(/<(\/?)h([2-6])\b/gi, (_, slash: string, level: string) => `<${slash}h${Number(level) - shift}`);
  }

  return out.replace(/(\S)(?:&nbsp;| )(?=\S)/g, "$1 ");
}
