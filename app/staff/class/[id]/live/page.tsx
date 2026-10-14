"use client";
// Live class screen (/staff/class/:id/live), refreshed every few seconds.
import { useParams } from "next/navigation";
import { useStaffData } from "@/components/StaffShell";
import { LiveClassBoard, type LiveDashboard } from "@/components/LiveClassBoard";
import { useStaffLang } from "@/lib/staffLang";

const REFRESH_MS = 5000;

export default function LiveClassPage() {
  const { id } = useParams<{ id: string }>();
  const { data, error } = useStaffData<LiveDashboard>(`/api/staff/classes/${id}`, REFRESH_MS);
  const { L } = useStaffLang();
  if (error) return <p className="p-6 text-warn">{error}</p>;
  if (!data) return <p className="p-6 text-muted">{L("טוען…", "جارٍ التحميل…")}</p>;
  return <LiveClassBoard d={data} />;
}
