import { AdminSubmissions } from "@/components/assessments/admin/AdminSubmissions";

export default function AdminAssessmentSubmissionsPage({ params }: { params: { id: string } }) {
  return <AdminSubmissions id={params.id} />;
}
