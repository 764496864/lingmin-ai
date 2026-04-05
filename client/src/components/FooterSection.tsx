/**
 * FooterSection — 底部CTA + 页脚
 * Design: 暗夜星河赛博奢华风
 * 最终行动号召区域 + 品牌信息页脚
 */
import { motion, useInView } from "framer-motion";
import { ExternalLink, Sparkles, Zap } from "lucide-react";
import { useRef } from "react";

export default function FooterSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <>
      {/* CTA Section */}
      <section className="relative py-24 sm:py-32 overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full bg-[oklch(0.45_0.2_260/0.08)] blur-[150px]" />
          <div className="absolute top-1/3 left-1/3 w-[300px] h-[300px] rounded-full bg-[oklch(0.82_0.1_85/0.03)] blur-[100px]" />
        </div>

        {/* Decorative line */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-24 bg-gradient-to-b from-transparent via-[oklch(0.5_0.15_260/0.3)] to-transparent" />

        <div className="container relative">
          <motion.div
            ref={ref}
            initial={{ opacity: 0, y: 40 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-3xl mx-auto text-center"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 mb-8 rounded-full border border-[oklch(0.82_0.1_85/0.25)] bg-[oklch(0.82_0.1_85/0.04)]">
              <Sparkles className="w-3.5 h-3.5 text-[oklch(0.82_0.1_85)]" />
              <span className="text-xs font-medium text-[oklch(0.82_0.1_85)]">
                开启您的AI创作之旅
              </span>
            </div>

            <h2 className="font-display font-bold text-3xl sm:text-4xl md:text-5xl text-foreground mb-6 leading-tight">
              准备好让AI
              <br />
              <span className="text-shimmer">重新定义</span>
              <span className="text-foreground">您的文案创作？</span>
            </h2>

            <p className="text-muted-foreground text-base sm:text-lg leading-relaxed mb-10 max-w-xl mx-auto">
              立即体验灵敏AI的双引擎智能创作系统，从此告别文案焦虑，让每一篇内容都成为爆款
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a
                href="https://chatgpt.com/g/g-69cd2d065ab88191aaa4ebea2bdc0d8e-ai-min-shang-xue-wen-an-chuang-zuo-guan"
                target="_blank"
                rel="noopener noreferrer"
                className="relative inline-flex items-center gap-2 px-8 py-4 text-base font-semibold rounded-xl overflow-hidden group w-full sm:w-auto justify-center transition-transform duration-300 active:scale-[0.98]"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-[oklch(0.6_0.2_260)] to-[oklch(0.5_0.18_260)]" />
                <div className="absolute inset-0 bg-gradient-to-r from-[oklch(0.65_0.22_260)] to-[oklch(0.55_0.2_260)] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{ boxShadow: "0 0 40px oklch(0.5 0.2 260 / 0.3)" }} />
                <span className="relative text-white">开始创作文案</span>
                <Zap className="relative w-4 h-4 text-white" />
              </a>
              <a
                href="https://chatgpt.com/g/g-69c4f07d148081919753a8f43267db79-ai-min-shang-xue-wen-an-run-se-da-shi"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-8 py-4 text-base font-medium rounded-xl border border-[oklch(0.28_0.03_260)] text-foreground/80 hover:border-[oklch(0.45_0.12_260)] hover:text-foreground transition-all duration-500 hover:bg-[oklch(0.15_0.02_260/0.5)] w-full sm:w-auto justify-center"
              >
                <span>进入润色官</span>
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative border-t border-[oklch(0.15_0.02_260)]">
        {/* Top gradient line */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[oklch(0.4_0.1_260/0.3)] to-transparent" />

        <div className="container py-12 sm:py-14">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            {/* Brand */}
            <div className="flex flex-col items-center md:items-start gap-3">
              <div className="flex items-center gap-2.5">
                <div className="relative w-8 h-8 flex items-center justify-center">
                  <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-[oklch(0.6_0.2_260)] to-[oklch(0.75_0.18_255)] opacity-20" />
                  <Sparkles className="w-4 h-4 text-[oklch(0.75_0.18_255)]" />
                </div>
                <span className="font-display font-bold text-base text-foreground">
                  灵敏<span className="text-gradient-blue">AI</span><span className="text-muted-foreground font-normal text-xs ml-1">·艾敏商学</span>
                </span>
              </div>
              <p className="text-sm text-muted-foreground/70 text-center md:text-left">
                AI赋能内容创作，让每一篇文案都闪耀光芒
              </p>
            </div>

            {/* Links */}
            <div className="flex items-center gap-8">
              <a
                href="https://chatgpt.com/g/g-69cd2d065ab88191aaa4ebea2bdc0d8e-ai-min-shang-xue-wen-an-chuang-zuo-guan"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-muted-foreground/70 hover:text-foreground transition-colors duration-300"
              >
                文案创作官
              </a>
              <div className="w-px h-4 bg-[oklch(0.2_0.02_260)]" />
              <a
                href="https://chatgpt.com/g/g-69c4f07d148081919753a8f43267db79-ai-min-shang-xue-wen-an-run-se-da-shi"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-muted-foreground/70 hover:text-foreground transition-colors duration-300"
              >
                文案润色官
              </a>
            </div>

            {/* Copyright */}
            <div className="text-xs text-muted-foreground/50 text-center md:text-right">
              <p>&copy; {new Date().getFullYear()} 灵敏AI·艾敏商学. All rights reserved.</p>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
