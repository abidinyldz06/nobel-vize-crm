import MainLayoutClient from "@/components/MainLayoutClient";
import { requireStaffPage } from "@/lib/page-auth";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { staff, user } = await requireStaffPage();

  return (
    <MainLayoutClient
      profile={{
        staffId: staff.id,
        fullName: staff.full_name,
        email: user.email ?? staff.email,
        role: staff.role,
      }}
    >
      {children}
    </MainLayoutClient>
  );
}
