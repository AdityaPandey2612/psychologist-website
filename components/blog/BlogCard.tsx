import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";
import type { BlogPost } from "@/lib/firebase/blogs";
import { blogDisplayTitle, blogPath } from "@/lib/blog/seo";

export function formatBlogDate(date: string) {
  return new Date(date).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

/** Shown when a post has no cover image, so every card keeps the same shape. */
function CoverPlaceholder() {
  return (
    <div
      aria-hidden="true"
      className="flex h-full w-full items-center justify-center bg-gradient-to-br from-surface-soft via-[#E8F1EC] to-gold/30"
    >
      <BookOpen className="h-10 w-10 text-primary/35" strokeWidth={1.4} />
    </div>
  );
}

/**
 * One article on the blog list. The first (newest) article is shown as a wide
 * card with the image beside the text; the rest are equal-height cards.
 */
export default function BlogCard({ post, featured = false }: { post: BlogPost; featured?: boolean }) {
  const title = blogDisplayTitle(post);

  return (
    <Link
      href={blogPath(post.id)}
      className={`group flex h-full overflow-hidden rounded-3xl border border-primary/10 bg-surface shadow-[0_1px_2px_rgba(18,58,54,0.05)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_48px_-28px_rgba(18,58,54,0.45)] motion-reduce:transition-none motion-reduce:hover:transform-none ${
        featured ? "flex-col lg:flex-row" : "flex-col"
      }`}
    >
      <div
        className={`relative shrink-0 overflow-hidden bg-surface-soft ${
          featured ? "aspect-[16/10] lg:aspect-auto lg:w-[55%]" : "aspect-[16/10]"
        }`}
      >
        {post.coverImageUrl ? (
          <Image
            src={post.coverImageUrl}
            alt=""
            fill
            sizes={
              featured
                ? "(max-width: 1024px) 100vw, 660px"
                : "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            }
            priority={featured}
            className="object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          />
        ) : (
          <CoverPlaceholder />
        )}
      </div>

      <div className={`flex flex-1 flex-col ${featured ? "p-6 sm:p-8 lg:justify-center lg:p-10" : "p-6"}`}>
        <time
          dateTime={post.publishedDate}
          className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-accent-ink"
        >
          {formatBlogDate(post.publishedDate)}
        </time>
        <h2
          className={`mt-3 font-display leading-snug text-primary-dark transition-colors group-hover:text-primary ${
            featured ? "text-2xl sm:text-3xl lg:line-clamp-4" : "line-clamp-3 text-xl"
          }`}
        >
          {title}
        </h2>
        <p
          className={`mt-3 leading-relaxed text-ink-soft ${
            featured ? "line-clamp-4 text-base sm:text-[17px]" : "line-clamp-3 text-[15px]"
          }`}
        >
          {post.excerpt}
        </p>
        <span className="mt-auto inline-flex items-center gap-1.5 pt-5 text-sm font-semibold text-primary">
          Read article
          <ArrowRight
            aria-hidden="true"
            className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
          />
        </span>
      </div>
    </Link>
  );
}
