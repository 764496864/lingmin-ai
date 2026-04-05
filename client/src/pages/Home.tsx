/**
 * Home — 灵敏AI 文案创作助手 主页
 * Design: 「暗夜星河」赛博奢华风
 * 
 * 页面结构：
 * 1. 粒子背景 (全局)
 * 2. 导航栏 (固定顶部)
 * 3. Hero区域 (全屏沉浸式)
 * 4. 工具展示 (双引擎智能体卡片)
 * 5. 工作流程 (三步引导)
 * 6. 核心优势 (六大特性)
 * 7. 即将上线 (更多AI助手预告)
 * 8. 微信引导 (添加微信获取更多)
 * 9. 底部CTA + Footer
 */
import ComingSoonSection from "@/components/ComingSoonSection";
import FeaturesSection from "@/components/FeaturesSection";
import FooterSection from "@/components/FooterSection";
import HeroSection from "@/components/HeroSection";
import Navbar from "@/components/Navbar";
import ParticleBackground from "@/components/ParticleBackground";
import ToolsSection from "@/components/ToolsSection";
import WechatSection from "@/components/WechatSection";
import WorkflowSection from "@/components/WorkflowSection";

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground" style={{ backgroundColor: 'oklch(0.08 0.015 260)', color: 'oklch(0.93 0.005 260)' }}>
      <ParticleBackground />
      <Navbar />
      <main className="relative z-10">
        <HeroSection />
        <ToolsSection />
        <WorkflowSection />
        <FeaturesSection />
        <ComingSoonSection />
        <WechatSection />
        <FooterSection />
      </main>
    </div>
  );
}
