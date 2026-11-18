import { ResultsSkeleton } from "@/components/assessments/AssessmentSkeletons";

export default function Loading() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
      <ResultsSkeleton />
    </div>
  );
}
