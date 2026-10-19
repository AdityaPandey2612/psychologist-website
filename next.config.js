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
    return Object.entries(blogSlugAliases).map(([slug, documentId]) => ({
      source: `/blog/${documentId}`,
      destination: `/blog/${slug}`,
      statusCode: 301,
    }));
  },
};

module.exports = nextConfig;