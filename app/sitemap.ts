// // import { MetadataRoute } from "next";
// // import { site } from "@/lib/data/site";
// // import { conditions } from "@/lib/data/conditions";
// // import { therapies } from "@/lib/data/therapies";
// // import { blogPosts } from "@/lib/data/blog";
// // import { trainingPrograms } from "@/lib/data/training";
// // import { caseStudies } from "@/lib/data/caseStudies";

// // export default function sitemap(): MetadataRoute.Sitemap {
// //   const staticPages = [
// //     "",
// //     "/about",
// //     "/about/the-founder",
// //     "/about/chaitanya-raj",
// //     "/about/myths-and-facts-about-hypnotherapy",
// //     "/about/media-highlights",
// //     "/about/our-team",
// //     "/about/vastu-consultation",
// //     "/contact",
// //     "/conditions",
// //     "/therapies",
// //     "/training-and-mentorship",
// //     "/case-studies",
// //     "/blog",
// //     "/fees",
// //     "/faq",
// //     "/testimonials"
// //   ].map((path) => ({
// //     url: `${site.url}${path}`,
// //     lastModified: new Date(),
// //     changeFrequency: "monthly" as const,
// //     priority: path === "" ? 1 : 0.7
// //   }));

// //   const conditionPages = conditions.map((c) => ({
// //     url: `${site.url}/conditions/${c.slug}`,
// //     lastModified: new Date(),
// //     changeFrequency: "monthly" as const,
// //     priority: 0.8
// //   }));

// //   const therapyPages = therapies.map((t) => ({
// //     url: `${site.url}/therapies/${t.slug}`,
// //     lastModified: new Date(),
// //     changeFrequency: "monthly" as const,
// //     priority: 0.8
// //   }));

// //   const blogPages = blogPosts.map((p) => ({
// //     url: `${site.url}/blog/${p.slug}`,
// //     lastModified: new Date(p.date),
// //     changeFrequency: "yearly" as const,
// //     priority: 0.6
// //   }));

// //   const trainingPages = trainingPrograms.map((t) => ({
// //     url: `${site.url}/training-and-mentorship/${t.slug}`,
// //     lastModified: new Date(),
// //     changeFrequency: "monthly" as const,
// //     priority: 0.6
// //   }));

// //   const caseStudyPages = caseStudies.map((c) => ({
// //     url: `${site.url}/case-studies/${c.slug}`,
// //     lastModified: new Date(),
// //     changeFrequency: "yearly" as const,
// //     priority: 0.5
// //   }));

// //   return [
// //     ...staticPages,
// //     ...conditionPages,
// //     ...therapyPages,
// //     ...blogPages,
// //     ...trainingPages,
// //     ...caseStudyPages
// //   ];
// // }




// import { MetadataRoute } from "next";

// import { site } from "@/lib/data/site";
// import { conditions } from "@/lib/data/conditions";
// import { therapies } from "@/lib/data/therapies";
// import { blogPosts } from "@/lib/data/blog";
// import { trainingPrograms } from "@/lib/data/training";
// import { caseStudies } from "@/lib/data/caseStudies";

// export default function sitemap(): MetadataRoute.Sitemap {
//   const baseUrl = site.url.replace(/\/$/, "");

//   const staticPages: MetadataRoute.Sitemap = [
//     {
//       url: `${baseUrl}/`,
//       changeFrequency: "monthly",
//       priority: 1,
//     },
//     {
//       url: `${baseUrl}/about`,
//       changeFrequency: "monthly",
//       priority: 0.8,
//     },
//     {
//       url: `${baseUrl}/about/the-founder`,
//       changeFrequency: "monthly",
//       priority: 0.8,
//     },
//     {
//       url: `${baseUrl}/about/chaitanya-raj`,
//       changeFrequency: "monthly",
//       priority: 0.8,
//     },
//     {
//       url: `${baseUrl}/about/myths-and-facts-about-hypnotherapy`,
//       changeFrequency: "monthly",
//       priority: 0.7,
//     },
//     {
//       url: `${baseUrl}/about/media-highlights`,
//       changeFrequency: "monthly",
//       priority: 0.7,
//     },
//     {
//       url: `${baseUrl}/about/our-team`,
//       changeFrequency: "monthly",
//       priority: 0.7,
//     },
//     {
//       url: `${baseUrl}/about/vastu-consultation`,
//       changeFrequency: "monthly",
//       priority: 0.6,
//     },
//     {
//       url: `${baseUrl}/conditions`,
//       changeFrequency: "monthly",
//       priority: 0.9,
//     },
//     {
//       url: `${baseUrl}/therapies`,
//       changeFrequency: "monthly",
//       priority: 0.9,
//     },
//     {
//       url: `${baseUrl}/training-and-mentorship`,
//       changeFrequency: "monthly",
//       priority: 0.8,
//     },
//     {
//       url: `${baseUrl}/case-studies`,
//       changeFrequency: "monthly",
//       priority: 0.7,
//     },
//     {
//       url: `${baseUrl}/blog`,
//       changeFrequency: "weekly",
//       priority: 0.8,
//     },
//     {
//       url: `${baseUrl}/fees`,
//       changeFrequency: "monthly",
//       priority: 0.6,
//     },
//     {
//       url: `${baseUrl}/faq`,
//       changeFrequency: "monthly",
//       priority: 0.6,
//     },
//     {
//       url: `${baseUrl}/testimonials`,
//       changeFrequency: "monthly",
//       priority: 0.6,
//     },
//     {
//       url: `${baseUrl}/contact`,
//       changeFrequency: "monthly",
//       priority: 0.8,
//     },
//     {
//       url: `${baseUrl}/privacy-policy`,
//       changeFrequency: "yearly",
//       priority: 0.2,
//     },
//   ];

