"use client";

import { useState, useEffect, useCallback, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { LocaleProvider } from "@/components/admin/LocaleContext";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { ToastProvider } from "@/components/shared/Toast";

interface AdminShellProps {
  children: ReactNode;
  userName?: string | null;
  userRole: string;
}

export function AdminShell({ children, userName, userRole }: AdminShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const router = useRouter();

  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/notifications?limit=1");
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.unreadCount ?? 0);
      }
    } catch {
      // Silently fail
    }
  }, []);

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  const handleLogout = async () => {
    try {
      const res = await fetch("/api/auth/signout", { method: "POST" });
      if (res.ok) {
        router.push("/auth/login");
      } else {
        window.location.href = "/auth/login";
      }
    } catch {
      window.location.href = "/auth/login";
    }
  };

  return (
    <LocaleProvider>
      <ToastProvider>
        <div className="flex h-screen overflow-hidden bg-neutral-50">
          <AdminSidebar
            unreadCount={unreadCount}
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
          />
          <div className="flex flex-1 flex-col overflow-hidden">
            <AdminHeader
              unreadCount={unreadCount}
              userName={userName}
              onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
              onLogout={handleLogout}
            />
            <main className="flex-1 overflow-y-auto p-4 lg:p-6">
              {children}
            </main>
          </div>
        </div>
      </ToastProvider>
    </LocaleProvider>
  );
}
