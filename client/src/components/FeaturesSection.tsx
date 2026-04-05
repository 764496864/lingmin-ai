/**
 * FeaturesSection — 核心优势展示区域
 * Design: 暗夜星河赛博奢华风
 * 六大优势网格布局，配合渐入动画和精致的卡片效果
 */
import { motion, useInView } from "framer-motion";
import {
  Brain,
  Clock,
  Layers,
  Shield,
  Target,
  TrendingUp,
} from "lucide-react";
import { useRef } from "react";

const features = [
  {
    icon: Brain,
    title: "深度理解",
    description: "AI深度理解选题意图，精准把握文案核心主拉力，确保内容直击目标受众",
    accent: "oklch(0.6 0.2 260)",
  },
  {
    icon: Target,
    title: "精准定位",
    description: "智能分析受众画像与平台特性，量身定制最具传播力的文案策略",
    accent: "oklch(0.65 0.18 255)",
  },
  {
    icon: Layers,
    title: "结构化创作",
    description: "四段式骨架构建法，让每篇文案都有清晰的逻辑脉络和引人入胜的叙事节奏",
    accent: "oklch(0.7 0.15 250)",
  },
  {
    icon: TrendingUp,
    title: "爆款基因",
    description: "融入爆款文案的核心要素与传播规律，大幅提升内容的阅读量与转化率",
    accent: "oklch(0.82 0.1 85)",
  },
  {
    icon: Shield,
    title: "原创保护",
    description: "润色只优化表达，不改变立意。确保每篇文案都保留创作者的独特风格与灵魂",
    accent: "oklch(0.6 0.15 270)",
  },
  {
    icon: Clock,
    title: "极速产出",
    description: "从选题到发布级文案，全流程AI辅助，将创作时间从数小时缩短至数分钟",
    accent: "oklch(0.55 0.2 260)",
  },
];

function FeatureCard({ feature, index }: { feature: typeof features[0]; index: number }) {
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
      className="group relative p-6 sm:p-7 rounded-2xl border border-[oklch(0.18_0.02_260)] bg-[oklch(0.09_0.015_260/0.5)] transition-all duration-700 hover:border-[oklch(0.3_0.08_260)] hover:bg-[oklch(0.11_0.02_260/0.7)]"
    >
      {/* Top glow line */}
      <div
        className="absolute top-0 left-6 right-6 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-700"
        style={{ background: `linear-gradient(90deg, transparent, ${feature.accent}, transparent)` }}
      />

      <div className="relative">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center mb-5 border transition-all duration-500"
          style={{
            borderColor: `color-mix(in oklch, ${feature.accent} 20%, transparent)`,
            backgroundColor: `color-mix(in oklch, ${feature.accent} 5%, transparent)`,
          }}
        >
          <feature.icon className="w-5 h-5" style={{ color: feature.accent }} />
        </div>

        <h3 className="font-display font-semibold text-lg text-foreground mb-2.5">
          {feature.title}
        </h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {feature.description}
        </p>
      </div>
    </motion.div>
  );
}

export default function FeaturesSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  return (
    <section id="features" className="relative py-24 sm:py-32">
      {/* Background glow */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full bg-[oklch(0.5_0.2_260/0.04)] blur-[150px]" />

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
          <span className="inline-block text-xs font-semibold tracking-[0.2em] uppercase text-[oklch(0.82_0.1_85)] mb-4">
            Advantages
          </span>
          <h2 className="font-display font-bold text-3xl sm:text-4xl md:text-5xl text-foreground mb-5">
            为什么选择<span className="text-gradient-blue">灵敏AI</span>
          </h2>
          <p className="max-w-xl mx-auto text-muted-foreground text-base sm:text-lg leading-relaxed">
            专为内容创作者打造的AI文案工具，每一个细节都经过精心设计
          </p>
        </motion.div>

        {/* Features grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-5xl mx-auto">
          {features.map((feature, i) => (
            <FeatureCard key={feature.title} feature={feature} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
