import { site } from "@/lib/data/site";
import { DEFAULT_OG_IMAGE } from "@/lib/seo/metadata";

const ORGANIZATION_ID = `${site.url}/#organization`;
const FOUNDER_ID = `${site.url}/about/the-founder#person`;

function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

const postalAddress = (address: { street: string; locality: string; region: string; postalCode: string }) => ({
  "@type": "PostalAddress",
  streetAddress: address.street,
  addressLocality: address.locality,
  addressRegion: address.region,
  postalCode: address.postalCode,
  addressCountry: site.address.country
});

export function LocalBusinessJsonLd() {
  const branches = site.locations.filter((l) => l.address.street !== site.address.street);

  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "MedicalBusiness",
        "@id": ORGANIZATION_ID,
        name: site.name,
        image: DEFAULT_OG_IMAGE,
        logo: `${site.url}/logo.png`,
        url: site.url,
        telephone: site.phone,
        email: site.email,
        priceRange: "₹₹",
        address: {
          ...postalAddress(site.address),
          addressLocality: "Navi Mumbai"
        },
        geo: {
          "@type": "GeoCoordinates",
          latitude: site.geo.lat,
          longitude: site.geo.lng
        },
        hasMap: site.locations[0]!.mapUrl,
        openingHours: "Mo-Sa 10:00-19:00",
        founder: { "@id": FOUNDER_ID },
        department: branches.map((branch) => ({
          "@type": "MedicalClinic",
          name: `${site.name}, ${branch.name}`,
          telephone: site.phone,
          address: postalAddress(branch.address),
          geo: {
            "@type": "GeoCoordinates",
            latitude: branch.geo.lat,
            longitude: branch.geo.lng
          },
          hasMap: branch.mapUrl
        })),
        sameAs: [
          site.social.facebook,
          site.social.instagram,
          site.social.instagramMeditation,
          site.social.linkedin
        ]
      }}
    />
  );
}

export function PersonJsonLd() {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "Person",
        "@id": FOUNDER_ID,
        name: site.founder,
        jobTitle: "Clinical Hypnotherapist & Counselling Psychologist",
        worksFor: { "@id": ORGANIZATION_ID },
        url: `${site.url}/about/the-founder`,
        sameAs: [site.social.linkedin]
      }}
    />
  );
}

export function BreadcrumbJsonLd({
  items
}: {
  items: { name: string; path: string }[];
}) {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: items.map((item, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: item.name,
          item: item.path === "/" ? site.url : `${site.url}${item.path}`
        }))
      }}
    />
  );
}

export function FAQJsonLd({
  items
}: {
  items: { question: string; answer: string }[];
}) {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: items.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: { "@type": "Answer", text: item.answer }
        }))
      }}
    />
  );
}

export function ArticleJsonLd({
  title,
  description,
  path,
  datePublished,
  image
}: {
  title: string;
  description: string;
  path: string;
  datePublished: string;
  image?: string;
}) {
  const url = `${site.url}${path}`;
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "Article",
        headline: title,
        description,
        url,
        mainEntityOfPage: url,
        image: image ?? DEFAULT_OG_IMAGE,
        datePublished,
        // The CMS doesn't store edit dates, so the publish date is the latest known change.
        dateModified: datePublished,
        author: { "@type": "Organization", name: site.name, url: site.url },
        publisher: { "@id": ORGANIZATION_ID, "@type": "Organization", name: site.name, logo: { "@type": "ImageObject", url: `${site.url}/logo.png` } }
      }}
    />
  );
}

// Psychological approaches are marked up as PsychologicalTreatment. Techniques
// the practice itself describes as complementary or outside mainstream
// clinical psychology are marked up as a plain Service instead.
export function TherapyJsonLd({
  name,
  description,
  path,
  complementary
}: {
  name: string;
  description: string;
  path: string;
  complementary?: boolean;
}) {
  const url = `${site.url}${path}`;
  return (
    <JsonLd
      data={
        complementary
          ? {
              "@context": "https://schema.org",
              "@type": "Service",
              name,
              description,
              url,
              serviceType: name,
              provider: { "@id": ORGANIZATION_ID },
              areaServed: "Navi Mumbai"
            }
          : {
              "@context": "https://schema.org",
              "@type": "PsychologicalTreatment",
              name,
              description,
              url
            }
      }
    />
  );
}
