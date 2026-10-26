import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Clock, ListChecks } from "lucide-react";
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
        <Badge tone={assessment.tier === "premium" ? "gold" : "primary"}>{assessment.tier === "premium" ? "Premium" : "Free"}</Badge>
      </div>

      <p className="eyebrow mt-5">{assessment.categoryName}</p>
      <h2 id={titleId} className="mt-2 text-2xl leading-snug text-primary-dark">
        {assessment.title}
      </h2>
      <p className="mt-3 flex-1 leading-relaxed text-ink-soft">{assessment.description}</p>

      <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-soft">
        <li className="inline-flex items-center gap-1.5">
          <Clock aria-hidden="true" className="h-4 w-4" />
          <span>About {assessment.estimatedMinutes} min</span>
        </li>
        <li className="inline-flex items-center gap-1.5">
          <ListChecks aria-hidden="true" className="h-4 w-4" />
          <span>
            {assessment.questionCount} question{assessment.questionCount === 1 ? "" : "s"}
          </span>
        </li>
      </ul>

      <Link href={href} className="btn-primary mt-6 min-h-11 w-full sm:w-auto sm:self-start" aria-describedby={titleId}>
        Start self-check
        <ArrowRight aria-hidden="true" className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </Link>
    </article>
  );
}
