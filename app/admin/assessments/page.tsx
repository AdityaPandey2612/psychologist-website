import { AdminPage } from "@/components/assessments/admin/AdminPage";
import { DashboardView } from "@/components/assessments/admin/DashboardView";

export default function AdminAssessmentsPage() {
  return (
    <AdminPage
      wide
      eyebrow="Administration"
      title="Assessments"
      description="Create assessments, control scoring and results, and review responses. Scores are always calculated on the server."
      back={{ href: "/admin", label: "Back to dashboard" }}
    >
      <DashboardView />
    </AdminPage>
  );
}
