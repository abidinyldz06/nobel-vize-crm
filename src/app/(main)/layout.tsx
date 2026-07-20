import MainLayoutClient from "@/components/MainLayoutClient";
import { requireStaffPage } from "@/lib/page-auth";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireStaffPage();

  return <MainLayoutClient>{children}</MainLayoutClient>;
}
