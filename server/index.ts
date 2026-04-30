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
}

startServer().catch((err) => {
  console.error("[server] fatal:", err);
  process.exit(1);
});
