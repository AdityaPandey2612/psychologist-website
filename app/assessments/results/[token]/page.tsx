import type { Metadata } from "next";
import ResultsLoader from "@/components/assessments/ResultsLoader";

// Private page: never indexed, and the address (which contains the secret token)
// is not passed on to other sites in the Referer header.
export const metadata: Metadata = {
  title: "Your self-check results",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function ResultsPage({ params }: { params: { token: string } }) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
      <ResultsLoader token={params.token} />
    </div>
  );
}
