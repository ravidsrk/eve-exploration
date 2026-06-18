// @lab/superserve-backend — a custom eve SandboxBackend backed by SuperServe
// (Firecracker microVMs with persistent, resumable filesystems).
//
// Why this exists: on hosts without Docker or KVM, eve's local sandbox backends
// (docker / microsandbox) can't run, and vercel() needs a Vercel deployment.
// This backend gives eve real-binary code execution locally by running the
// sandbox on SuperServe, and powers durable resume by reconnecting to the same
// VM across turns / process restarts.
//
// Implements the public SandboxBackend interface: { name, prewarm, create }.
// See RESEARCH.md ("SuperServe integration") and scratchpad for the design.

import { Sandbox } from "@superserve/sdk";
import { buildSuperserveSession } from "./session.js";

const BACKEND_NAME = "superserve";

// prewarm runs at build time; create runs at runtime. In `eve dev` both happen in
// one process, so we stash bootstrap/seed work here and replay it on first create.
// (SuperServe 0.7.4's TS SDK exposes fromTemplate/fromSnapshot but no snapshot-create
// from files, so eve's build-time template/seed mechanism doesn't map cleanly — we
// seed per-session instead. Documented as a sharp edge in FINDINGS.md.)
const prewarmStore = new Map();

function mapNetwork(policy) {
  if (!policy || policy === "allow-all") return undefined;
  if (policy === "deny-all") return { denyOut: ["0.0.0.0/0"] };
  // Object form: { allow?: string[], subnets?: { deny?: string[] } }
  const cfg = {};
  if (Array.isArray(policy.allow)) cfg.allowOut = policy.allow;
  else if (policy.allow && typeof policy.allow === "object") cfg.allowOut = Object.keys(policy.allow);
  if (policy.subnets?.deny) cfg.denyOut = policy.subnets.deny;
  return Object.keys(cfg).length ? cfg : undefined;
}

function sanitizeName(s) {
  return ("eve-" + String(s)).replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 60);
}

/**
 * @param {object} [opts]
 * @param {string|object} [opts.fromTemplate] SuperServe template name/UUID to boot from.
 * @param {number} [opts.timeoutSeconds] Active-lifetime before auto-pause (default 1800).
 * @param {Record<string,string>} [opts.envVars] Env vars injected into the sandbox.
 * @param {string|object} [opts.networkPolicy] eve network policy applied at create.
 * @param {boolean} [opts.killOnDispose] kill (vs pause) the VM when a session disposes.
 */
export function superserveBackend(opts = {}) {
  const timeoutSeconds = opts.timeoutSeconds ?? 1800;

  return {
    name: BACKEND_NAME,

    async prewarm(input) {
      prewarmStore.set(input.templateKey, {
        bootstrap: input.bootstrap,
        seedFiles: input.seedFiles ?? [],
      });
      input.log?.(`superserve: captured prewarm for template ${input.templateKey} (seeded at first create)`);
      return { reused: false };
    },

    async create(input) {
      const existingId = input.existingMetadata?.superserveSandboxId;
      let sandbox = null;
      let reconnected = false;

      if (existingId) {
        try {
          sandbox = await Sandbox.connect(existingId);
          reconnected = true;
        } catch {
          sandbox = null; // VM gone — fall through to create a fresh one
        }
      }

      if (!sandbox) {
        sandbox = await Sandbox.create({
          name: sanitizeName(input.sessionKey),
          fromTemplate: opts.fromTemplate,
          timeoutSeconds,
          envVars: opts.envVars,
          network: mapNetwork(opts.networkPolicy),
          metadata: {
            ...(input.tags || {}),
            eveSessionKey: String(input.sessionKey).slice(0, 200),
          },
        });
        await sandbox.commands.run("mkdir -p /workspace");
      }

      const session = buildSuperserveSession(sandbox, input.sessionKey, async (policy) => {
        await sandbox.update({ network: mapNetwork(policy) });
      });

      // Seed + bootstrap on first creation of a fresh VM (not on reconnect).
      if (!reconnected) {
        const stored = input.templateKey ? prewarmStore.get(input.templateKey) : undefined;
        if (stored) {
          if (typeof stored.bootstrap === "function") {
            await stored.bootstrap({ use: async () => session });
          }
          for (const f of stored.seedFiles) {
            await session.writeTextFile({
              path: f.path,
              content: typeof f.content === "string" ? f.content : Buffer.from(f.content).toString("utf-8"),
            });
          }
        }
      }

      return {
        session,
        useSessionFn: async (useOpts) => {
          if (useOpts?.networkPolicy) {
            await sandbox.update({ network: mapNetwork(useOpts.networkPolicy) });
          }
          return session;
        },
        async captureState() {
          return {
            backendName: BACKEND_NAME,
            metadata: { superserveSandboxId: sandbox.id },
            sessionKey: input.sessionKey,
          };
        },
        async dispose() {
          try {
            if (opts.killOnDispose) await sandbox.kill();
            else await sandbox.pause(); // preserve /workspace for durable resume
          } catch {
            /* best-effort */
          }
        },
      };
    },
  };
}

export default superserveBackend;
