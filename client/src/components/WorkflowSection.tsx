/**
 * WorkflowSection — 工作流程引导区域
 * Design: 暗夜星河赛博奢华风
 * 三步流程展示，配合流光连接线和滚动触发动画
 */
import { motion, useInView } from "framer-motion";
import { ArrowRight, CheckCircle2, Copy, FileText, PenTool, Send, Sparkles } from "lucide-react";
import { useRef } from "react";

const WORKFLOW_BG = "https://d2xsxph8kpxj0f.cloudfront.net/310519663458393951/SCfJdUEkzqdbvkfBNKpYBo/workflow-bg-8G3wwb3PybLB9NdeaFSgo9.webp";

const steps = [
  {
    number: "01",
    title: "创作文案",
    description: "进入文案创作官，输入一句话选题，AI将为您完成从主拉力判断到成文的全流程创作",
    icon: PenTool,
    details: ["输入选题关键词", "AI分析主拉力", "构建四段骨架", "生成完整文案"],
    color: "oklch(0.6 0.2 260)",
    link: "https://chatgpt.com/g/g-69cd2d065ab88191aaa4ebea2bdc0d8e-ai-min-shang-xue-wen-an-chuang-zuo-guan",
  },
  {
    number: "02",
    title: "复制润色",
    description: "将创作好的文案复制，进入文案润色官，让AI对表达进行精细优化，保留立意不变",
    icon: Sparkles,
    details: ["复制创作文案", "粘贴至润色官", "AI精准润色", "优化表达力"],
    color: "oklch(0.65 0.18 255)",
    link: "https://chatgpt.com/g/g-69c4f07d148081919753a8f43267db79-ai-min-shang-xue-wen-an-run-se-da-shi",
  },
  {
    number: "03",
    title: "发布上线",
    description: "经过创作与润色双重打磨的文案，已达到发布级品质，可直接用于各平台发布",
    icon: Send,
    details: ["获取润色成品", "检查最终效果", "选择发布平台", "一键发布"],
    color: "oklch(0.82 0.1 85)",
    link: null,
  },
];

function StepCard({ step, index }: { step: typeof steps[0]; index: number }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 50 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, delay: index * 0.15, ease: [0.22, 1, 0.36, 1] }}
      className="relative group"
    >
      {/* Connector arrow (desktop, not on last item) */}
      {index < steps.length - 1 && (
        <div className="hidden lg:flex absolute top-14 -right-4 z-10 items-center">
          <motion.div
            initial={{ scaleX: 0, opacity: 0 }}
            animate={isInView ? { scaleX: 1, opacity: 1 } : {}}
            transition={{ duration: 0.6, delay: index * 0.15 + 0.5 }}
            className="w-8 h-px origin-left"
            style={{
              background: `linear-gradient(90deg, ${step.color}, oklch(0.3 0.05 260))`,
            }}
          />
          <motion.div
            initial={{ opacity: 0 }}
            animate={isInView ? { opacity: 0.6 } : {}}
            transition={{ duration: 0.3, delay: index * 0.15 + 0.8 }}
          >
            <ArrowRight className="w-4 h-4 -ml-1" style={{ color: step.color }} />
          </motion.div>
        </div>
      )}

      {/* Mobile connector */}
      {index < steps.length - 1 && (
        <div className="lg:hidden flex justify-center py-3">
          <motion.div
            initial={{ scaleY: 0, opacity: 0 }}
            animate={isInView ? { scaleY: 1, opacity: 0.4 } : {}}
            transition={{ duration: 0.4, delay: index * 0.15 + 0.5 }}
            className="w-px h-8 origin-top"
            style={{
              background: `linear-gradient(180deg, ${step.color}, transparent)`,
            }}
          />
        </div>
      )}

      <div className="relative p-6 sm:p-8 rounded-2xl border border-[oklch(0.2_0.025_260)] bg-[oklch(0.1_0.018_260/0.6)] backdrop-blur-sm transition-all duration-700 hover:border-[oklch(0.32_0.08_260)] hover:bg-[oklch(0.11_0.02_260/0.8)]">
        {/* Top glow line on hover */}
        <div
          className="absolute top-0 left-4 right-4 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-700"
          style={{ background: `linear-gradient(90deg, transparent, ${step.color}, transparent)` }}
        />

        {/* Step number + icon */}
        <div className="flex items-center justify-between mb-6">
          <span
            className="font-display font-bold text-4xl opacity-15"
            style={{ color: step.color }}
          >
            {step.number}
          </span>
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center border transition-all duration-500"
            style={{
              borderColor: `color-mix(in oklch, ${step.color} 25%, transparent)`,
              backgroundColor: `color-mix(in oklch, ${step.color} 6%, transparent)`,
            }}
          >
            <step.icon className="w-5 h-5" style={{ color: step.color }} />
          </div>
        </div>

        <h3 className="font-display font-bold text-xl sm:text-2xl text-foreground mb-3">
          {step.title}
        </h3>
        <p className="text-muted-foreground text-sm leading-relaxed mb-6">
          {step.description}
        </p>

        {/* Detail steps */}
        <div className="space-y-2.5">
          {step.details.map((detail, i) => (
            <motion.div
              key={detail}
              initial={{ opacity: 0, x: -10 }}
              animate={isInView ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 0.4, delay: index * 0.15 + i * 0.08 + 0.3 }}
              className="flex items-center gap-2.5"
            >
              <CheckCircle2
                className="w-3.5 h-3.5 shrink-0"
                style={{ color: step.color }}
              />
              <span className="text-sm text-foreground/70">{detail}</span>
            </motion.div>
          ))}
        </div>

        {/* Optional link */}
        {step.link && (
          <a
            href={step.link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 mt-5 text-xs font-medium transition-colors duration-300 hover:opacity-80"
            style={{ color: step.color }}
          >
            <span>前往使用</span>
            <ArrowRight className="w-3 h-3" />
          </a>
        )}
      </div>
    </motion.div>
  );
}

export default function WorkflowSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  return (
    <section id="workflow" className="relative py-24 sm:py-32 overflow-hidden">
      {/* Background image */}
      <div className="absolute inset-0 opacity-15">
        <img src={WORKFLOW_BG} alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-[oklch(0.08_0.015_260)] via-transparent to-[oklch(0.08_0.015_260)]" />
      </div>

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
            Workflow
          </span>
          <h2 className="font-display font-bold text-3xl sm:text-4xl md:text-5xl text-foreground mb-5">
            三步完成<span className="text-gradient-blue">专业文案</span>
          </h2>
          <p className="max-w-xl mx-auto text-muted-foreground text-base sm:text-lg leading-relaxed">
            简洁高效的创作流程，从灵感到发布，每一步都有AI为您保驾护航
          </p>
        </motion.div>

        {/* Steps grid */}
        <div className="grid lg:grid-cols-3 gap-6 lg:gap-8 max-w-5xl mx-auto">
          {steps.map((step, i) => (
            <StepCard key={step.number} step={step} index={i} />
          ))}
        </div>

        {/* Bottom summary */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.8, duration: 0.6 }}
          className="text-center mt-14"
        >
          <div className="inline-flex items-center gap-3 px-5 py-2.5 rounded-full border border-[oklch(0.22_0.03_260)] bg-[oklch(0.1_0.02_260/0.8)]">
            <FileText className="w-4 h-4 text-[oklch(0.6_0.2_260)]" />
            <span className="text-sm text-muted-foreground/80">
              创作 → 复制 → 润色 → 发布，就这么简单
            </span>
            <Copy className="w-3.5 h-3.5 text-muted-foreground/40" />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
