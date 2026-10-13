// 跑法：node --test impl/hooks/direct-push-guard.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { commandOf, evaluate, parseConfig, MIGRATION_COMMANDS } from './direct-push-guard.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const HOOK = path.join(HERE, 'direct-push-guard.mjs');

function project(config) {
  const dir = mkdtempSync(path.join(tmpdir(), 'dpg-'));
  if (config !== undefined) {
    mkdirSync(path.join(dir, '.claude'), { recursive: true });
    writeFileSync(path.join(dir, '.claude/direct-push-guard.txt'), config);
  }
  return dir;
}
const edit = (dir, file, command = null) =>
  evaluate({ projectDir: dir, toolName: 'Edit', toolInput: { file_path: path.join(dir, file) }, cwd: dir, command });
const bash = (dir, cmd, command = null) =>
  evaluate({ projectDir: dir, toolName: 'Bash', toolInput: { command: cmd }, cwd: dir, command });

test('bash-targets.mjs 與 domain 那份相同', () => {
  assert.equal(
    readFileSync(path.join(HERE, 'bash-targets.mjs'), 'utf8'),
    readFileSync(path.join(HERE, '../../domain/hooks/bash-targets.mjs'), 'utf8'),
  );
});

test('commandOf：只認訊息開頭的指令與 /loop 帶的指令', () => {
  assert.equal(commandOf('/db:migrate 加 nickname 欄位'), '/db:migrate');
  assert.equal(commandOf('  /impl:ship'), '/impl:ship');
  assert.equal(commandOf('/loop /impl:ship'), '/impl:ship');
  assert.equal(commandOf('/loop 10m /impl:ship'), '/impl:ship');
  assert.equal(commandOf('幫我加 nickname 欄位'), null);
  assert.equal(commandOf('不要跑 /db:migrate，直接改'), null);
  assert.equal(commandOf('/help'), null);
  assert.equal(commandOf('/other:thing'), null);
});

test('受保護檔案：沒下指令就要問', () => {
  const dir = project();
  for (const f of [
    'prisma/schema.prisma',
    'prisma/migrations/20261013_add/migration.sql',
    'supabase/migrations/001.sql',
    'db/migrate/20261013_add.rb',
    'src/db/schema.ts',
    'drizzle/0001_add.sql',
    'docs/db/schema.md',
    'docs/api/contract.md',
    'openapi.yaml',
    'apps/api/openapi.json',
    'proto/order.proto',
    'docs/domain/business-rules/order.md',
  ]) {
    assert.match(edit(dir, f) ?? '', /direct-push-guard/, f);
  }
});

test('一般程式碼、node_modules、專案外：不問', () => {
  const dir = project();
  for (const f of ['src/orders/cancel.ts', 'README.md', 'node_modules/x/migrations/1.sql', '../other/prisma/schema.prisma']) {
    assert.equal(edit(dir, f), null, f);
  }
});

test('有下指令：不問', () => {
  const dir = project();
  assert.equal(edit(dir, 'prisma/schema.prisma', '/db:migrate'), null);
  assert.equal(bash(dir, 'npx prisma migrate dev --name add', '/impl:ship'), null);
});

test('Bash：寫入受保護檔案或跑 migration 產生器都要問', () => {
  const dir = project();
  assert.match(bash(dir, "cat > prisma/migrations/1/migration.sql <<'EOF'\nALTER TABLE x;\nEOF") ?? '', /migration\.sql/);
  assert.match(bash(dir, "sed -i 's/a/b/' openapi.yaml") ?? '', /API 契約/);
  for (const cmd of [
    'npx prisma migrate dev --name add_nickname',
    'pnpm prisma db push',
    'npx drizzle-kit generate',
    'supabase migration new add_nickname',
    'bin/rails g migration AddNickname',
    'alembic revision --autogenerate -m x',
    'pnpm db:migrate',
    'npm run migrate',
  ]) {
    assert.match(bash(dir, cmd) ?? '', /migration/, cmd);
  }
  for (const cmd of ['npm test', 'npx prisma generate', 'pnpm db:seed', 'git status', 'cat prisma/schema.prisma']) {
    assert.equal(bash(dir, cmd), null, cmd);
  }
  assert.ok(MIGRATION_COMMANDS.length > 10);
});

test('專案設定：off、增加、排除', () => {
  assert.equal(edit(project('off\n'), 'prisma/schema.prisma'), null);
  const dir = project('# 我們的 migration 放這\ndb: server/db/changes/**\n!docs/domain/business-rules/**\ninfra/terraform/**\n');
  assert.match(edit(dir, 'server/db/changes/001.sql') ?? '', /DB schema/);
  assert.match(edit(dir, 'infra/terraform/main.tf') ?? '', /專案設定的受保護檔案/);
  assert.equal(edit(dir, 'docs/domain/business-rules/order.md'), null);
  assert.deepEqual(parseConfig('api: a/**\n').add.api, ['a/**']);
});

