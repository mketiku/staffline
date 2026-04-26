#!/usr/bin/env node

import { createWriteStream, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

const mode = process.argv[2];
const repoRoot = process.cwd();

const stepsByMode = {
  'pre-commit': [
    { label: 'lint-staged', command: 'bunx', args: ['lint-staged'] },
  ],
  'pre-push': [
    [
      { label: 'lint', command: 'bun', args: ['run', 'lint'] },
      { label: 'typecheck', command: 'bun', args: ['run', 'typecheck'] },
    ],
    { label: 'tests', command: 'bunx', args: ['vitest', 'run', '--passWithNoTests'] },
  ],
};

function tail(text, lineCount = 80) {
  const lines = text.trimEnd().split(/\r?\n/);
  return lines.slice(Math.max(0, lines.length - lineCount)).join('\n');
}

async function runStep(step, logFile) {
  process.stdout.write(`→ ${step.label}\n`);

  const logStream = createWriteStream(logFile, { flags: 'w' });

  const child = spawn(step.command, step.args, {
    cwd: repoRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: process.env,
    shell: false,
  });

  child.stdout.pipe(logStream, { end: false });
  child.stderr.pipe(logStream, { end: false });

  const exitCode = await new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('close', (code) => resolve(code ?? 1));
  });

  await new Promise((resolve) => logStream.end(resolve));

  if (exitCode !== 0) {
    const log = readFileSync(logFile, 'utf8');
    process.stderr.write(`✖ ${step.label} failed\n`);
    process.stderr.write(`${tail(log)}\n`);
    return false;
  }

  return true;
}

async function collectStdin() {
  if (process.stdin.isTTY) return '';
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => (data += chunk));
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', () => resolve(data));
    setTimeout(() => resolve(data), 200);
  });
}

async function main() {
  if (!mode || !(mode in stepsByMode)) {
    process.stderr.write(
      'Usage: node scripts/run-hook-checks.mjs <pre-commit|pre-push>\n'
    );
    process.exit(1);
  }

  if (mode === 'pre-push') {
    const input = await collectStdin();
    if (input) {
      const lines = input.trim().split('\n');
      let shouldRun = false;
      for (const line of lines) {
        const [, localSha, remoteRef, remoteSha] = line.split(' ');
        if (localSha === '0000000000000000000000000000000000000000') {
          process.stdout.write(`ℹ Skipping checks for deletion of ${remoteRef}\n`);
          continue;
        }
        if (localSha === remoteSha) {
          process.stdout.write(`ℹ Skipping checks: ${remoteRef} is already up to date\n`);
          continue;
        }
        shouldRun = true;
      }
      if (!shouldRun && lines.length > 0) {
        process.stdout.write('✅ Skipping pre-push checks (non-functional push)\n');
        return;
      }
    }
  }

  const logDir = mkdtempSync(join(tmpdir(), 'staffline-hooks-'));
  const logFile = join(logDir, `${mode}.log`);

  try {
    for (const entry of stepsByMode[mode]) {
      if (Array.isArray(entry)) {
        process.stdout.write(
          `→ [parallel] ${entry.map((s) => s.label).join(', ')}\n`
        );
        const results = await Promise.all(
          entry.map((step) => runStep(step, logFile + '.' + step.label))
        );
        if (results.some((ok) => !ok)) process.exit(1);
      } else {
        const ok = await runStep(entry, logFile);
        if (!ok) process.exit(1);
      }
    }
    process.stdout.write(`✅ ${mode} checks passed\n`);
  } finally {
    rmSync(logDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.stack || error.message : String(error)}\n`
  );
  process.exit(1);
});
