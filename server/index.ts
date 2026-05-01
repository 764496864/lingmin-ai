/**
 * server/index.ts — Express 入口
 *
 * 启动：
 *   开发：pnpm dev:server   （tsx watch，自动重启；vite proxy /api → 此进程）
 *   生产：pnpm build && pnpm start
 */

import { config as loadDotenv } from "dotenv";
// 加载 .env.local（与 Vite 共用同一份配置）
loadDotenv({ path: ".env.local" });
loadDotenv({ path: ".env" });

import cors from "cors";
import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";

import apiRouter from "./routes";
import { bootLobster } from "./lobster-rpc";
// 触发 db 模块的 schema 初始化
import "./db";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();

  // ---- CORS：前端走 Cloudflare 上的 lingminai.cn，后端 api.lingminai.cn 是不同 origin ----
  // 允许的 origin 列表通过 ALLOWED_ORIGINS env 覆盖（逗号分隔），缺省为线上 + 本地开发
  const defaultOrigins = [
    "https://lingminai.cn",
    "https://www.lingminai.cn",
    "http://localhost:5173", // vite dev
    "http://localhost:3000", // 同源 SPA fallback
  ];
  const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const origins = allowedOrigins.length > 0 ? allowedOrigins : defaultOrigins;
  app.use(
    cors({
      origin: origins,
      credentials: true,
    }),
  );

  app.use(express.json({ limit: "1mb" }));

  // 启动后台 Lobster 连接（非阻塞，失败会自动重连）
  bootLobster();

  // ---- /api 路由 ----
  app.use("/api", apiRouter);

  // ---- 静态文件 + SPA fallback（生产用） ----
  const staticPath =
    process.env.NODE_ENV === "production"
      ? path.resolve(__dirname, "public")
      : path.resolve(__dirname, "..", "dist", "public");

  app.use(express.static(staticPath));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(staticPath, "index.html"));
  });

  const port = Number(process.env.PORT ?? 3000);
  const server = createServer(app);
  server.listen(port, () => {
    console.log(`[server] listening on http://localhost:${port}/`);
  });

  // ---- 优雅关停：SIGTERM/SIGINT 时停止接受新连接，10s 后强制退出 ----
  function gracefulShutdown(signal: string) {
    console.log(`[server] ${signal} received, shutting down...`);
    server.close(() => {
      console.log("[server] HTTP server closed");
      process.exit(0);
    });
    // 强制超时
    setTimeout(() => {
      console.error("[server] forced shutdown after timeout");
      process.exit(1);
    }, 10_000);
  }

  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
}

startServer().catch((err) => {
  console.error("[server] fatal:", err);
  process.exit(1);
});
