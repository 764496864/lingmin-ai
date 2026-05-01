/**
 * Navbar — 磨砂玻璃导航栏（含登录态）
 * Design: 暗夜星河赛博奢华风
 *
 * - 滚动时出现毛玻璃背景
 * - 未登录：右上角"登录"按钮
 * - 已登录：右上角头像 + 昵称下拉菜单（个人中心 / 管理后台 / 退出登录）
 */
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { AnimatePresence, motion, useScroll, useTransform } from "framer-motion";
import { ChevronDown, LayoutDashboard, LogOut, Menu, User, X } from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "wouter";

const navLinks = [
  { label: "AI 工具", href: "#tools" },
  { label: "工作流程", href: "#workflow" },
  { label: "核心优势", href: "#features" },
  { label: "更多助手", href: "#coming-soon" },
  { label: "联系我们", href: "#contact" },
];

export default function Navbar() {
  const { scrollY } = useScroll();
  const bgOpacity = useTransform(scrollY, [0, 100], [0, 0.9]);
  const borderOpacity = useTransform(scrollY, [0, 100], [0, 1]);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [, setLocation] = useLocation();
  const { status, user, isAdmin, logout } = useAuth();

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    setMobileOpen(false);
    // 如果当前不在首页，跳回首页再滚动
    if (window.location.pathname !== "/") {
      setLocation("/");
      // 等路由切完再滚
      setTimeout(() => {
        const el = document.querySelector(href);
        if (el) el.scrollIntoView({ behavior: "smooth" });
      }, 80);
      return;
    }
    const el = document.querySelector(href);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  const handleLogout = async () => {
    await logout();
    setLocation("/");
  };

  // 头像 fallback：取昵称/用户名首字
  const avatarLabel = (() => {
    const name = user?.nickname || user?.username || "";
    return name ? name.charAt(0).toUpperCase() : "U";
  })();

  // 桌面端右侧操作区（登录/已登录态切换）
  const desktopRight =
    status === "authenticated" && user ? (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="hidden md:inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-[oklch(0.18_0.025_260/0.6)] transition-colors duration-200 border border-transparent hover:border-[oklch(0.25_0.03_260)]"
          >
            <Avatar className="size-7">
              <AvatarFallback className="bg-gradient-to-br from-[oklch(0.6_0.2_260)] to-[oklch(0.5_0.18_260)] text-white text-xs font-semibold">
                {avatarLabel}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm text-foreground/90 max-w-[100px] truncate">
              {user.nickname || user.username}
            </span>
            <ChevronDown className="size-3.5 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-44 bg-[oklch(0.1_0.02_260/0.98)] border-[oklch(0.22_0.03_260)] backdrop-blur-xl"
        >
          <DropdownMenuItem
            onClick={() => setLocation("/profile")}
            className="cursor-pointer text-sm"
          >
            <User className="size-4 mr-2" />
            个人中心
          </DropdownMenuItem>
          {isAdmin && (
            <DropdownMenuItem
              onClick={() => setLocation("/admin")}
              className="cursor-pointer text-sm"
            >
              <LayoutDashboard className="size-4 mr-2" />
              管理后台
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={handleLogout}
            className="cursor-pointer text-sm text-destructive focus:text-destructive"
          >
            <LogOut className="size-4 mr-2" />
            退出登录
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ) : status === "anonymous" ? (
      <Link
        href="/login"
        className="hidden md:inline-flex relative items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg overflow-hidden group"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-[oklch(0.6_0.2_260)] to-[oklch(0.5_0.18_260)] transition-all duration-500 group-hover:from-[oklch(0.65_0.2_260)] group-hover:to-[oklch(0.55_0.18_260)]" />
        <span className="relative text-white">登录</span>
      </Link>
    ) : (
      // loading
      <div className="hidden md:inline-flex w-20 h-9 rounded-lg bg-[oklch(0.13_0.022_260)] animate-pulse" />
    );

  return (
    <>
      <motion.nav
        className="fixed top-0 left-0 right-0 z-50"
        style={{
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
        }}
      >
        <motion.div
          className="absolute inset-0"
          style={{
            backgroundColor: "oklch(0.08 0.015 260)",
            opacity: bgOpacity,
          }}
        />
        <motion.div
          className="absolute bottom-0 left-0 right-0 h-px"
          style={{
            background: "linear-gradient(90deg, transparent, oklch(0.6 0.2 260 / 0.3), transparent)",
            opacity: borderOpacity,
          }}
        />
        <div className="container relative flex items-center justify-between h-16 md:h-20">
          {/* Logo */}
          <a
            href="/"
            className="flex items-center gap-2.5 group"
            onClick={(e) => {
              e.preventDefault();
              if (window.location.pathname !== "/") {
                setLocation("/");
              } else {
                window.scrollTo({ top: 0, behavior: "smooth" });
              }
            }}
          >
            <img src="/logo-amin.jpg" alt="艘敏AI" className="w-9 h-9 rounded-lg object-contain" />
            <span className="font-display font-bold text-lg tracking-tight text-foreground">
              灵敏<span className="text-gradient-blue">AI</span><span className="text-muted-foreground font-normal text-sm ml-1">·艾敏商学</span>
            </span>
          </a>

          {/* Desktop nav links */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={(e) => handleNavClick(e, link.href)}
                className="relative text-sm text-muted-foreground hover:text-foreground transition-colors duration-300 py-1 group"
              >
                {link.label}
                <span className="absolute bottom-0 left-0 w-0 h-px bg-[oklch(0.6_0.2_260)] transition-all duration-300 group-hover:w-full" />
              </a>
            ))}
          </div>

          {/* Desktop right action */}
          {desktopRight}

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden relative w-10 h-10 flex items-center justify-center rounded-lg border border-[oklch(0.25_0.03_260)] bg-[oklch(0.12_0.02_260/0.5)]"
            aria-label="Toggle menu"
          >
            {mobileOpen ? (
              <X className="w-5 h-5 text-foreground" />
            ) : (
              <Menu className="w-5 h-5 text-foreground" />
            )}
          </button>
        </div>
      </motion.nav>

      {/* Mobile menu overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-[oklch(0.08_0.015_260/0.95)] backdrop-blur-xl md:hidden"
          >
            <div className="flex flex-col items-center justify-center h-full gap-6">
              {navLinks.map((link, i) => (
                <motion.a
                  key={link.href}
                  href={link.href}
                  onClick={(e) => handleNavClick(e, link.href)}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ delay: i * 0.08 }}
                  className="text-2xl font-display font-semibold text-foreground hover:text-[oklch(0.75_0.18_255)] transition-colors"
                >
                  {link.label}
                </motion.a>
              ))}

              {/* 移动端登录态相关入口 */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ delay: 0.4 }}
                className="flex flex-col items-center gap-4 mt-2"
              >
                {status === "authenticated" && user ? (
                  <>
                    <div className="flex items-center gap-3">
                      <Avatar className="size-10">
                        <AvatarFallback className="bg-gradient-to-br from-[oklch(0.6_0.2_260)] to-[oklch(0.5_0.18_260)] text-white text-sm font-semibold">
                          {avatarLabel}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-base text-foreground">
                        {user.nickname || user.username}
                      </span>
                    </div>
                    <Link
                      href="/profile"
                      onClick={() => setMobileOpen(false)}
                      className="text-base text-foreground/80 hover:text-[oklch(0.75_0.18_255)]"
                    >
                      个人中心
                    </Link>
                    {isAdmin && (
                      <Link
                        href="/admin"
                        onClick={() => setMobileOpen(false)}
                        className="text-base text-foreground/80 hover:text-[oklch(0.75_0.18_255)]"
                      >
                        管理后台
                      </Link>
                    )}
                    <button
                      onClick={async () => {
                        setMobileOpen(false);
                        await handleLogout();
                      }}
                      className="text-base text-destructive"
                    >
                      退出登录
                    </button>
                  </>
                ) : status === "anonymous" ? (
                  <Link
                    href="/login"
                    onClick={() => setMobileOpen(false)}
                    className="inline-flex items-center gap-2 px-8 py-4 text-base font-semibold rounded-xl bg-gradient-to-r from-[oklch(0.6_0.2_260)] to-[oklch(0.5_0.18_260)] text-white"
                  >
                    登录
                  </Link>
                ) : null}
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
