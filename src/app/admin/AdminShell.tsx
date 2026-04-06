"use client";

import { useState, useEffect, useCallback, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { LocaleProvider } from "@/components/admin/LocaleContext";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { MobileFooterControls } from "@/components/admin/MobileFooterControls";
import { ToastProvider } from "@/components/shared/Toast";

interface AdminShellProps {
  children: ReactNode;
  userName?: string | null;
  userRole: string;
}

export function AdminShell({ children, userName, userRole }: AdminShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [a11yMode, setA11yMode] = useState(false);
  const router = useRouter();

  // Load accessibility preference
  useEffect(() => {
    try {
      setA11yMode(localStorage.getItem("admin-a11y") === "1");
    } catch { /* ignore */ }
  }, []);

  const toggleA11y = useCallback(() => {
    setA11yMode((prev) => {
      const next = !prev;
      try { localStorage.setItem("admin-a11y", next ? "1" : "0"); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const fetchCounts = useCallback(async () => {
    try {
      const [notifRes, reqRes] = await Promise.all([
        fetch("/api/admin/notifications?limit=1"),
        fetch("/api/admin/requests?pendingCount=1"),
      ]);
      if (notifRes.ok) {
        const data = await notifRes.json();
        setUnreadCount(data.unreadCount ?? 0);
      }
      if (reqRes.ok) {
        const data = await reqRes.json();
        setPendingRequestsCount(data.pendingCount ?? 0);
      }
    } catch {
      // Silently fail
    }
  }, []);

  useEffect(() => {
    fetchCounts();
    const interval = setInterval(fetchCounts, 30000);
    return () => clearInterval(interval);
  }, [fetchCounts]);

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
        <div className={`flex h-screen overflow-hidden bg-neutral-50${a11yMode ? " admin-a11y" : ""}`}>
          <AdminSidebar
            unreadCount={unreadCount}
            pendingRequestsCount={pendingRequestsCount}
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
          />
          <div className="flex flex-1 flex-col overflow-hidden">
            <AdminHeader
              unreadCount={unreadCount}
              userName={userName}
              onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
              onLogout={handleLogout}
              a11yMode={a11yMode}
              onToggleA11y={toggleA11y}
            />
            <main className="flex-1 overflow-y-auto p-4 lg:p-6">
              {children}
              <MobileFooterControls a11yMode={a11yMode} onToggleA11y={toggleA11y} />
            </main>
          </div>
        </div>
      </ToastProvider>
    </LocaleProvider>
  );
}
