import type { Metadata } from "next";
import PeerFeedbackForm from "@/components/assessments/PeerFeedbackForm";

export const metadata: Metadata = {
  title: "Share your view",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function PeerFeedbackPage({ params }: { params: { token: string } }) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
      <PeerFeedbackForm token={params.token} />
    </div>
  );
}
