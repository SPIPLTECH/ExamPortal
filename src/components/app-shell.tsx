"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  GraduationCap,
  LayoutDashboard,
  Users,
  Building2,
  FileCheck2,
  ClipboardList,
  BookOpen,
  LogOut,
  Menu,
  X,
  CalendarClock,
  BarChart3,
  FileSpreadsheet,
  UserCircle,
  ScrollText,
  Headphones,
  ShieldAlert,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type NavItem = { href: string; label: string; icon: LucideIcon };

const NAV: Record<string, NavItem[]> = {
  SUPER_ADMIN: [
    { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
    { href: "/admin/centers", label: "ALC Centers", icon: Building2 },
    { href: "/admin/students", label: "Students", icon: Users },
    { href: "/admin/approvals", label: "Test Approvals", icon: FileCheck2 },
    { href: "/admin/proctoring", label: "Proctoring", icon: ShieldAlert },
    { href: "/admin/enquiries", label: "MS-CIT Enquiries", icon: Headphones },
    { href: "/admin/audit", label: "Audit Logs", icon: ScrollText },
  ],
  ALC_CENTER: [
    { href: "/alc", label: "Dashboard", icon: LayoutDashboard },
    { href: "/alc/tests", label: "Tests", icon: ClipboardList },
    { href: "/alc/questions", label: "Question Bank", icon: BookOpen },
    { href: "/alc/import", label: "Excel Import", icon: FileSpreadsheet },
    { href: "/alc/students", label: "Students", icon: Users },
    { href: "/alc/schedule", label: "Scheduling", icon: CalendarClock },
    { href: "/alc/results", label: "Results", icon: BarChart3 },
  ],
  STUDENT: [
    { href: "/student", label: "Home", icon: LayoutDashboard },
    { href: "/student/available", label: "Available Tests", icon: ClipboardList },
    { href: "/student/enrolled", label: "Enrolled Tests", icon: FileCheck2 },
    { href: "/student/history", label: "Exam History", icon: BarChart3 },
    { href: "/student/account", label: "My Account", icon: UserCircle },
  ],
};

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ALC_CENTER: "ALC Center",
  STUDENT: "Student",
};

export function AppShell({
  role,
  user,
  children,
}: {
  role: string;
  user: { name?: string | null; email?: string | null; image?: string | null };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const nav = NAV[role] ?? [];

  return (
    <div className="min-h-screen bg-muted/20">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 bg-background border-r flex flex-col transition-transform lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="h-16 flex items-center gap-2 px-5 border-b font-semibold">
          <GraduationCap className="h-6 w-6 text-primary" />
          <span>Exam Portal</span>
          <button className="ml-auto lg:hidden" onClick={() => setOpen(false)}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {nav.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/admin" &&
                item.href !== "/alc" &&
                item.href !== "/student" &&
                pathname.startsWith(item.href));
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t p-3">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="h-9 w-9 rounded-full bg-muted overflow-hidden flex items-center justify-center shrink-0">
              {user.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.image} alt="" className="h-full w-full object-cover" />
              ) : (
                <UserCircle className="h-6 w-6 text-muted-foreground" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{user.name}</p>
              <p className="text-xs text-muted-foreground truncate">
                {ROLE_LABEL[role] ?? role}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            className="w-full justify-start text-muted-foreground"
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </div>
      </aside>

      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Main */}
      <div className="lg:pl-64">
        <header className="h-16 border-b bg-background flex items-center gap-3 px-4 lg:px-8 sticky top-0 z-20">
          <button className="lg:hidden" onClick={() => setOpen(true)}>
            <Menu className="h-5 w-5" />
          </button>
          <div className="ml-auto text-sm text-muted-foreground">
            {ROLE_LABEL[role]} Portal
          </div>
        </header>
        <main className="p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
