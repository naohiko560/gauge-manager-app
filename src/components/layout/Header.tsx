"use client";

import { useState } from "react";
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
  ChevronDown,
  Check,
  ListFilter,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const IS_DEV = process.env.NEXT_PUBLIC_ENV === "development";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
}

const inventoryNavItems: NavItem[] = [
  { href: "/dashboard", label: "ダッシュボード", icon: LayoutDashboard },
  { href: "/inventory", label: "在庫一覧", icon: Package },
  { href: "/history", label: "履歴一覧", icon: History },
];

const calibrationNavItems: NavItem[] = [
  { href: "/calibration/dashboard", label: "ダッシュボード", icon: LayoutDashboard },
  { href: "/calibration/instruments", label: "測定器別", icon: CalendarClock },
  { href: "/calibration/all", label: "全測定器", icon: ListFilter },
];

const apps = [
  { id: "inventory", label: "測定器在庫管理", icon: Gauge, root: "/dashboard" },
  { id: "calibration", label: "校正管理", icon: CalendarClock, root: "/calibration/dashboard" },
] as const;

interface HeaderProps {
  role: UserRole;
  userName: string;
}

export function Header({ role, userName }: HeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [appSwitcherOpen, setAppSwitcherOpen] = useState(false);

  const currentAppId = pathname.startsWith("/calibration") ? "calibration" : "inventory";
  const currentApp = apps.find((a) => a.id === currentAppId)!;
  const navItems = currentAppId === "calibration" ? calibrationNavItems : inventoryNavItems;

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  const activeClass = IS_DEV ? "bg-yellow-50 text-yellow-600" : "bg-blue-50 text-blue-700";

  return (
    <header className="flex items-center h-14 px-4 bg-white border-b border-gray-200 gap-2 flex-shrink-0">
      {/* アプリ切り替えドロップダウン */}
      <Popover open={appSwitcherOpen} onOpenChange={setAppSwitcherOpen}>
        <PopoverTrigger className={cn(
          "flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors hover:bg-gray-100 cursor-pointer flex-shrink-0 mr-2",
        )}>
          <div className={cn(
            "flex items-center justify-center w-8 h-8 rounded-lg",
            IS_DEV ? "bg-yellow-400" : "bg-blue-600"
          )}>
            <currentApp.icon className="w-4 h-4 text-white" />
          </div>
          <span className={cn(
            "text-sm font-semibold whitespace-nowrap",
            IS_DEV ? "text-yellow-500" : "text-gray-900"
          )}>
            {currentApp.label}
          </span>
          <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-52 p-1">
          <div className="px-3 py-1.5 text-xs font-medium text-gray-400 uppercase tracking-wider">
            アプリ切り替え
          </div>
          {apps.map((app) => {
            const Icon = app.icon;
            const isCurrentApp = app.id === currentAppId;
            return (
              <button
                key={app.id}
                onClick={() => {
                  setAppSwitcherOpen(false);
                  router.push(app.root);
                }}
                className={cn(
                  "flex items-center gap-2 w-full px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  isCurrentApp ? activeClass : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                )}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1 text-left">{app.label}</span>
                {isCurrentApp && <Check className="w-3.5 h-3.5" />}
              </button>
            );
          })}
        </PopoverContent>
      </Popover>

      {/* メインナビ */}
      <nav className="flex items-center gap-0.5">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap",
                isActive ? activeClass : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* スペーサー */}
      <div className="flex-1" />

      {/* ユーザーメニュー */}
      <Popover open={menuOpen} onOpenChange={setMenuOpen}>
        <PopoverTrigger className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-sm transition-colors hover:bg-gray-100 cursor-pointer">
          <span className="text-xs text-gray-500">ユーザ：</span>
          <span className="font-medium text-gray-900 whitespace-nowrap">{userName}</span>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-48 p-1">
          <div className="px-3 py-2 text-sm font-medium text-gray-900 border-b border-gray-100 mb-1">
            {userName}
          </div>
          <Link
            href="/instruments"
            onClick={() => setMenuOpen(false)}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
              pathname === "/instruments"
                ? activeClass
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            )}
          >
            <Wrench className="w-4 h-4" />
            機器マスター
          </Link>
          {role === "admin" && (
            <Link
              href="/users"
              onClick={() => setMenuOpen(false)}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                pathname === "/users"
                  ? activeClass
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              )}
            >
              <Users className="w-4 h-4" />
              ユーザー管理
            </Link>
          )}
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-md text-sm text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            ログアウト
          </button>
        </PopoverContent>
      </Popover>
    </header>
  );
}
