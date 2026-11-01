import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { formatBlogDate } from "@/components/blog/BlogCard";
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
import { site } from "@/lib/data/site";
import { therapies } from "@/lib/data/therapies";
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

const chipClass =
  "inline-flex min-h-11 items-center rounded-full border border-primary-dark/20 bg-surface px-5 py-2.5 text-sm font-medium text-primary-dark transition hover:border-primary-dark hover:bg-primary-dark hover:text-white";

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
  const relatedTherapies = (post.relatedTherapies ?? [])
    .map((therapySlug) => therapies.find((t) => t.slug === therapySlug))
    .filter((t): t is NonNullable<typeof t> => Boolean(t));
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
        references={post.references}
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

      <article className="pb-16 sm:pb-24">
        {/* On phones the text keeps clear of the floating social bar on the right. */}
        <header className="mx-auto max-w-[44rem] px-4 pt-12 max-sm:pr-16 sm:px-6 sm:pt-16">
          <Link
            href="/blog"
            className="eyebrow inline-flex items-center gap-1.5 hover:underline underline-offset-4"
          >
            <ArrowLeft aria-hidden="true" className="h-4 w-4" />
            Blog
          </Link>
          <h1 className="mt-5 text-[1.9rem] leading-[1.15] tracking-tight sm:text-5xl sm:leading-[1.1] [text-wrap:balance]">
            {title}
          </h1>
          <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-soft">
            <span aria-hidden="true" className="h-px w-10 bg-gold" />
            <span>
              By{" "}
              <Link href="/about/the-founder" rel="author" className="font-medium text-primary-dark underline underline-offset-4">
                {site.founder}
              </Link>
              , Clinical Hypnotherapist and Counselling Psychologist
            </span>
            <span aria-hidden="true">·</span>
            <time dateTime={post.publishedDate}>{formatBlogDate(post.publishedDate)}</time>
          </div>
        </header>

        {post.coverImageUrl && (
          <div className="mx-auto mt-8 max-w-5xl px-4 sm:mt-10 sm:px-6">
            <div className="relative aspect-[16/9] w-full overflow-hidden rounded-2xl shadow-[0_24px_48px_-28px_rgba(18,58,54,0.5)] sm:rounded-3xl">
              <Image
                src={post.coverImageUrl}
                alt={title}
                fill
                priority
                sizes="(min-width: 1024px) 1024px, 100vw"
                className="object-cover"
              />
            </div>
          </div>
        )}

        <div className="mx-auto mt-10 max-w-[44rem] px-4 max-sm:pr-16 sm:mt-12 sm:px-6">
          <div
            className="prose sm:prose-lg blog-content max-w-none text-ink/90 prose-headings:font-display prose-headings:tracking-tight prose-headings:text-primary-dark prose-h2:mb-4 prose-h2:mt-12 prose-h2:text-2xl sm:prose-h2:text-3xl prose-h3:text-xl prose-p:leading-7 sm:prose-p:leading-8 prose-p:text-ink/90 prose-a:font-medium prose-a:text-accent-ink prose-a:underline-offset-4 prose-strong:text-ink prose-ul:my-5 prose-li:marker:text-accent prose-blockquote:rounded-r-xl prose-blockquote:border-l-4 prose-blockquote:border-gold prose-blockquote:bg-surface-soft/60 prose-blockquote:py-1 prose-blockquote:not-italic prose-img:rounded-2xl prose-hr:border-primary/15"
            dangerouslySetInnerHTML={{ __html: prepareBlogHtml(post.content, title) }}
          />

          {(post.references?.length ?? 0) > 0 && (
            <section className="mt-12 border-t border-primary/10 pt-8" aria-labelledby="sources-h">
              <h2 id="sources-h" className="eyebrow mb-3">
                Sources
              </h2>
              <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-ink-soft">
                {post.references!.map((r) => (
                  <li key={r.url}>
                    <a href={r.url} target="_blank" rel="noopener noreferrer" className="font-medium text-primary-dark underline underline-offset-4 hover:text-accent-ink">
                      {r.title}
                    </a>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {faqs.length > 0 && (
            <section className="mt-14 rounded-3xl border border-primary/10 bg-surface p-6 shadow-[0_1px_2px_rgba(18,58,54,0.05)] sm:p-8">
              <h2 className="eyebrow mb-3">Frequently asked questions</h2>
              <FAQAccordion faqs={faqs.map((f) => ({ question: f.q, answer: f.a }))} />
            </section>
          )}

          {(relatedConditions.length > 0 || relatedTherapies.length > 0 || relatedLinks.length > 0) && (
            <section className="mt-12 border-t border-primary/10 pt-10">
              <h2 className="eyebrow mb-4">What can help</h2>
              <div className="flex flex-wrap gap-3">
                {relatedLinks.map((link) => (
                  <Link key={link.href} href={link.href} className={chipClass}>
                    {link.label}
                  </Link>
                ))}
                {relatedConditions
                  .filter((condition) => !relatedLinks.some((l) => l.href === `/conditions/${condition.slug}`))
                  .map((condition) => (
                    <Link key={condition.slug} href={`/conditions/${condition.slug}`} className={chipClass}>
                      {condition.name}
                    </Link>
                  ))}
                {relatedTherapies
                  .filter((therapy) => !relatedLinks.some((l) => l.href === `/therapies/${therapy.slug}`))
                  .map((therapy) => (
                    <Link key={therapy.slug} href={`/therapies/${therapy.slug}`} className={chipClass}>
                      {therapy.name}
                    </Link>
                  ))}
              </div>
            </section>
          )}
        </div>
      </article>
    </>
  );
}
