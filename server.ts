/**
 * CIVICEYE AI - Container Gateway & Supervisor
 * Binds to Port 3000 for AI Studio Reverse Proxy & Cloud Run,
 * boots the Python Flask backend on port 5000, and forwards all traffic.
 */

import express from "express";
import http from "http";
import { spawn, ChildProcess } from "child_process";
import path from "path";

const app = express();
const PORT = 3000;
const PYTHON_PORT = 5000;

let pythonProcess: ChildProcess | null = null;
let isPythonReady = false;

function startPythonBackend() {
  console.log(`[Supervisor] Launching Python Flask backend on port ${PYTHON_PORT}...`);
  
  const env = {
    ...process.env,
    PORT: String(PYTHON_PORT),
    PYTHONUNBUFFERED: "1"
  };

  pythonProcess = spawn("python3", ["app.py"], {
    cwd: process.cwd(),
    env,
    stdio: ["ignore", "pipe", "pipe"]
  });

  pythonProcess.stdout?.on("data", (data) => {
    const text = data.toString();
    console.log(`[Flask stdout] ${text.trim()}`);
    if (text.includes("Running on") || text.includes("CIVICEYE AI Flask server running")) {
      isPythonReady = true;
    }
  });

  pythonProcess.stderr?.on("data", (data) => {
    console.error(`[Flask stderr] ${data.toString().trim()}`);
    // Flask development server logs to stderr by default
    if (data.toString().includes("Running on")) {
      isPythonReady = true;
    }
  });

  pythonProcess.on("exit", (code, signal) => {
    console.warn(`[Flask exit] Python process exited with code ${code}, signal ${signal}. Restarting in 2s...`);
    isPythonReady = false;
    setTimeout(startPythonBackend, 2000);
  });
}

// Start Flask process
startPythonBackend();

// Active health check: polls Flask until it responds
function checkHealth() {
  const req = http.get(`http://127.0.0.1:${PYTHON_PORT}/api/auth/status`, (res) => {
    if (res.statusCode === 200) {
      isPythonReady = true;
    }
  });
  req.on("error", () => {
    // Flask not ready yet, continue polling
  });
}
const healthInterval = setInterval(() => {
  if (!isPythonReady) {
    checkHealth();
  }
}, 1000);

// Proxy middleware: streams raw request to Flask and streams response back
app.use((req, res) => {
  const options: http.RequestOptions = {
    hostname: "127.0.0.1",
    port: PYTHON_PORT,
    path: req.url,
    method: req.method,
    headers: {
      ...req.headers,
      host: req.headers.host || `127.0.0.1:${PORT}`,
      "x-forwarded-host": req.headers.host || `127.0.0.1:${PORT}`,
      "x-forwarded-proto": (req.headers["x-forwarded-proto"] as string) || "http"
    }
  };

  const proxyReq = http.request(options, (proxyRes) => {
    // Rewrite internal redirection location headers if any
    const responseHeaders = { ...proxyRes.headers };
    if (responseHeaders.location && typeof responseHeaders.location === "string") {
      responseHeaders.location = responseHeaders.location.replace(/^https?:\/\/127\.0\.0\.1:5000/, "");
    }
    
    isPythonReady = true;
    res.writeHead(proxyRes.statusCode || 200, responseHeaders);
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.on("error", (err) => {
    if (!isPythonReady) {
      res.status(503).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta http-equiv="refresh" content="2">
          <title>CIVICEYE AI - Starting...</title>
          <style>
            body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f8fafc; color: #0f172a; }
            .card { background: white; padding: 2rem; border-radius: 8px; border: 1px solid #e2e8f0; text-align: center; max-width: 420px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
            .spinner { width: 32px; height: 32px; border: 3px solid #e2e8f0; border-top-color: #2563eb; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 1rem auto; }
            @keyframes spin { to { transform: rotate(360deg); } }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="spinner"></div>
            <h2>CIVICEYE AI Initializing</h2>
            <p style="color: #64748b; font-size: 0.9rem;">Booting Python Flask & SQLite engine... Auto-refreshing in 2 seconds.</p>
          </div>
        </body>
        </html>
      `);
    } else {
      console.error("[Proxy Error]", err);
      res.status(502).json({ error: "Bad gateway: could not connect to Flask backend" });
    }
  });

  // Pipe client request body to Flask proxy request
  req.pipe(proxyReq, { end: true });
});

// Start listening on port 3000
const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`[Supervisor] Server active on http://0.0.0.0:${PORT} (proxying to Flask :${PYTHON_PORT})`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  clearInterval(healthInterval);
  if (pythonProcess) pythonProcess.kill("SIGTERM");
  server.close(() => process.exit(0));
});

process.on("SIGINT", () => {
  clearInterval(healthInterval);
  if (pythonProcess) pythonProcess.kill("SIGINT");
  server.close(() => process.exit(0));
});
