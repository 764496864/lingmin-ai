/**
 * WechatSection — 微信引导区域
 * Design: 暗夜星河赛博奢华风
 * 引导用户添加微信，获取最新AI助手动态和优先体验权
 */
import { motion, useInView } from "framer-motion";
import {
  ArrowRight,
  Bell,
  Copy,
  Check,
  Crown,
  MessageCircle,
  Star,
} from "lucide-react";
import { useRef, useState } from "react";

const WECHAT_ID = "AMAM1255";

const benefits = [
  {
    icon: Crown,
    text: "新助手优先体验权",
  },
  {
    icon: Bell,
    text: "AI工具上线第一时间通知",
  },
  {
    icon: Star,
    text: "专属社群 & 使用指导",
  },
  {
    icon: MessageCircle,
    text: "1对1答疑 & 定制需求",
  },
];

export default function WechatSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(WECHAT_ID);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
      const input = document.createElement("input");
      input.value = WECHAT_ID;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <section id="contact" className="relative py-24 sm:py-32 overflow-hidden">
      {/* Background image */}
      <div className="absolute inset-0">
        <img
          src="https://d2xsxph8kpxj0f.cloudfront.net/310519663458393951/SCfJdUEkzqdbvkfBNKpYBo/wechat-section-bg-76LwJeD67idHoeXx3pS5B6.webp"
          alt=""
          className="w-full h-full object-cover opacity-30"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background via-background/80 to-background" />
      </div>

      {/* Decorative line */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-24 bg-gradient-to-b from-transparent via-[oklch(0.82_0.1_85/0.3)] to-transparent" />

      <div className="container relative">
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 40 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-4xl mx-auto"
        >
          {/* Main card */}
          <div className="relative rounded-3xl border border-[oklch(0.82_0.1_85/0.15)] bg-[oklch(0.1_0.015_260/0.8)] backdrop-blur-xl overflow-hidden">
            {/* Top gold accent line */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[oklch(0.82_0.1_85/0.5)] to-transparent" />

            {/* Corner accents */}
            <div className="absolute top-0 left-0 w-20 h-20 border-t border-l border-[oklch(0.82_0.1_85/0.2)] rounded-tl-3xl" />
            <div className="absolute top-0 right-0 w-20 h-20 border-t border-r border-[oklch(0.82_0.1_85/0.2)] rounded-tr-3xl" />

            <div className="p-8 sm:p-12 lg:p-16">
              <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
                {/* Left: Content */}
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 mb-6 rounded-full border border-[oklch(0.82_0.1_85/0.25)] bg-[oklch(0.82_0.1_85/0.06)]">
                    <MessageCircle className="w-3.5 h-3.5 text-[oklch(0.82_0.1_85)]" />
                    <span className="text-xs font-medium text-[oklch(0.82_0.1_85)]">
                      加入我们
                    </span>
                  </div>

                  <h2 className="font-display font-bold text-2xl sm:text-3xl lg:text-4xl text-foreground mb-4 leading-tight">
                    添加微信
                    <br />
                    <span className="text-gradient-gold">解锁更多AI能力</span>
                  </h2>

                  <p className="text-muted-foreground text-sm sm:text-base leading-relaxed mb-8">
                    更多AI智能助手正在紧锣密鼓地开发中，添加微信即可获取最新动态、优先体验资格，以及专属社群的深度交流机会
                  </p>

                  {/* Benefits */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {benefits.map((b, i) => (
                      <motion.div
                        key={b.text}
                        initial={{ opacity: 0, x: -20 }}
                        animate={isInView ? { opacity: 1, x: 0 } : {}}
                        transition={{ duration: 0.5, delay: 0.3 + i * 0.08 }}
                        className="flex items-center gap-3 py-2"
                      >
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[oklch(0.82_0.1_85/0.08)] border border-[oklch(0.82_0.1_85/0.15)]">
                          <b.icon className="w-3.5 h-3.5 text-[oklch(0.82_0.1_85)]" />
                        </div>
                        <span className="text-sm text-foreground/80">
                          {b.text}
                        </span>
                      </motion.div>
                    ))}
                  </div>
                </div>

                {/* Right: WeChat ID card */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={isInView ? { opacity: 1, scale: 1 } : {}}
                  transition={{ duration: 0.7, delay: 0.2 }}
                  className="flex justify-center"
                >
                  <div className="relative w-full max-w-xs">
                    {/* Glow behind card */}
                    <div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-[oklch(0.82_0.1_85/0.1)] via-[oklch(0.6_0.2_260/0.08)] to-transparent blur-2xl" />

                    <div className="relative rounded-2xl border border-[oklch(0.82_0.1_85/0.2)] bg-gradient-to-b from-[oklch(0.14_0.02_260)] to-[oklch(0.1_0.015_260)] p-8 text-center">
                      {/* WeChat icon */}
                      <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-[oklch(0.55_0.15_145)] to-[oklch(0.45_0.12_145)] flex items-center justify-center shadow-lg">
                        <svg
                          viewBox="0 0 24 24"
                          className="w-9 h-9 text-white"
                          fill="currentColor"
                        >
                          <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178A1.17 1.17 0 0 1 4.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178 1.17 1.17 0 0 1-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 0 1 .598.082l1.584.926a.272.272 0 0 0 .14.047c.134 0 .24-.111.24-.247 0-.06-.023-.12-.038-.177l-.327-1.233a.582.582 0 0 1-.023-.156.49.49 0 0 1 .201-.398C23.024 18.48 24 16.82 24 14.98c0-3.21-2.931-5.837-7.062-6.122zm-2.18 2.768c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.97-.982zm4.844 0c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.97-.982z" />
                        </svg>
                      </div>

                      <p className="text-xs text-muted-foreground/60 uppercase tracking-widest mb-3">
                        微信号
                      </p>

                      {/* WeChat ID display */}
                      <div className="relative mb-6">
                        <div className="text-2xl font-display font-bold text-gradient-gold tracking-wider">
                          {WECHAT_ID}
                        </div>
                      </div>

                      {/* Copy button */}
                      <button
                        onClick={handleCopy}
                        className="w-full relative inline-flex items-center justify-center gap-2 px-6 py-3.5 text-sm font-semibold rounded-xl overflow-hidden group transition-transform duration-300 active:scale-[0.97]"
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-[oklch(0.82_0.1_85)] to-[oklch(0.72_0.12_70)]" />
                        <div className="absolute inset-0 bg-gradient-to-r from-[oklch(0.85_0.12_85)] to-[oklch(0.75_0.14_70)] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                        {copied ? (
                          <>
                            <Check className="relative w-4 h-4 text-[oklch(0.15_0.02_260)]" />
                            <span className="relative text-[oklch(0.15_0.02_260)]">
                              已复制微信号
                            </span>
                          </>
                        ) : (
                          <>
                            <Copy className="relative w-4 h-4 text-[oklch(0.15_0.02_260)]" />
                            <span className="relative text-[oklch(0.15_0.02_260)]">
                              复制微信号
                            </span>
                          </>
                        )}
                      </button>

                      {/* Hint */}
                      <p className="mt-4 text-xs text-muted-foreground/50 flex items-center justify-center gap-1.5">
                        <ArrowRight className="w-3 h-3" />
                        复制后打开微信搜索添加
                      </p>
                    </div>
                  </div>
                </motion.div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
