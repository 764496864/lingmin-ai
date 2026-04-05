/**
 * ComingSoonSection — 即将上线的AI助手预告
 * Design: 暗夜星河赛博奢华风
 * 展示更多正在开发中的智能体，制造期待感
 */
import { motion, useInView } from "framer-motion";
import {
  Compass,
  Heart,
  Lock,
  MessageSquare,
  Mic,
  PenLine,
  Rocket,
  Sparkles,
  Users,
} from "lucide-react";
import { useRef } from "react";

const comingTools = [
  {
    icon: Compass,
    name: "艾敏商学 · 定位官",
    description: "精准品牌定位分析，帮您找到差异化竞争优势，打造独一无二的品牌心智",
    status: "内测中",
    accent: "oklch(0.7 0.15 200)",
    progress: 85,
  },
  {
    icon: Users,
    name: "艾敏商学 · 团队招聘大师",
    description: "AI驱动的人才画像匹配，从岗位JD到面试话术，全流程智能招聘辅助",
    status: "开发中",
    accent: "oklch(0.65 0.18 280)",
    progress: 60,
  },
  {
    icon: PenLine,
    name: "艾敏商学 · 私域文案写手",
    description: "专注私域场景的文案创作，朋友圈、社群话术、成交文案一键生成",
    status: "开发中",
    accent: "oklch(0.75 0.12 160)",
    progress: 45,
  },
  {
    icon: Sparkles,
    name: "艾敏商学 · 天赋挖掘导师",
    description: "深度解析个人天赋与优势，帮您发现隐藏潜能，找到最适合的赛道与发展方向",
    status: "规划中",
    accent: "oklch(0.72 0.16 50)",
    progress: 30,
  },
  {
    icon: Heart,
    name: "艾敏商学 · 心力修复师",
    description: "AI情绪疏导与心力重建，帮助创业者走出低谷，恢复战斗力与内在能量",
    status: "规划中",
    accent: "oklch(0.68 0.2 350)",
    progress: 25,
  },
  {
    icon: MessageSquare,
    name: "艾敏商学 · 社群运营官",
    description: "智能社群管理与活跃度提升，自动生成互动话题、活动方案与用户分层策略",
    status: "规划中",
    accent: "oklch(0.7 0.14 140)",
    progress: 20,
  },
  {
    icon: Mic,
    name: "艾敏商学 · 直播复盘助手",
    description: "AI自动分析直播数据与话术表现，生成专业复盘报告，助您每场直播都有提升",
    status: "规划中",
    accent: "oklch(0.65 0.2 30)",
    progress: 15,
  },
];

function ToolPreviewCard({
  tool,
  index,
}: {
  tool: (typeof comingTools)[0];
  index: number;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{
        duration: 0.6,
        delay: index * 0.08,
        ease: [0.22, 1, 0.36, 1],
      }}
      className="group relative rounded-2xl border border-[oklch(0.18_0.02_260)] bg-[oklch(0.09_0.015_260/0.6)] p-6 sm:p-7 transition-all duration-700 hover:border-[oklch(0.28_0.06_260)] hover:bg-[oklch(0.11_0.02_260/0.7)]"
    >
      {/* Lock overlay */}
      <div className="absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1 rounded-full bg-[oklch(0.15_0.02_260/0.8)] border border-[oklch(0.25_0.03_260)]">
        <Lock className="w-3 h-3 text-[oklch(0.82_0.1_85)]" />
        <span className="text-[10px] font-semibold tracking-wider uppercase text-[oklch(0.82_0.1_85)]">
          {tool.status}
        </span>
      </div>

      {/* Top glow line */}
      <div
        className="absolute top-0 left-6 right-6 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-700"
        style={{
          background: `linear-gradient(90deg, transparent, ${tool.accent}, transparent)`,
        }}
      />

      {/* Icon */}
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center mb-5 border transition-all duration-500"
        style={{
          borderColor: `color-mix(in oklch, ${tool.accent} 20%, transparent)`,
          backgroundColor: `color-mix(in oklch, ${tool.accent} 6%, transparent)`,
        }}
      >
        <tool.icon className="w-5 h-5" style={{ color: tool.accent }} />
      </div>

      {/* Content */}
      <h3 className="font-display font-semibold text-lg text-foreground mb-2.5">
        {tool.name}
      </h3>
      <p className="text-sm text-muted-foreground leading-relaxed mb-5">
        {tool.description}
      </p>

      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground/70">开发进度</span>
          <span className="text-xs font-medium" style={{ color: tool.accent }}>
            {tool.progress}%
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-[oklch(0.15_0.02_260)] overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={isInView ? { width: `${tool.progress}%` } : {}}
            transition={{ duration: 1.2, delay: index * 0.08 + 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="h-full rounded-full"
            style={{
              background: `linear-gradient(90deg, ${tool.accent}, color-mix(in oklch, ${tool.accent} 60%, oklch(0.82 0.1 85)))`,
            }}
          />
        </div>
      </div>
    </motion.div>
  );
}

export default function ComingSoonSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  return (
    <section id="coming-soon" className="relative py-24 sm:py-32">
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-[oklch(0.5_0.15_260/0.03)] blur-[150px]" />
      <div className="absolute top-1/3 right-1/4 w-[300px] h-[300px] rounded-full bg-[oklch(0.82_0.1_85/0.02)] blur-[120px]" />

      {/* Decorative line */}
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
          <div className="inline-flex items-center gap-2 px-4 py-2 mb-6 rounded-full border border-[oklch(0.82_0.1_85/0.25)] bg-[oklch(0.82_0.1_85/0.04)]">
            <Rocket className="w-3.5 h-3.5 text-[oklch(0.82_0.1_85)]" />
            <span className="text-xs font-medium text-[oklch(0.82_0.1_85)]">
              Coming Soon
            </span>
          </div>
          <h2 className="font-display font-bold text-3xl sm:text-4xl md:text-5xl text-foreground mb-5">
            更多<span className="text-gradient-gold">AI 助手</span>即将上线
          </h2>
          <p className="max-w-xl mx-auto text-muted-foreground text-base sm:text-lg leading-relaxed">
            艾敏商学AI矩阵持续扩展中，覆盖商业全场景的智能助手正在路上
          </p>
        </motion.div>

        {/* Cards grid — first row 3 cols, second row 4 cols for visual variety */}
        <div className="max-w-6xl mx-auto space-y-5">
          {/* First row: 3 cards */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {comingTools.slice(0, 3).map((tool, i) => (
              <ToolPreviewCard key={tool.name} tool={tool} index={i} />
            ))}
          </div>
          {/* Second row: 4 cards */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {comingTools.slice(3).map((tool, i) => (
              <ToolPreviewCard key={tool.name} tool={tool} index={i + 3} />
            ))}
          </div>
        </div>

        {/* Bottom hint */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ delay: 0.8, duration: 0.6 }}
          className="text-center mt-12 text-sm text-muted-foreground/60"
        >
          添加微信 <span className="text-[oklch(0.82_0.1_85)] font-medium">AMAM1255</span> 第一时间获取上线通知
        </motion.p>
      </div>
    </section>
  );
}
