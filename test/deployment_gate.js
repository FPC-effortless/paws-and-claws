const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const { buildCommand } = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'pnc-deploy-gate-'));
try {
  const log = path.join(temporary, 'calls.jsonl');
  const fakeNpm = path.join(temporary, 'npm');
  fs.writeFileSync(fakeNpm, `#!${process.execPath}\n` +
    `const fs = require('node:fs');\n` +
    `const args = process.argv.slice(2);\n` +
    `fs.appendFileSync(process.env.GATE_LOG, JSON.stringify(args) + '\\n');\n` +
    `process.exit(args[0] === 'test' ? Number(process.env.GATE_TEST_EXIT) : 0);\n`);
  fs.chmodSync(fakeNpm, 0o755);

  for (const exitCode of [1, 0]) {
    fs.writeFileSync(log, '');
    const result = spawnSync(buildCommand, {
      shell: true,
      env: { ...process.env, PATH: temporary + path.delimiter + process.env.PATH, GATE_LOG: log, GATE_TEST_EXIT: String(exitCode) },
      encoding: 'utf8',
    });
    const calls = fs.readFileSync(log, 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
    assert.equal(result.status, exitCode, result.stderr);
    assert.deepEqual(calls, exitCode ? [['test']] : [['test'], ['run', 'test:build']]);
  }
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
console.log('Deployment gate blocks builds after failed tests and validates successful builds.');
