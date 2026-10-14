import { StaffLangProvider } from "@/lib/staffLang";

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return <StaffLangProvider>{children}</StaffLangProvider>;
}