test('整支 hook：同一則訊息的指令會放行，下一則訊息沒指令就要問', () => {
  const dir = project();
  const data = mkdtempSync(path.join(tmpdir(), 'dpg-data-'));
  const run = (payload) =>
    spawnSync('node', [HOOK], {
      input: JSON.stringify({ session_id: 's1', cwd: dir, ...payload }),
      env: { ...process.env, CLAUDE_PROJECT_DIR: dir, CLAUDE_PLUGIN_DATA: data },
      encoding: 'utf8',
    });
  const write = (prompt_id) =>
    run({ hook_event_name: 'PreToolUse', prompt_id, tool_name: 'Write', tool_input: { file_path: path.join(dir, 'prisma/schema.prisma') } });

  assert.equal(run({ hook_event_name: 'UserPromptSubmit', prompt_id: 'p1', prompt: '/db:migrate 加欄位' }).stdout, '');
  assert.equal(write('p1').stdout, '');

  run({ hook_event_name: 'UserPromptSubmit', prompt_id: 'p2', prompt: '再幫我加一個 avatar 欄位' });
  const out = JSON.parse(write('p2').stdout);
  assert.equal(out.hookSpecificOutput.permissionDecision, 'ask');
  assert.match(out.hookSpecificOutput.permissionDecisionReason, /\/db:migrate/);

  // 沒有紀錄（例如 hook 剛裝上）→ 視為沒下指令
  const fresh = spawnSync('node', [HOOK], {
    input: JSON.stringify({ session_id: 'never', cwd: dir, hook_event_name: 'PreToolUse', tool_name: 'Edit', tool_input: { file_path: path.join(dir, 'openapi.yaml') } }),
    env: { ...process.env, CLAUDE_PROJECT_DIR: dir, CLAUDE_PLUGIN_DATA: data },
    encoding: 'utf8',
  });
  assert.equal(JSON.parse(fresh.stdout).hookSpecificOutput.permissionDecision, 'ask');
});

test('domain skill 寫規則文件不問；DB / API 不因 skill 放行', () => {
  const dir = project();
  const rules = { toolName: 'Write', toolInput: { file_path: path.join(dir, 'docs/domain/business-rules/a.md') } };
  assert.equal(evaluate({ projectDir: dir, cwd: dir, command: null, skills: ['domain:business-rules'], ...rules }), null);
  assert.equal(evaluate({ projectDir: dir, cwd: dir, command: null, skills: ['review'], ...rules }), null);
  assert.notEqual(evaluate({ projectDir: dir, cwd: dir, command: null, skills: ['git:commit'], ...rules }), null);
  const schema = { toolName: 'Edit', toolInput: { file_path: path.join(dir, 'prisma/schema.prisma') } };
  assert.notEqual(evaluate({ projectDir: dir, cwd: dir, command: null, skills: ['db:migrate', 'domain:feedback'], ...schema }), null);
});

test('整支 hook：同一則訊息裡載入 domain skill 後寫規則文件不問，下一則訊息重新計算', () => {
  const dir = project();
  const data = mkdtempSync(path.join(tmpdir(), 'dpg-data-'));
  const run = (payload) =>
    spawnSync('node', [HOOK], {
      input: JSON.stringify({ session_id: 's2', cwd: dir, ...payload }),
      env: { ...process.env, CLAUDE_PROJECT_DIR: dir, CLAUDE_PLUGIN_DATA: data },
      encoding: 'utf8',
    });
  const writeRules = (prompt_id) =>
    run({ hook_event_name: 'PreToolUse', prompt_id, tool_name: 'Write', tool_input: { file_path: path.join(dir, 'docs/domain/business-rules/a.md') } });
  run({ hook_event_name: 'UserPromptSubmit', prompt_id: 'q1', prompt: '幫我整理取消訂單的規則' });
  assert.equal(run({ hook_event_name: 'PreToolUse', prompt_id: 'q1', tool_name: 'Skill', tool_input: { skill: 'domain:business-rules' } }).stdout, '');
  assert.equal(writeRules('q1').stdout, '');
  run({ hook_event_name: 'UserPromptSubmit', prompt_id: 'q2', prompt: '把 BR-ORD-001 改成部分出貨也可以取消' });
  assert.equal(JSON.parse(writeRules('q2').stdout).hookSpecificOutput.permissionDecision, 'ask');
});

test('整支 hook：輸入壞掉 → 放行（fail open）', () => {
  const r = spawnSync('node', [HOOK], { input: 'nope', encoding: 'utf8' });
  assert.equal(r.status, 0);
  assert.equal(r.stdout, '');
});
