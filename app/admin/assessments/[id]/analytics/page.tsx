import { AdminAnalytics } from "@/components/assessments/admin/AdminAnalytics";

export default function AdminAssessmentAnalyticsPage({ params }: { params: { id: string } }) {
  return <AdminAnalytics id={params.id} />;
}
