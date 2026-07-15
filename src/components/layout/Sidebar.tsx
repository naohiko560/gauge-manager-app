"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { UserRole } from "@/types/database";
import {
  LayoutDashboard,
  Package,
  History,
  Users,
  Wrench,
  CalendarClock,
  LogOut,
  Gauge,
  ListFilter,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
}

const navSections: { label: string; items: NavItem[] }[] = [
  {
    label: "在庫管理",
    items: [
      { href: "/dashboard", label: "ダッシュボード", icon: LayoutDashboard },
      { href: "/inventory", label: "在庫一覧", icon: Package },
      { href: "/history", label: "履歴一覧", icon: History },
    ],
  },
  {
    label: "校正管理",
    items: [
      { href: "/calibration/dashboard", label: "ダッシュボード", icon: CalendarClock },
      { href: "/calibration/instruments", label: "測定器別", icon: ListFilter },
      { href: "/calibration/all", label: "全測定器", icon: ListFilter },
    ],
  },
];

const adminSection: { label: string; items: NavItem[] } = {
  label: "管理",
  items: [
    { href: "/instruments", label: "機器マスター", icon: Wrench },
    { href: "/users", label: "ユーザー", icon: Users },
  ],
};

interface SidebarProps {
  role: UserRole;
  userName: string;
}

export function Sidebar({ role, userName }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [pendingPath, setPendingPath] = useState<string | null>(null);

  useEffect(() => {
    setPendingPath(null);
  }, [pathname]);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + "/");
  }

  const sections = role === "admin"
    ? [...navSections, adminSection]
    : navSections;

  return (
    <aside className="flex flex-col w-48 h-screen sticky top-0 bg-card border-r border-border flex-shrink-0">
      {/* ブランド */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-border">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary">
          <Gauge className="w-4 h-4 text-primary-foreground" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground leading-none truncate">測定器管理</p>
          <p className="text-xs text-muted-foreground mt-0.5">{role === "admin" ? "管理者" : "作業者"}</p>
        </div>
      </div>

      {/* ナビゲーション */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {sections.map((section) => (
          <div key={section.label}>
            <p className="px-2 mb-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                const isPending = pendingPath === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    prefetch={true}
                    onClick={() => { if (!active) setPendingPath(item.href); }}
                    className={cn(
                      "flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-sm transition-colors",
                      active
                        ? "bg-muted text-foreground font-medium"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    {isPending ? (
                      <Loader2 className="w-4 h-4 flex-shrink-0 animate-spin" />
                    ) : (
                      <Icon className="w-4 h-4 flex-shrink-0" />
                    )}
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* フッター */}
      <div className="px-3 py-4 border-t border-border space-y-1">
        <div className="px-2.5 py-1.5">
          <p className="text-xs text-muted-foreground">ログイン中</p>
          <p className="text-sm font-medium text-foreground truncate">{userName}</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          onClick={handleLogout}
        >
          <LogOut className="w-4 h-4 mr-2" />
          ログアウト
        </Button>
      </div>
    </aside>
  );
}
