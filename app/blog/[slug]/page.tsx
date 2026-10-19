import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import Section from "@/components/Section";
import { buildMetadata } from "@/lib/seo/metadata";
import { ArticleJsonLd, BreadcrumbJsonLd } from "@/lib/seo/jsonld";
import {
  blogDisplayTitle,
  blogMetaTitle,
  blogPath,
  blogRelatedLinks,
  getBlogPost,
  getBlogPosts,
  prepareBlogHtml,
  publicBlogSlug
} from "@/lib/blog/seo";
import { conditions } from "@/lib/data/conditions";
import FAQAccordion from "@/components/FAQAccordion";

// Posts come from the CMS; pages are cached and refreshed every 5 minutes.
export const revalidate = 300;

export async function generateStaticParams() {
  try {
    const posts = await getBlogPosts();
    return posts.map((post) => ({ slug: publicBlogSlug(post.slug) }));
  } catch (error) {
    console.error("Failed to list blog posts for static generation:", error);
    return [];
  }
}

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const post = await getBlogPost(params.slug);

  if (!post || !post.published) {
    return { title: "Post not found", robots: { index: false, follow: true } };
  }

  return buildMetadata({
    title: blogMetaTitle(post),
    description: post.metaDescription || post.excerpt,
    path: blogPath(post.id),
    image: post.coverImageUrl,
    type: "article",
    publishedTime: post.publishedDate
  });
}

export default async function BlogPostPage({ params }: { params: { slug: string } }) {
  const post = await getBlogPost(params.slug);

  if (!post || !post.published) {
    notFound();
  }

  const title = blogDisplayTitle(post);
  const path = blogPath(post.id);

  const relatedConditions = (post.relatedConditions ?? [])
    .map((condSlug) => conditions.find((c) => c.slug === condSlug))
    .filter((c): c is NonNullable<typeof c> => Boolean(c));
  const relatedLinks = blogRelatedLinks(post);

  const faqs = post.faqs ?? [];

  const faqJsonLd =
    faqs.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faqs.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: {
              "@type": "Answer",
              text: f.a,
            },
          })),
        }
      : null;

  return (
    <>
      <ArticleJsonLd
        title={title}
        description={post.metaDescription || post.excerpt}
        path={path}
        datePublished={post.publishedDate}
        image={post.coverImageUrl}
      />
      <BreadcrumbJsonLd
        items={[
          { name: "Home", path: "/" },
          { name: "Blog", path: "/blog" },
          { name: title, path }
        ]}
      />

      {faqJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
      )}

      <Section eyebrow="Blog" title={title} titleAs="h1">
        <p className="eyebrow mb-8">
          <time dateTime={post.publishedDate}>
            {new Date(post.publishedDate).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </time>
        </p>

        {post.coverImageUrl && (
          <div className="relative mb-10 aspect-[16/9] w-full overflow-hidden rounded-3xl">
            <Image
              src={post.coverImageUrl}
              alt={title}
              fill
              priority
              sizes="(min-width: 1152px) 1104px, 100vw"
              className="object-cover"
            />
          </div>
        )}

<div
  className="prose prose-lg max-w-none blog-content text-ink-soft prose-headings:text-primary-dark prose-a:text-accent-ink"
  dangerouslySetInnerHTML={{ __html: prepareBlogHtml(post.content, title) }}
/>

{faqs.length > 0 && (
  <div className="mt-16 border-t border-primary-dark/10 pt-10">
    <h2 className="eyebrow mb-6">Frequently asked questions</h2>
    <FAQAccordion faqs={faqs.map((f) => ({ question: f.q, answer: f.a }))} />
  </div>
)}

        {(relatedConditions.length > 0 || relatedLinks.length > 0) && (
          <div className="mt-16 border-t border-primary-dark/10 pt-10">
            <h2 className="eyebrow mb-4">What can help</h2>
            <div className="flex flex-wrap gap-3">
              {relatedLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="inline-flex min-h-11 items-center rounded-full border border-primary-dark/20 bg-white px-5 py-2.5 text-sm font-medium text-primary-dark transition hover:bg-primary-dark hover:text-white"
                >
                  {link.label}
                </Link>
              ))}
              {relatedConditions
                .filter((condition) => !relatedLinks.some((l) => l.href === `/conditions/${condition.slug}`))
                .map((condition) => (
                  <Link
                    key={condition.slug}
                    href={`/conditions/${condition.slug}`}
                    className="inline-flex min-h-11 items-center rounded-full border border-primary-dark/20 bg-white px-5 py-2.5 text-sm font-medium text-primary-dark transition hover:bg-primary-dark hover:text-white"
                  >
                    {condition.name}
                  </Link>
                ))}
            </div>
          </div>
        )}
      </Section>
    </>
  );
}
