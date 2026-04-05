/**
 * ToolsSection — 两大AI智能体展示区域
 * Design: 暗夜星河赛博奢华风
 * 发光边框卡片，悬停时光效聚集，点击跳转到对应GPT链接
 */
import { motion, useInView } from "framer-motion";
import { ArrowUpRight, ExternalLink, PenTool, Sparkles } from "lucide-react";
import { useRef } from "react";

const CREATE_BG = "https://d2xsxph8kpxj0f.cloudfront.net/310519663458393951/SCfJdUEkzqdbvkfBNKpYBo/create-card-bg-VFBpjZt429gLkbdfVLF8U5.webp";
const POLISH_BG = "https://d2xsxph8kpxj0f.cloudfront.net/310519663458393951/SCfJdUEkzqdbvkfBNKpYBo/polish-card-bg-XVVAtG7wqcBnu3tmBEbCdz.webp";

const tools = [
  {
    id: "create",
    title: "文案创作官",
    subtitle: "AI COPY CREATOR",
    description:
      "基于一句话选题，完成短视频文案从判断主拉力、提炼中心主旨、选择证明路径与四段骨架、填充核心句与素材，到最终成文的全过程创作。",
    features: ["智能选题分析", "四段式骨架构建", "爆款文案输出", "多风格适配"],
    icon: PenTool,
    image: CREATE_BG,
    link: "https://chatgpt.com/g/g-69cd2d065ab88191aaa4ebea2bdc0d8e-ai-min-shang-xue-wen-an-chuang-zuo-guan",
    gradient: "from-[oklch(0.5_0.2_260)] to-[oklch(0.6_0.18_240)]",
    glowColor: "oklch(0.5 0.2 260 / 0.15)",
    step: "第一步",
    stepLabel: "创作文案",
  },
  {
    id: "polish",
    title: "文案润色官",
    subtitle: "AI COPY POLISHER",
    description:
      "专注于文案的精细润色与优化。只润色，不重写；只优化表达，不改变立意。让您的文案在保持原有灵魂的同时，表达更加精炼有力。",
    features: ["精准润色优化", "保留原创立意", "表达力提升", "发布级品质"],
    icon: Sparkles,
    image: POLISH_BG,
    link: "https://chatgpt.com/g/g-69c4f07d148081919753a8f43267db79-ai-min-shang-xue-wen-an-run-se-da-shi",
    gradient: "from-[oklch(0.55_0.18_255)] to-[oklch(0.65_0.15_270)]",
    glowColor: "oklch(0.55 0.18 255 / 0.15)",
    step: "第二步",
    stepLabel: "润色优化",
  },
];

