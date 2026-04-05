/**
 * Navbar — 磨砂玻璃导航栏
 * Design: 暗夜星河赛博奢华风
 * 滚动时出现毛玻璃背景，品牌Logo居左，含移动端菜单
 */
import { AnimatePresence, motion, useScroll, useTransform } from "framer-motion";
import { Menu, Sparkles, X } from "lucide-react";
import { useState } from "react";

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

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    setMobileOpen(false);
    const el = document.querySelector(href);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

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
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          >
            <div className="relative w-9 h-9 flex items-center justify-center">
              <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-[oklch(0.6_0.2_260)] to-[oklch(0.75_0.18_255)] opacity-20 group-hover:opacity-40 transition-opacity duration-500" />
              <Sparkles className="w-5 h-5 text-[oklch(0.75_0.18_255)]" />
            </div>
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

          {/* Desktop CTA */}
          <a
            href="#tools"
            onClick={(e) => handleNavClick(e, "#tools")}
            className="hidden md:inline-flex relative items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg overflow-hidden group"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-[oklch(0.6_0.2_260)] to-[oklch(0.5_0.18_260)] transition-all duration-500 group-hover:from-[oklch(0.65_0.2_260)] group-hover:to-[oklch(0.55_0.18_260)]" />
            <span className="relative text-white">立即体验</span>
          </a>

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
            <div className="flex flex-col items-center justify-center h-full gap-8">
              {navLinks.map((link, i) => (
                <motion.a
                  key={link.href}
                  href={link.href}
                  onClick={(e) => handleNavClick(e, link.href)}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ delay: i * 0.1 }}
                  className="text-2xl font-display font-semibold text-foreground hover:text-[oklch(0.75_0.18_255)] transition-colors"
                >
                  {link.label}
                </motion.a>
              ))}
              <motion.a
                href="#tools"
                onClick={(e) => handleNavClick(e, "#tools")}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ delay: 0.3 }}
                className="mt-4 inline-flex items-center gap-2 px-8 py-4 text-base font-semibold rounded-xl bg-gradient-to-r from-[oklch(0.6_0.2_260)] to-[oklch(0.5_0.18_260)] text-white"
              >
                立即体验
              </motion.a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