//   const conditionPages: MetadataRoute.Sitemap = conditions.map(
//     (condition) => ({
//       url: `${baseUrl}/conditions/${condition.slug}`,
//       changeFrequency: "monthly",
//       priority: 0.8,
//     })
//   );

//   const therapyPages: MetadataRoute.Sitemap = therapies.map((therapy) => ({
//     url: `${baseUrl}/therapies/${therapy.slug}`,
//     changeFrequency: "monthly",
//     priority: 0.8,
//   }));

//   const blogPages: MetadataRoute.Sitemap = blogPosts.map((post) => ({
//     url: `${baseUrl}/blog/${post.slug}`,
//     lastModified: new Date(post.date),
//     changeFrequency: "yearly",
//     priority: 0.6,
//   }));

//   const trainingPages: MetadataRoute.Sitemap = trainingPrograms.map(
//     (program) => ({
//       url: `${baseUrl}/training-and-mentorship/${program.slug}`,
//       changeFrequency: "monthly",
//       priority: 0.7,
//     })
//   );

//   const caseStudyPages: MetadataRoute.Sitemap = caseStudies.map(
//     (caseStudy) => ({
//       url: `${baseUrl}/case-studies/${caseStudy.slug}`,
//       changeFrequency: "yearly",
//       priority: 0.6,
//     })
//   );

//   return [
//     ...staticPages,
//     ...conditionPages,
//     ...therapyPages,
//     ...blogPages,
//     ...trainingPages,
//     ...caseStudyPages,
//   ];
// }

















import { MetadataRoute } from "next";

import { conditions } from "@/lib/data/conditions";
import { therapies } from "@/lib/data/therapies";
import { trainingPrograms } from "@/lib/data/training";
import { caseStudies } from "@/lib/data/caseStudies";
import { blogPath, getBlogPosts } from "@/lib/blog/seo";
import { canonicalUrl } from "@/lib/seo/metadata";
import { listPublished } from "@/lib/assessments/server/service";
import { getStore, StoreNotConfiguredError } from "@/lib/assessments/server/store";

// Rebuilt at most hourly so newly published blog posts appear without a deploy.
export const revalidate = 3600;

type Entry = MetadataRoute.Sitemap[number];

// Only lastModified is given, and only when it is a real date: Google ignores changefreq and priority.
const entry = (path: string, lastModified?: string): Entry => ({
  url: canonicalUrl(path),
  ...(lastModified ? { lastModified } : {}),
});

// Indexable routes only. Left out on purpose: /privacy-policy (noindex), the
// hidden /about/our-team and /about/vastu-consultation pages, /admin and /api.
const staticPages: MetadataRoute.Sitemap = [
  entry("/"),
  entry("/about"),
  entry("/about/the-founder"),
  entry("/about/chaitanya-raj"),
  entry("/about/myths-and-facts-about-hypnotherapy"),
  entry("/about/media-highlights"),
  entry("/conditions"),
  entry("/therapies"),
  entry("/counselling-navi-mumbai"),
  entry("/couples-counselling-navi-mumbai"),
  entry("/hypnotherapy-navi-mumbai"),
  entry("/online-therapy-international-clients"),
  entry("/corporate-wellness-programs-navi-mumbai"),
  entry("/training-and-mentorship"),
  entry("/case-studies"),
  entry("/blog"),
  entry("/gallery"),
  entry("/fees"),
  entry("/faq"),
  entry("/testimonials"),
  entry("/contact"),
  entry("/assessments"),
];

const isIsoDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const conditionPages = conditions.map((c) => entry(`/conditions/${c.slug}`));
  const therapyPages = therapies.map((t) => entry(`/therapies/${t.slug}`));
  const trainingPages = trainingPrograms.map((p) => entry(`/training-and-mentorship/${p.slug}`));
  const caseStudyPages = caseStudies.map((c) => entry(`/case-studies/${c.slug}`));

  // Blog posts live in Firestore. The CMS records a publish date but no
  // modification date, so lastModified is the publish date.
  let blogPages: MetadataRoute.Sitemap = [];
  try {
    const posts = await getBlogPosts();
    blogPages = posts.map((post) =>
      entry(blogPath(post.id), isIsoDate(post.publishedDate) ? post.publishedDate : undefined)
    );
  } catch (error) {
    console.error("Sitemap: failed to load blog posts:", error);
  }

  // Published assessments live in the assessment store; skip quietly when it is not configured.
  let assessmentPages: MetadataRoute.Sitemap = [];
  try {
    const published = await listPublished(await getStore());
    assessmentPages = published.map((a) => entry(`/assessments/${a.slug}`, a.publishedAt.slice(0, 10)));
  } catch (error) {
    if (!(error instanceof StoreNotConfiguredError)) console.error("Sitemap: failed to load assessments:", error);
  }

  return [
    ...staticPages,
    ...conditionPages,
    ...therapyPages,
    ...blogPages,
    ...trainingPages,
    ...caseStudyPages,
    ...assessmentPages,
  ];
}