function ToolCard({ tool, index }: { tool: typeof tools[0]; index: number }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 60 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.8, delay: index * 0.2, ease: [0.22, 1, 0.36, 1] }}
      className="group relative"
    >
      {/* Outer glow on hover */}
      <div
        className="absolute -inset-1 rounded-[1.1rem] opacity-0 group-hover:opacity-100 transition-opacity duration-700 blur-xl"
        style={{ background: tool.glowColor }}
      />

      {/* Card */}
      <div className="relative rounded-2xl overflow-hidden border border-[oklch(0.22_0.03_260)] bg-[oklch(0.1_0.02_260/0.9)] backdrop-blur-sm transition-all duration-700 hover:border-[oklch(0.4_0.12_260)]">
        {/* Image area */}
        <div className="relative h-52 sm:h-60 overflow-hidden">
          <img
            src={tool.image}
            alt={tool.title}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[oklch(0.1_0.02_260)] via-[oklch(0.1_0.02_260/0.4)] to-transparent" />

          {/* Step badge */}
          <div className="absolute top-5 left-5">
            <div className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-gradient-to-r ${tool.gradient} shadow-lg shadow-[oklch(0.5_0.2_260/0.2)]`}>
              <span className="text-xs font-bold text-white tracking-wider">{tool.step}</span>
              <span className="text-[11px] text-white/80 font-medium">{tool.stepLabel}</span>
            </div>
          </div>

          {/* Icon */}
          <div className="absolute bottom-5 right-5">
            <div className="w-12 h-12 rounded-xl bg-[oklch(0.12_0.025_260/0.85)] backdrop-blur-md border border-[oklch(0.28_0.04_260)] flex items-center justify-center transition-all duration-500 group-hover:border-[oklch(0.45_0.12_260)] group-hover:shadow-[0_0_25px_oklch(0.5_0.2_260/0.25)]">
              <tool.icon className="w-5 h-5 text-[oklch(0.75_0.18_255)]" />
            </div>
          </div>

          {/* Hover arrow */}
          <div className="absolute top-5 right-5 opacity-0 group-hover:opacity-100 transition-all duration-500 translate-y-2 group-hover:translate-y-0">
            <ArrowUpRight className="w-5 h-5 text-white/60" />
          </div>
        </div>

        {/* Content area */}
        <div className="p-6 sm:p-8">
          <div className="mb-1.5">
            <span className="text-[11px] font-semibold tracking-[0.15em] uppercase text-[oklch(0.65_0.1_85)]">
              {tool.subtitle}
            </span>
          </div>
          <h3 className="font-display font-bold text-2xl sm:text-3xl text-foreground mb-3">
            {tool.title}
          </h3>
          <p className="text-muted-foreground leading-relaxed mb-6 text-sm sm:text-[15px]">
            {tool.description}
          </p>

          {/* Features */}
          <div className="grid grid-cols-2 gap-2.5 mb-8">
            {tool.features.map((feature) => (
              <div
                key={feature}
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-[oklch(0.13_0.022_260)] border border-[oklch(0.2_0.025_260)] transition-colors duration-300 group-hover:border-[oklch(0.28_0.04_260)]"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-[oklch(0.65_0.2_260)] shrink-0" />
                <span className="text-xs sm:text-sm text-foreground/80">{feature}</span>
              </div>
            ))}
          </div>

          {/* CTA */}
          <a
            href={tool.link}
            target="_blank"
            rel="noopener noreferrer"
            className="relative inline-flex items-center justify-center gap-2 w-full px-6 py-3.5 text-sm font-semibold rounded-xl overflow-hidden group/btn transition-transform duration-300 active:scale-[0.98]"
          >
            <div className={`absolute inset-0 bg-gradient-to-r ${tool.gradient} opacity-90 transition-opacity duration-500 group-hover/btn:opacity-100`} />
            <div className="absolute inset-0 opacity-0 group-hover/btn:opacity-100 transition-opacity duration-500" style={{ boxShadow: "inset 0 0 30px oklch(0.8 0.15 255 / 0.2)" }} />
            <span className="relative text-white">进入{tool.title}</span>
            <ExternalLink className="relative w-4 h-4 text-white/80 transition-transform duration-300 group-hover/btn:translate-x-0.5" />
          </a>
        </div>
      </div>
    </motion.div>
  );
}

export default function ToolsSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  return (
    <section id="tools" className="relative py-24 sm:py-32">
      {/* Background glows */}
      <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-[oklch(0.5_0.2_260/0.05)] blur-[150px]" />
      <div className="absolute top-1/3 right-1/4 w-[400px] h-[400px] rounded-full bg-[oklch(0.55_0.18_255/0.04)] blur-[120px]" />

      {/* Decorative top line */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-24 bg-gradient-to-b from-transparent via-[oklch(0.5_0.15_260/0.3)] to-transparent" />

      <div className="container relative">
        {/* Section header */}
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
          className="text-center mb-16 sm:mb-20"
        >
          <span className="inline-block text-xs font-semibold tracking-[0.2em] uppercase text-[oklch(0.82_0.1_85)] mb-4">
            AI Tools
          </span>
          <h2 className="font-display font-bold text-3xl sm:text-4xl md:text-5xl text-foreground mb-5">
            双引擎<span className="text-gradient-blue">智能创作</span>
          </h2>
          <p className="max-w-xl mx-auto text-muted-foreground text-base sm:text-lg leading-relaxed">
            两大AI智能体各司其职，为您的文案创作提供从零到一的完整解决方案
          </p>
        </motion.div>

        {/* Tool cards */}
        <div className="grid md:grid-cols-2 gap-6 lg:gap-8 max-w-5xl mx-auto">
          {tools.map((tool, i) => (
            <ToolCard key={tool.id} tool={tool} index={i} />
          ))}
        </div>

        {/* Connection hint */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ delay: 0.6, duration: 0.8 }}
          className="flex items-center justify-center mt-12 gap-3"
        >
          <div className="h-px w-12 bg-gradient-to-r from-transparent to-[oklch(0.4_0.1_260)]" />
          <span className="text-xs text-muted-foreground/60 tracking-wider">创作完成后，复制文案进入润色官</span>
          <div className="h-px w-12 bg-gradient-to-l from-transparent to-[oklch(0.4_0.1_260)]" />
        </motion.div>
      </div>
    </section>
  );
}
