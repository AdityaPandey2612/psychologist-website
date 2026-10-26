import { LibrarySkeleton } from "@/components/assessments/AssessmentSkeletons";
import Section from "@/components/Section";

export default function Loading() {
  return (
    <Section eyebrow="Self-reflection" title="Self-checks" titleAs="h1">
      <LibrarySkeleton />
    </Section>
  );
}
