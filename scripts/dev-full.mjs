import { spawn } from "node:child_process";
import { createConnection } from "node:net";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const nodeModules = resolve(root, "node_modules");
const databaseUrl = "postgresql://postgres:postgres@127.0.0.1:5432/postgres";
const database = spawn(process.execPath, [
  resolve(nodeModules, "@electric-sql/pglite-socket/dist/scripts/server.js"),
  "--db=memory://",
  "--port=5432",
  "--max-connections=10",
], { cwd: root, stdio: "inherit", env: process.env });

function waitForDatabase() {
  return new Promise((resolveReady, reject) => {
    const deadline = Date.now() + 30_000;
    const attempt = () => {
      if (database.exitCode !== null) return reject(new Error("Local database exited before becoming ready."));
      const socket = createConnection({ host: "127.0.0.1", port: 5432 });
      socket.once("connect", () => { socket.destroy(); resolveReady(); });
      socket.once("error", () => {
        socket.destroy();
        if (Date.now() >= deadline) reject(new Error("Timed out waiting for local database on port 5432."));
        else setTimeout(attempt, 250);
      });
    };
    attempt();
  });
}

function runNode(script, args, env = process.env) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(process.execPath, [resolve(nodeModules, script), ...args], { cwd: root, stdio: "inherit", env });
    child.once("error", reject);
    child.once("exit", (code) => code === 0 ? resolveRun() : reject(new Error(`${script} exited with code ${code}`)));
  });
}

let app;
let stopping = false;
function stop(signal = "SIGTERM") {
  if (stopping) return;
  stopping = true;
  app?.kill(signal);
  database.kill(signal);
}

process.once("SIGINT", () => stop("SIGINT"));
process.once("SIGTERM", () => stop("SIGTERM"));

try {
  await waitForDatabase();
  const localEnv = { ...process.env, DATABASE_URL: databaseUrl };
  await runNode("drizzle-kit/bin.cjs", ["push", "--dialect", "postgresql", "--schema", "src/db/schema.ts", "--url", databaseUrl], localEnv);
  app = spawn(process.execPath, [resolve(nodeModules, "next/dist/bin/next"), "dev", "--webpack"], {
    cwd: root,
    stdio: "inherit",
    env: localEnv,
  });
  app.once("error", (error) => { console.error(error); stop(); });
  app.once("exit", (code) => { stop(); process.exitCode = code ?? 1; });
  database.once("exit", (code) => {
    if (!stopping && code !== 0) {
      console.error(`Local database exited with code ${code}.`);
      stop();
      process.exitCode = code ?? 1;
    }
  });
} catch (error) {
  console.error(error);
  stop();
  process.exitCode = 1;
}
