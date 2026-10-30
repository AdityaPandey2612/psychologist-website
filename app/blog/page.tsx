import { buildMetadata } from "@/lib/seo/metadata";
import type { BlogPost } from "@/lib/firebase/blogs";
import { getBlogPosts } from "@/lib/blog/seo";
import BlogCard from "@/components/blog/BlogCard";

// Posts come from the CMS; the list is cached and refreshed every 5 minutes.
export const revalidate = 300;

export const metadata = buildMetadata({
  title: "Blog: Psychology, Therapy & Hypnotherapy Insights",
  description: "Articles on anxiety, depression, hypnotherapy and past life regression from Lt Col Rajesh Sharma (Retd), psychologist in Navi Mumbai. Read the latest.",
  path: "/blog",
});

export default async function BlogListPage() {
  let posts: BlogPost[] = [];

  try {
    posts = await getBlogPosts();
  } catch (error) {
    console.error("Failed to fetch blog posts:", error);
  }

  const [featured, ...rest] = posts;

  return (
    <>
      <header className="border-b border-primary/10 bg-gradient-to-b from-surface-soft/70 to-bg">
        <div className="mx-auto max-w-6xl px-6 pb-12 pt-16 sm:pb-16 sm:pt-20">
          <p className="eyebrow mb-3">Blog</p>
          <div className="divider mb-5" />
          <h1 className="max-w-3xl text-4xl leading-[1.12] tracking-tight sm:text-5xl [text-wrap:balance]">
            Insights on psychological wellbeing
          </h1>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-12 sm:py-16">
        {posts.length === 0 ? (
          <div className="card p-10 text-center">
            <p className="text-ink-soft">No posts published yet.</p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 sm:gap-8 lg:grid-cols-3">
            <div className="sm:col-span-2 lg:col-span-3">
              <BlogCard post={featured} featured />
            </div>
            {rest.map((post) => (
              <BlogCard key={post.id} post={post} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
