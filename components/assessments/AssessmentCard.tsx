import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { PublicSummary } from "@/lib/assessments/types";
import { AssessmentIcon, Badge } from "./ui";

export default function AssessmentCard({ assessment }: { assessment: PublicSummary }) {
  const href = `/assessments/${assessment.slug}`;
  const titleId = `assessment-${assessment.id}-title`;

  return (
    <article
      aria-labelledby={titleId}
      className="card group flex h-full flex-col p-6 transition duration-300 hover:-translate-y-1 motion-reduce:transform-none"
    >
      {assessment.thumbnailUrl && (
        <Image
          src={assessment.thumbnailUrl}
          alt=""
          width={640}
          height={360}
          unoptimized
          className="-mx-6 -mt-6 mb-5 aspect-video w-[calc(100%+3rem)] max-w-none rounded-t-[inherit] object-cover"
        />
      )}
      <div className="flex items-start justify-between gap-3">
        <span className="icon-tile tone-teal">
          <AssessmentIcon name={assessment.icon} />
        </span>
        {assessment.tier === "premium" && <Badge tone="gold">Premium</Badge>}
      </div>

      <h2 id={titleId} className="mt-5 text-2xl leading-snug text-primary-dark">
        {assessment.title}
      </h2>
      <p className="mt-3 flex-1 leading-relaxed text-ink-soft">{assessment.description}</p>


      <Link href={href} className="btn-primary mt-6 min-h-11 w-full sm:w-auto sm:self-start" aria-describedby={titleId}>
        Start self-check
        <ArrowRight aria-hidden="true" className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </Link>
    </article>
  );
}
