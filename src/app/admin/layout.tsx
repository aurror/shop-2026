import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AdminShell } from "./AdminShell";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (
    !session?.user ||
    !["admin", "staff"].includes((session.user as any).role)
  ) {
    redirect("/auth/login");
  }

  return (
    <AdminShell
      userName={session.user.name}
      userRole={(session.user as any).role}
    >
      {children}
    </AdminShell>
  );
}
