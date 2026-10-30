// /** @type {import('next').NextConfig} */
// const nextConfig = {
//   reactStrictMode: true,
//   images: {
//     remotePatterns: [
//       { protocol: 'https', hostname: 'images.unsplash.com' }
//     ]
//   }
// };

// module.exports = nextConfig;


// Clean blog URL → Firestore document ID (the IDs double as the old slugs).
const blogSlugAliases = require("./lib/blog/slug-aliases.json");

// `next dev` evaluates modules with eval() for source maps and Fast Refresh;
// without 'unsafe-eval' the page never hydrates there. Production builds don't
// need it.
const isDev = process.env.NODE_ENV !== "production";

// Next.js streams page data through inline <script> tags, so script-src needs
// 'unsafe-inline' unless every page is rendered per request with a nonce,
// which would disable static/ISR caching. Third parties: Google Analytics,
// Microsoft Clarity, Firebase (admin), Web3Forms (contact form), Google Maps.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://www.googletagmanager.com https://www.clarity.ms https://scripts.clarity.ms`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  // GA4 sends hits to analytics.google.com and www.google.com as well as
  // *.google-analytics.com; a wildcard doesn't cover the bare hostname.
  "connect-src 'self' https://*.googleapis.com https://*.google-analytics.com https://analytics.google.com https://*.analytics.google.com https://www.google.com https://www.googletagmanager.com https://*.doubleclick.net https://*.clarity.ms https://c.bing.com https://api.web3forms.com",
  "frame-src https://www.google.com https://maps.google.com https://www.youtube.com https://www.youtube-nocookie.com",
  "media-src 'self' https:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://api.web3forms.com",
  "frame-ancestors 'self'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
  },
];

// URLs from the old WordPress site (and two mistyped new-site URLs) that
// Google still crawls, mapped to their closest current page. Paths are written
// without a trailing slash because Next.js strips it before redirects run.
// Old URLs with no equivalent (the hidden Vastu page) are left to 404. The
// WordPress feed and deleted test/draft posts go to the blog index so Search
// Console stops reporting them as "Not found".
const legacyRedirects = {
  "/anxiety": "/conditions/anxiety-therapy-navi-mumbai",
  "/anxiety-2": "/conditions/anxiety-therapy-navi-mumbai",
  "/insomnia": "/conditions/sleep-disorder-counselling-navi-mumbai",
  "/grief": "/conditions/grief-counselling-navi-mumbai",
  "/sexual-dysfunctions": "/conditions/sexual-dysfunction-counselling-navi-mumbai",
  "/drug-or-alcohol-abuse": "/conditions/addiction-counselling-navi-mumbai",
  "/anger-management-classes-in-navi-mumbai": "/conditions/anger-management-counselling-navi-mumbai",
  "/stammering": "/conditions/stammering-therapy-navi-mumbai",
  "/best-past-life-regression-therapy-in-mumbai": "/conditions/best-past-life-regression-therapy-in-navi-mumbai",
  "/best-past-life-regression-therapy-in-navi-mumbai": "/conditions/best-past-life-regression-therapy-in-navi-mumbai",
  "/behaviour-modification-therapy": "/therapies/behaviour-modification-therapy",
  "/best-cognitive-behavioral-therapist-in-mumbai": "/therapies/cognitive-behavioural-therapy",
  "/spirit-release-therapy-srt": "/therapies/spirit-release-therapy",
  "/age-regression": "/therapies/age-regression",
  "/hypnosis": "/hypnotherapy-navi-mumbai",
  "/therapies/clinical-hypnotherapy": "/hypnotherapy-navi-mumbai",
  // The technique page was merged into the main Past Life Regression Therapy page.
  "/therapies/past-life-regression-technique": "/conditions/best-past-life-regression-therapy-in-navi-mumbai",
  "/hypnosis-training-course-in-mumbai": "/training-and-mentorship",
  "/past-life-regression-therapy-teacher-training": "/training-and-mentorship",
  "/past-life-regression-course-in-mumbai": "/training-and-mentorship/basic-training-in-hypnosis-and-plrt",
  "/founder": "/about/the-founder",
  "/about-me": "/about/the-founder",
  "/chaitanya-raj": "/about/chaitanya-raj",
  // The team page is hidden (it returns 404), so send visitors to About.
  "/our-team": "/about",
  "/myths-and-facts-2": "/about/myths-and-facts-about-hypnotherapy",
  "/price-list": "/fees",
  "/aversion-to-sex": "/blog/aversion-to-sex",
  "/how-to-stop-negative-thoughts": "/blog/how-to-stop-negative-thoughts",
  "/dealing-with-aggressive-people": "/blog/dealing-with-aggressive-people",
  "/sexual-physical-or-emotional-abuse": "/conditions/abuse-trauma-counselling-navi-mumbai",
  "/feed": "/blog",
  "/blog/supporting-a-partner-through-depression": "/blog/understanding-depression-signs-research-and-real-stories",
  "/blog/awd": "/blog",
  "/blog/ewkwjebfljksneef": "/blog",
};

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "firebasestorage.googleapis.com",
      },
    ],
  },

  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },

  async redirects() {
    const blogSlugs = Object.entries(blogSlugAliases).map(([slug, documentId]) => ({
      source: `/blog/${documentId}`,
      destination: `/blog/${slug}`,
      statusCode: 301,
    }));
    const legacy = Object.entries(legacyRedirects).map(([source, destination]) => ({
      source,
      destination,
      statusCode: 301,
    }));
    return [...blogSlugs, ...legacy];
  },
};

module.exports = nextConfig;