/**
 * HeroSection — 全屏沉浸式英雄区域
 * Design: 暗夜星河赛博奢华风
 * 大字标题 + 打字机效果 + 背景图 + 光效渐变 + 统计数据
 */
import { motion } from "framer-motion";
import { ArrowDown, Zap } from "lucide-react";
import { useEffect, useState } from "react";

const HERO_BG = "https://d2xsxph8kpxj0f.cloudfront.net/310519663458393951/SCfJdUEkzqdbvkfBNKpYBo/hero-bg-R4TQmpg4Rbs5SnK7TxDZwu.webp";

const typewriterTexts = [
  "让每一篇文案都成为爆款",
  "AI驱动的专业文案创作",
  "从灵感到发布，一站式完成",
];

const stats = [
  { value: "10,000+", label: "文案已生成" },
  { value: "98%", label: "用户满意度" },
  { value: "3min", label: "平均产出时间" },
];

export default function HeroSection() {
  const [textIndex, setTextIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const currentText = typewriterTexts[textIndex];
    let timeout: ReturnType<typeof setTimeout>;

    if (!isDeleting && charIndex < currentText.length) {
      timeout = setTimeout(() => setCharIndex((c) => c + 1), 80);
    } else if (!isDeleting && charIndex === currentText.length) {
      timeout = setTimeout(() => setIsDeleting(true), 2500);
    } else if (isDeleting && charIndex > 0) {
      timeout = setTimeout(() => setCharIndex((c) => c - 1), 40);
    } else if (isDeleting && charIndex === 0) {
      setIsDeleting(false);
      setTextIndex((i) => (i + 1) % typewriterTexts.length);
    }

    return () => clearTimeout(timeout);
  }, [charIndex, isDeleting, textIndex]);

  const handleScrollTo = (e: React.MouseEvent<HTMLAnchorElement>, target: string) => {
    e.preventDefault();
    const el = document.querySelector(target);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background image */}
      <div className="absolute inset-0">
        <img
          src={HERO_BG}
          alt=""
          className="w-full h-full object-cover opacity-50"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[oklch(0.08_0.015_260/0.5)] via-[oklch(0.08_0.015_260/0.2)] to-[oklch(0.08_0.015_260)]" />
        <div className="absolute inset-0 bg-gradient-to-r from-[oklch(0.08_0.015_260/0.6)] via-transparent to-[oklch(0.08_0.015_260/0.6)]" />
      </div>

      {/* Radial glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[600px] rounded-full bg-[oklch(0.45_0.2_260/0.1)] blur-[150px]" />

      {/* Content */}
      <div className="relative z-10 container text-center px-4 pt-20">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="inline-flex items-center gap-2 px-4 py-2 mb-8 rounded-full border border-[oklch(0.6_0.2_260/0.3)] bg-[oklch(0.15_0.03_260/0.5)] backdrop-blur-sm"
          >
            <Zap className="w-3.5 h-3.5 text-[oklch(0.82_0.1_85)]" />
            <span className="text-xs font-medium tracking-wider uppercase text-[oklch(0.82_0.1_85)]">
              AI 赋能创作
            </span>
          </motion.div>

          {/* Main title */}
          <h1 className="font-display font-bold text-4xl sm:text-5xl md:text-6xl lg:text-7xl leading-[1.1] tracking-tight mb-6">
            <span className="block text-foreground">艾敏商学</span>
            <span className="block mt-1 text-gradient-blue">OPC爆款文案创作平台</span>
          </h1>

          {/* Typewriter subtitle */}
          <div className="h-10 flex items-center justify-center mb-6">
            <p className="text-lg md:text-xl text-muted-foreground font-light">
              {typewriterTexts[textIndex].substring(0, charIndex)}
              <span className="inline-block w-0.5 h-5 ml-0.5 bg-[oklch(0.6_0.2_260)] animate-pulse align-middle" />
            </p>
          </div>

          {/* Description */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.8 }}
            className="max-w-2xl mx-auto text-base md:text-lg text-muted-foreground/80 leading-relaxed mb-10"
          >
            灵敏AI为您提供从文案创作到精细润色的完整工作流，
            <br className="hidden sm:block" />
            两大AI智能体协同工作，助您产出高质量爆款内容
          </motion.p>

          {/* CTA buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.6 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
          >
            <a
              href="#tools"
              onClick={(e) => handleScrollTo(e, "#tools")}
              className="relative inline-flex items-center gap-2 px-8 py-4 text-base font-semibold rounded-xl overflow-hidden group"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-[oklch(0.6_0.2_260)] to-[oklch(0.5_0.18_260)]" />
              <div className="absolute inset-0 bg-gradient-to-r from-[oklch(0.65_0.22_260)] to-[oklch(0.55_0.2_260)] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{ boxShadow: "inset 0 0 30px oklch(0.75 0.18 255 / 0.3)" }} />
              <span className="relative text-white">开始创作</span>
              <Zap className="relative w-4 h-4 text-white" />
            </a>
            <a
              href="#workflow"
              onClick={(e) => handleScrollTo(e, "#workflow")}
              className="inline-flex items-center gap-2 px-8 py-4 text-base font-medium rounded-xl border border-[oklch(0.3_0.03_260)] text-foreground/80 hover:border-[oklch(0.5_0.15_260)] hover:text-foreground transition-all duration-500 hover:bg-[oklch(0.15_0.02_260/0.5)]"
            >
              了解工作流程
            </a>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9, duration: 0.6 }}
            className="flex items-center justify-center gap-8 sm:gap-16"
          >
            {stats.map((stat, i) => (
              <div key={stat.label} className="text-center">
                <div className="font-display font-bold text-xl sm:text-2xl text-foreground mb-1">
                  {stat.value}
                </div>
                <div className="text-xs sm:text-sm text-muted-foreground">
                  {stat.label}
                </div>
                {i < stats.length - 1 && (
                  <div className="hidden" />
                )}
              </div>
            ))}
          </motion.div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.8 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
        >
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="flex flex-col items-center gap-2"
          >
            <span className="text-xs text-muted-foreground/40 tracking-widest uppercase">Scroll</span>
            <ArrowDown className="w-4 h-4 text-muted-foreground/40" />
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
