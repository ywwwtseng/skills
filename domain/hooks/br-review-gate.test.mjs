// 跑法：node --test domain/hooks/br-review-gate.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { evaluate, parseHeader, globToRegExp } from './br-review-gate.mjs';

const HOOK = path.join(path.dirname(fileURLToPath(import.meta.url)), 'br-review-gate.mjs');

function project(docs) {
  const dir = mkdtempSync(path.join(tmpdir(), 'br-gate-'));
  if (docs) {
    const rules = path.join(dir, 'docs/domain/business-rules');
    mkdirSync(rules, { recursive: true });
    for (const [name, header] of Object.entries(docs)) {
      writeFileSync(path.join(rules, name), `# Business Rules — ${name}\n\n${header}\n\n## 問題與目標\n…\n`);
    }
  }
  return dir;
}

const pending = '> 產生日期：2026-10-13 ｜ 版本：1 ｜ 狀態：待審查';
const reviewed = '> 產生日期：2026-10-13 ｜ 版本：1 ｜ 狀態：已審查（2026-10-13）';

test('parseHeader 讀狀態與影響範圍', () => {
  assert.deepEqual(parseHeader(`${pending}\n> 影響範圍：\`src/orders/**\`, \`src/billing/*.ts\``), {
    status: '待審查',
    scope: ['src/orders/**', 'src/billing/*.ts'],
  });
  assert.deepEqual(parseHeader(reviewed).status, '已審查（2026-10-13）');
  assert.deepEqual(parseHeader('# 沒有標頭').status, null);
  assert.deepEqual(parseHeader('> 影響範圍：src/a/**、src/b/**').scope, ['src/a/**', 'src/b/**']);
  assert.deepEqual(parseHeader('> 影響範圍：未定').scope, []);
});

test('globToRegExp', () => {
  assert.ok(globToRegExp('src/orders/**').test('src/orders/a/b.ts'));
  assert.ok(globToRegExp('src/**/order.ts').test('src/order.ts'));
  assert.ok(globToRegExp('src/*.ts').test('src/a.ts'));
  assert.ok(!globToRegExp('src/*.ts').test('src/x/a.ts'));
  assert.ok(globToRegExp('src/orders/').test('src/orders/a.ts'));
});

test('沒有規則目錄 → 放行', () => {
  assert.equal(evaluate(project(), 'src/a.ts'), null);
});

test('全部已審查（含舊格式已確認）→ 放行', () => {
  const dir = project({ 'a.md': reviewed, 'b.md': '> 狀態：已確認' });
  assert.equal(evaluate(dir, 'src/a.ts'), null);
});

test('待審查、沒寫影響範圍 → 擋所有原始碼', () => {
  const dir = project({ 'order.md': pending });
  const r = evaluate(dir, path.join(dir, 'src/anything.ts'));
  assert.match(r, /order\.md/);
  assert.match(r, /\/domain:review/);
});

test('審查中、草稿、沒有狀態都視為未審', () => {
  for (const h of ['> 狀態：審查中', '> 狀態：草稿', '']) {
    assert.notEqual(evaluate(project({ 'x.md': h }), 'src/a.ts'), null, h);
  }
});

test('有影響範圍 → 只擋範圍內', () => {
  const dir = project({ 'order.md': `${pending}\n> 影響範圍：\`src/orders/**\`` });
  assert.notEqual(evaluate(dir, 'src/orders/service.ts'), null);
  assert.equal(evaluate(dir, 'src/billing/service.ts'), null);
});

test('豁免：.md、docs/、.claude/、專案外', () => {
  const dir = project({ 'order.md': pending });
  for (const f of ['README.md', 'docs/impl/x/plan.md', 'docs/domain/business-rules/order.md', '.claude/settings.json', '/etc/hosts', '../other/a.ts']) {
    assert.equal(evaluate(dir, f), null, f);
  }
});

test('整支 hook：擋下時輸出 deny JSON，放行時沒有輸出', () => {
  const dir = project({ 'order.md': pending });
  const run = (file) =>
    spawnSync('node', [HOOK], {
      input: JSON.stringify({ hook_event_name: 'PreToolUse', tool_name: 'Edit', cwd: dir, tool_input: { file_path: path.join(dir, file) } }),
      env: { ...process.env, CLAUDE_PROJECT_DIR: dir },
      encoding: 'utf8',
    });
  const denied = run('src/a.ts');
  assert.equal(denied.status, 0);
  const out = JSON.parse(denied.stdout);
  assert.equal(out.hookSpecificOutput.permissionDecision, 'deny');
  const allowed = run('README.md');
  assert.equal(allowed.status, 0);
  assert.equal(allowed.stdout, '');
});

test('整支 hook：Bash 寫入範圍內的檔案也會被擋', () => {
  const dir = project({ 'order.md': `${pending}\n> 影響範圍：\`src/orders/**\`` });
  const run = (command) =>
    spawnSync('node', [HOOK], {
      input: JSON.stringify({ hook_event_name: 'PreToolUse', tool_name: 'Bash', cwd: dir, tool_input: { command } }),
      env: { ...process.env, CLAUDE_PROJECT_DIR: dir },
      encoding: 'utf8',
    });
  for (const cmd of ["cat > src/orders/cancel.ts <<'EOF'\nexport {}\nEOF", "sed -i 's/a/b/' src/orders/order.ts", 'cd src/orders && touch x.ts']) {
    const r = run(cmd);
    assert.equal(JSON.parse(r.stdout).hookSpecificOutput.permissionDecision, 'deny', cmd);
    assert.match(r.stdout, /Bash/);
  }
  for (const cmd of ['npm test 2>&1 | tail', 'echo x > src/billing/a.ts', 'cat src/orders/order.ts', 'echo x > docs/note.md']) {
    assert.equal(run(cmd).stdout, '', cmd);
  }
});

test('整支 hook：輸入壞掉 → 放行（fail open）', () => {
  const r = spawnSync('node', [HOOK], { input: 'not json', encoding: 'utf8' });
  assert.equal(r.status, 0);
  assert.equal(r.stdout, '');
});
