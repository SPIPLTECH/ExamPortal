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
  BarChart3,
  FileSpreadsheet,
  UserCircle,
  ScrollText,
  Headphones,
  ShieldAlert,
  CalendarClock,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export type NavItem = { href: string; label: string; icon: LucideIcon };

const NAV: Record<string, NavItem[]> = {
  SUPER_ADMIN: [
    { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
    { href: "/admin/centers", label: "Centers", icon: Building2 },
    { href: "/admin/students", label: "Students", icon: Users },
    { href: "/admin/approvals", label: "Approvals", icon: FileCheck2 },
    { href: "/admin/proctoring", label: "Proctoring", icon: ShieldAlert },
    { href: "/admin/enquiries", label: "MS-CIT", icon: Headphones },
    { href: "/admin/audit", label: "Audit", icon: ScrollText },
  ],
  ALC_CENTER: [
    { href: "/alc", label: "Dashboard", icon: LayoutDashboard },
    { href: "/alc/tests", label: "Tests", icon: ClipboardList },
    { href: "/alc/questions", label: "Questions", icon: BookOpen },
    { href: "/alc/import", label: "Import", icon: FileSpreadsheet },
    { href: "/alc/students", label: "Students", icon: Users },
    { href: "/alc/enquiries", label: "MS-CIT", icon: Headphones },
    { href: "/alc/schedule", label: "Scheduling", icon: CalendarClock },
    { href: "/alc/results", label: "Results", icon: BarChart3 },
  ],
  STUDENT: [
    { href: "/student", label: "Home", icon: LayoutDashboard },
    { href: "/student/available", label: "Available", icon: ClipboardList },
    { href: "/student/enrolled", label: "Enrolled", icon: FileCheck2 },
    { href: "/student/history", label: "History", icon: BarChart3 },
    { href: "/student/account", label: "Account", icon: UserCircle },
  ],
};

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: "DCU Admin",
  ALC_CENTER: "ALC Center",
  STUDENT: "Student",
};

function isActivePath(pathname: string, href: string, roots: string[]) {
  if (roots.includes(href)) return pathname === href;
  return pathname === href || pathname.startsWith(href + "/");
}

export function AppShell({
  role,
  user,
  bannerSubtitle,
  children,
}: {
  role: string;
  user: { name?: string | null; email?: string | null; image?: string | null };
  bannerSubtitle?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const nav = NAV[role] ?? [];
  const roots = ["/admin", "/alc", "/student"];
  const initials = (user.name ?? "U")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-screen bg-muted/40">
      {/* Top navigation */}
      <header className="sticky top-0 z-40 border-b bg-card/90 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 lg:px-6">
          {/* Brand */}
          <Link href={`/${role === "SUPER_ADMIN" ? "admin" : role === "ALC_CENTER" ? "alc" : "student"}`} className="flex items-center gap-2 shrink-0">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <GraduationCap className="h-5 w-5" />
            </span>
            <span className="font-semibold hidden sm:block">Exam Portal</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-0.5 ml-2 overflow-x-auto">
            {nav.map((item) => {
              const active = isActivePath(pathname, item.href, roots);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Right side */}
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-full p-0.5 pr-2 hover:bg-accent transition-colors">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold overflow-hidden">
                    {user.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={user.image} alt="" className="h-full w-full object-cover" />
                    ) : (
                      initials
                    )}
                  </span>
                  <span className="hidden sm:block text-sm font-medium max-w-[9rem] truncate">{user.name}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuLabel className="flex items-center gap-3 py-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold overflow-hidden shrink-0">
                    {user.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={user.image} alt="" className="h-full w-full object-cover" />
                    ) : (
                      initials
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{user.name}</span>
                    <span className="block truncate text-xs text-muted-foreground font-normal">{user.email}</span>
                    <span className="mt-0.5 inline-block rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary font-medium">
                      {ROLE_LABEL[role] ?? role}
                    </span>
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {role === "STUDENT" && (
                  <DropdownMenuItem asChild>
                    <Link href="/student/account"><UserCircle className="h-4 w-4" /> My Account</Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/login" })} variant="destructive">
                  <LogOut className="h-4 w-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Mobile menu */}
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild className="md:hidden">
                <Button variant="ghost" size="icon">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-72">
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2">
                    <GraduationCap className="h-5 w-5 text-primary" /> Exam Portal
                  </SheetTitle>
                </SheetHeader>
                <nav className="mt-4 space-y-1 px-2">
                  {nav.map((item) => {
                    const active = isActivePath(pathname, item.href, roots);
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                          active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        {item.label}
                      </Link>
                    );
                  })}
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      {/* Student profile banner (only on student home) */}
      {role === "STUDENT" && pathname === "/student" && (
        <div
          className="w-full bg-[#0b1f3f] bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: "url('/student_bg.png')" }}
        >
          <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 pb-6 pt-14 sm:gap-5 sm:pb-8 sm:pt-20 lg:px-6">
            <span className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-white/90 text-2xl font-semibold text-[#0b1f3f] shadow-lg sm:h-24 sm:w-24 sm:text-3xl">
              {user.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.image} alt="" className="h-full w-full object-cover" />
              ) : (
                initials
              )}
            </span>
            <div className="min-w-0 text-white">
              <h1 className="truncate text-2xl font-semibold tracking-tight sm:text-3xl">{user.name}</h1>
              {user.email && <p className="truncate text-xs text-white/80 sm:text-sm">{user.email}</p>}
              {bannerSubtitle && <p className="mt-0.5 truncate text-xs text-white/80 sm:text-sm">{bannerSubtitle}</p>}
            </div>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-7xl px-4 py-6 lg:px-6 lg:py-8">{children}</main>
    </div>
  );
}