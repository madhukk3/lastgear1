import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_START_TIME = Date.now();

function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${Math.round((bytes / (1024 ** index)) * 100) / 100} ${units[index]}`;
}

function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

function parseAllowedHosts(rawHosts) {
  if (!rawHosts) {
    return ["localhost", "127.0.0.1"];
  }

  return rawHosts
    .split(",")
    .map((host) => host.trim())
    .filter(Boolean);
}

function createHealthPlugin(enabled) {
  const status = {
    state: "idle",
    errors: [],
    warnings: [],
    lastCompileTime: null,
    lastSuccessTime: null,
    compileDuration: 0,
    totalCompiles: 0,
    firstCompileTime: null,
  };

  const markCompiling = () => {
    const now = Date.now();
    status.state = "compiling";
    status.lastCompileTime = now;
    if (!status.firstCompileTime) {
      status.firstCompileTime = now;
    }
  };

  const markSuccess = () => {
    const now = Date.now();
    status.state = "success";
    status.lastSuccessTime = now;
    status.compileDuration = status.lastCompileTime ? now - status.lastCompileTime : 0;
    status.totalCompiles += 1;
    status.errors = [];
    status.warnings = [];
  };

  const markFailure = (error) => {
    const now = Date.now();
    status.state = "failed";
    status.compileDuration = status.lastCompileTime ? now - status.lastCompileTime : 0;
    status.totalCompiles += 1;
    status.errors = [
      {
        message: error?.message || String(error),
        stack: error?.stack || null,
      },
    ];
    status.warnings = [];
  };

  const getStatus = () => ({
    ...status,
    isHealthy: status.state === "success",
    errorCount: status.errors.length,
    warningCount: status.warnings.length,
    hasCompiled: status.totalCompiles > 0,
  });

  const getSimpleStatus = () => ({
    state: status.state,
    isHealthy: status.state === "success",
    errorCount: status.errors.length,
    warningCount: status.warnings.length,
  });

  return {
    name: "vite-health-check",
    buildStart() {
      markCompiling();
    },
    buildEnd(error) {
      if (error) {
        markFailure(error);
      } else {
        markSuccess();
      }
    },
    configureServer(server) {
      if (!enabled) {
        return;
      }

      const originalTransformRequest = server.transformRequest.bind(server);

      server.transformRequest = async (...args) => {
        markCompiling();
        try {
          const result = await originalTransformRequest(...args);
          markSuccess();
          return result;
        } catch (error) {
          markFailure(error);
          throw error;
        }
      };

      server.watcher.on("change", markCompiling);
      server.watcher.on("add", markCompiling);
      server.watcher.on("unlink", markCompiling);

      server.middlewares.use((req, res, next) => {
        const currentStatus = getStatus();
        const uptime = Date.now() - SERVER_START_TIME;
        const memUsage = process.memoryUsage();

        if (req.url === "/health") {
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({
            status: currentStatus.isHealthy ? "healthy" : "unhealthy",
            timestamp: new Date().toISOString(),
            uptime: {
              seconds: Math.floor(uptime / 1000),
              formatted: formatDuration(uptime),
            },
            vite: {
              state: currentStatus.state,
              isHealthy: currentStatus.isHealthy,
              hasCompiled: currentStatus.hasCompiled,
              errors: currentStatus.errorCount,
              warnings: currentStatus.warningCount,
              lastCompileTime: currentStatus.lastCompileTime
                ? new Date(currentStatus.lastCompileTime).toISOString()
                : null,
              lastSuccessTime: currentStatus.lastSuccessTime
                ? new Date(currentStatus.lastSuccessTime).toISOString()
                : null,
              compileDuration: currentStatus.compileDuration
                ? `${currentStatus.compileDuration}ms`
                : null,
              totalCompiles: currentStatus.totalCompiles,
              firstCompileTime: currentStatus.firstCompileTime
                ? new Date(currentStatus.firstCompileTime).toISOString()
                : null,
            },
            server: {
              nodeVersion: process.version,
              platform: os.platform(),
              arch: os.arch(),
              cpus: os.cpus().length,
              memory: {
                heapUsed: formatBytes(memUsage.heapUsed),
                heapTotal: formatBytes(memUsage.heapTotal),
                rss: formatBytes(memUsage.rss),
                external: formatBytes(memUsage.external),
              },
              systemMemory: {
                total: formatBytes(os.totalmem()),
                free: formatBytes(os.freemem()),
                used: formatBytes(os.totalmem() - os.freemem()),
              },
            },
            environment: process.env.NODE_ENV || "development",
          }));
          return;
        }

        if (req.url === "/health/simple") {
          const simpleStatus = getSimpleStatus();
          const body = simpleStatus.state === "success"
            ? "OK"
            : simpleStatus.state === "compiling"
              ? "COMPILING"
              : simpleStatus.state === "idle"
                ? "IDLE"
                : "ERROR";
          res.statusCode = simpleStatus.state === "failed" ? 503 : 200;
          res.end(body);
          return;
        }

        if (req.url === "/health/ready") {
          const simpleStatus = getSimpleStatus();
          const ready = simpleStatus.state === "success";
          res.statusCode = ready ? 200 : 503;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({
            ready,
            state: simpleStatus.state,
            reason: ready
              ? null
              : simpleStatus.state === "compiling"
                ? "Compilation in progress"
                : "Compilation failed",
          }));
          return;
        }

        if (req.url === "/health/live") {
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({
            alive: true,
            timestamp: new Date().toISOString(),
          }));
          return;
        }

        if (req.url === "/health/errors") {
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({
            errorCount: currentStatus.errorCount,
            warningCount: currentStatus.warningCount,
            errors: currentStatus.errors,
            warnings: currentStatus.warnings,
            state: currentStatus.state,
          }));
          return;
        }

        if (req.url === "/health/stats") {
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({
            totalCompiles: currentStatus.totalCompiles,
            averageCompileTime: currentStatus.totalCompiles > 0
              ? `${Math.round(uptime / currentStatus.totalCompiles)}ms`
              : null,
            lastCompileDuration: currentStatus.compileDuration
              ? `${currentStatus.compileDuration}ms`
              : null,
            firstCompileTime: currentStatus.firstCompileTime
              ? new Date(currentStatus.firstCompileTime).toISOString()
              : null,
            serverUptime: formatDuration(uptime),
          }));
          return;
        }

        next();
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, "");
  const enableHealthCheck = env.ENABLE_HEALTH_CHECK === "true";

  return {
    plugins: [
      react(),
      createHealthPlugin(enableHealthCheck),
    ],
    // The existing codebase keeps JSX in .js files; Vite needs this loader
    // hint so we can migrate without renaming the component tree.
    esbuild: {
      loader: "jsx",
      include: /src\/.*\.[jt]sx?$/,
      exclude: [],
    },
    optimizeDeps: {
      entries: ["index.html"],
      esbuildOptions: {
        loader: {
          ".js": "jsx",
        },
      },
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
      },
    },
    server: {
      host: env.HOST || "127.0.0.1",
      allowedHosts: parseAllowedHosts(env.ALLOWED_HOSTS),
      watch: {
        ignored: [
          "**/node_modules/**",
          "**/.git/**",
          "**/build/**",
          "**/dist/**",
          "**/coverage/**",
        ],
      },
    },
    preview: {
      host: env.HOST || "127.0.0.1",
    },
  };
});
