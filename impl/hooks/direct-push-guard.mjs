#!/usr/bin/env node
// 直推例外的保護（UserPromptSubmit + PreToolUse：Write / Edit / MultiEdit / NotebookEdit / Bash）
//
// 交付流程的例外：沒下指令的改動，會碰到 business rules、DB schema / migration、API 契約時，
// 要先停下來問使用者，不能照直推一路改到推上去。本 hook 把這條從靠模型自律改成機械檢查：
//
//   1. UserPromptSubmit：記下這則訊息是不是本 marketplace 的指令（/db:migrate、/loop /impl:ship…）
//   2. PreToolUse：這則訊息沒下指令，卻要寫入受保護的檔案、或用 Bash 跑 migration 產生器
//      → 回 permissionDecision: "ask"，跳出確認讓使用者決定；無人看守（claude -p）時視同拒絕
//
// 受保護的檔案：見 CATEGORIES；專案可在 .claude/direct-push-guard.txt 增減（格式見 parseConfig）。
// Bash：用 bash-targets.mjs 找寫入目標，另外比對 migration 產生器指令（prisma migrate、drizzle-kit…）。
// 擋不到的：腳本內部寫檔（python -c、npm script 裡的自訂邏輯）。這是防忘記的閘，不是防繞過的閘。
// 失敗方向：hook 本身出錯一律放行（fail open）。

import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { bashWriteTargets } from './bash-targets.mjs';

const PLUGINS = ['domain', 'arch', 'db', 'api', 'impl', 'ui', 'git', 'security', 'docs'];
const COMMAND_RE = new RegExp(`^/(?:${PLUGINS.join('|')}):[\\w-]+$`);
const CONFIG_FILE = path.join('.claude', 'direct-push-guard.txt');
const STATE_TTL_MS = 7 * 24 * 3600 * 1000;

export const CATEGORIES = {
  rules: {
    label: 'business rules',
    suggest: '/domain:business-rules',
    globs: ['docs/domain/business-rules/**'],
  },
  db: {
    label: 'DB schema / migration',
    suggest: '/db:migrate（要先改設計就先 /db:schema）',
    globs: [
      'docs/db/schema.md',
      '**/migrations/**',
      '**/db/migrate/**',
      '**/alembic/versions/**',
      '**/*.prisma',
      'drizzle/**',
      '**/db/schema.ts',
      '**/db/schema/**',
      '**/schema.rb',
      '**/structure.sql',
    ],
  },
  api: {
    label: 'API 契約',
    suggest: '/api:contract',
    globs: [
      'docs/api/contract.md',
      '**/openapi.yaml',
      '**/openapi.yml',
      '**/openapi.json',
      '**/swagger.yaml',
      '**/swagger.yml',
      '**/swagger.json',
      '**/*.proto',
      '**/*.graphql',
      '**/*.graphqls',
    ],
  },
  other: {
    label: '專案設定的受保護檔案',
    suggest: '對應的指令',
    globs: [],
  },
};

// 會改資料庫結構或產生 migration 的指令
export const MIGRATION_COMMANDS = [
  /\bprisma\s+(migrate|db\s+push)\b/,
  /\bdrizzle-kit\s+(generate|push|migrate|drop)\b/,
  /\bsupabase\s+(migration\s+new|db\s+(push|reset|diff))\b/,
  /\bknex\s+migrate:/,
  /\bsequelize(-cli)?\s+(migration:|db:migrate)/,
  /\btypeorm\b[^\n;&|]*\bmigration:/,
  /\bmikro-orm\b[^\n;&|]*\bmigration:/,
  /\brails\s+(g|generate)\s+migration\b/,
  /\b(rails|rake)\s+db:(migrate|rollback|schema:load|reset)\b/,
  /\balembic\s+(revision|upgrade|downgrade)\b/,
  /\bgoose\b[^\n;&|]*\b(create|up|down|reset)\b/,
  /\bmigrate\s+(create|up|down|force)\b/,
  /\batlas\s+(migrate|schema\s+apply)\b/,
  /\bdbmate\s+(new|up|down|migrate|rollback)\b/,
  /\bflyway\s+(migrate|clean|repair)\b/,
  /\b(npm|pnpm|yarn|bun)\s+(run\s+)?(db:(migrate|push|generate|reset|drop|rollback)[\w:-]*|migrate[\w:-]*|migrations?[\w:-]*)(\s|$)/,
];

// glob → RegExp。支援 **（跨層）、*（單層）、?。
export function globToRegExp(glob) {
  let g = glob.trim().replace(/^\.\//, '');
  if (g.endsWith('/')) g += '**';
  let re = '';
  for (let i = 0; i < g.length; i++) {
    const c = g[i];
    if (c === '*') {
      if (g[i + 1] === '*') {
        i++;
        if (g[i + 1] === '/') {
          i++;
          re += '(?:.*/)?';
        } else {
          re += '.*';
        }
      } else {
        re += '[^/]*';
      }
    } else if (c === '?') {
      re += '[^/]';
    } else {
      re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    }
  }
  return new RegExp(`^${re}$`);
}

// 這則訊息下的指令（/db:migrate、/loop 5m /impl:ship…），沒有就回 null。
export function commandOf(prompt) {
  const tokens = String(prompt ?? '').trim().split(/\s+/);
  if (COMMAND_RE.test(tokens[0])) return tokens[0];
  if (tokens[0] === '/loop') return tokens.slice(1).find((t) => COMMAND_RE.test(t)) ?? null;
  return null;
}

// .claude/direct-push-guard.txt：一行一個 glob。
//   `db: prisma/**` / `api: …` / `rules: …` → 加進該類；不加前綴 → 加進「其他」
//   `!glob` → 這些路徑不保護
//   `off` → 這個專案整個停用（例如專案自己的 CLAUDE.md 規定一律走 PR）
//   `#` 開頭是註解
export function parseConfig(text) {
  const conf = { off: false, add: { rules: [], db: [], api: [], other: [] }, ignore: [] };
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    if (line === 'off') conf.off = true;
    else if (line.startsWith('!')) conf.ignore.push(line.slice(1).trim());
    else {
      const m = line.match(/^(rules|db|api)\s*:\s*(.+)$/);
      if (m) conf.add[m[1]].push(m[2].trim());
      else conf.add.other.push(line);
    }
  }
  return conf;
}

function loadConfig(projectDir) {
  try {
    return parseConfig(readFileSync(path.join(projectDir, CONFIG_FILE), 'utf8'));
  } catch {
    return parseConfig('');
  }
}

// 這個專案內的相對路徑屬於哪一類受保護檔案；不受保護回 null。
export function classify(projectDir, absPath, conf) {
  const rel = path.relative(projectDir, absPath).split(path.sep).join('/');
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return null;
  if (rel.split('/').includes('node_modules')) return null;
  if (conf.ignore.some((g) => globToRegExp(g).test(rel))) return null;
  for (const [key, cat] of Object.entries(CATEGORIES)) {
    const globs = [...cat.globs, ...conf.add[key]];
    if (globs.some((g) => globToRegExp(g).test(rel))) return { key, rel };
  }
  return null;
}

function stateDir() {
  const base = process.env.CLAUDE_PLUGIN_DATA || path.join(tmpdir(), 'impl-direct-push-guard');
  return path.join(base, 'direct-push-guard');
}

function stateFile(sessionId) {
  return path.join(stateDir(), `${String(sessionId).replace(/[^\w-]/g, '_')}.json`);
}

function writeState(sessionId, state) {
  const dir = stateDir();
  mkdirSync(dir, { recursive: true });
  writeFileSync(stateFile(sessionId), JSON.stringify(state));
}

function readState(input) {
  try {
    const s = JSON.parse(readFileSync(stateFile(input.session_id), 'utf8'));
    if (s.prompt_id && input.prompt_id && s.prompt_id !== input.prompt_id) return null;
    return s;
  } catch {
    return null;
  }
}

// 同一則訊息裡 Claude 用 Skill 載入了哪些 skill（自動觸發的也算）
function recordSkill(input) {
  if (!input.session_id) return;
  const s = readState(input) ?? { prompt_id: input.prompt_id ?? null, command: null, skills: [] };
  s.skills = [...new Set([...(s.skills ?? []), String(input.tool_input?.skill ?? '')])];
  writeState(input.session_id, s);
}

function recordPrompt(input) {
  if (!input.session_id) return;
  const dir = stateDir();
  writeState(input.session_id, { prompt_id: input.prompt_id ?? null, command: commandOf(input.prompt), skills: [], at: Date.now() });
  // 清掉一週前的 session 紀錄
  for (const f of readdirSync(dir)) {
    try {
      const p = path.join(dir, f);
      if (Date.now() - statSync(p).mtimeMs > STATE_TTL_MS) unlinkSync(p);
    } catch {}
  }
}

// 規則文件由 domain 的 skill 寫出來時是「待審查」，之後還有 br-review-gate 把關，所以這一類放行。
// DB 與 API 不放行：改錯的代價高，一定要使用者親手下指令或按允許。
const RULES_SKILL_RE = /^(domain:)?(business-rules|review|model|feedback)$/;

// 回傳要問使用者的理由；不需要問回 null。
export function evaluate({ projectDir, toolName, toolInput, cwd, command, skills = [] }) {
  if (command) return null;
  const conf = loadConfig(projectDir);
  if (conf.off) return null;

  const hits = [];
  let migration = null;
  if (toolName === 'Bash') {
    const cmd = toolInput.command ?? '';
    migration = MIGRATION_COMMANDS.find((re) => re.test(cmd)) ? cmd.split('\n')[0].slice(0, 120) : null;
    for (const t of bashWriteTargets(cmd, cwd || projectDir)) {
      const hit = classify(projectDir, t, conf);
      if (hit) hits.push(hit);
    }
  } else {
    const fp = toolInput.file_path ?? toolInput.notebook_path;
    if (fp) {
      const hit = classify(projectDir, path.resolve(projectDir, fp), conf);
      if (hit) hits.push(hit);
    }
  }
  if (skills.some((s) => RULES_SKILL_RE.test(s))) {
    for (let i = hits.length - 1; i >= 0; i--) if (hits[i].key === 'rules') hits.splice(i, 1);
  }
  if (!hits.length && !migration) return null;

  const keys = [...new Set([...hits.map((h) => h.key), ...(migration ? ['db'] : [])])];
  const what = [
    ...hits.map((h) => `\`${h.rel}\``),
    ...(migration ? [`執行 \`${migration}\`（會產生 migration 或改資料庫結構）`] : []),
  ].join('、');
  return [
    `[impl:direct-push-guard] 這則訊息沒有下指令，但要改到 ${keys.map((k) => CATEGORIES[k].label).join('、')}：${what}。`,
    '交付流程的例外：沒下指令的改動碰到 business rules、DB schema / migration、API 契約時，要先問使用者，不能照直推一路改到推上去。',
    `使用者允許就繼續；被拒絕（或無人看守、沒有人能確認）時，停下來說明這次要改什麼，建議改走 ${keys.map((k) => CATEGORIES[k].suggest).join('、')}，不要換別的方法寫入。`,
  ].join('\n');
}

function main() {
  let input;
  try {
    input = JSON.parse(readFileSync(0, 'utf8'));
  } catch {
    process.exit(0);
  }
  if (input.hook_event_name === 'UserPromptSubmit') {
    try {
      recordPrompt(input);
    } catch {}
    process.exit(0); // 不輸出任何東西：UserPromptSubmit 的 stdout 會被加進對話
  }
  if (input.hook_event_name !== 'PreToolUse') process.exit(0);
  if (input.tool_name === 'Skill') {
    try {
      recordSkill(input);
    } catch {}
    process.exit(0);
  }
  const projectDir = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
  const state = readState(input);
  const reason = evaluate({
    projectDir,
    toolName: input.tool_name,
    toolInput: input.tool_input ?? {},
    cwd: input.cwd,
    command: state?.command ?? null,
    skills: state?.skills ?? [],
  });
  if (reason) {
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'ask', permissionDecisionReason: reason },
      }),
    );
  }
  process.exit(0);
}

if (process.argv[1]?.endsWith('direct-push-guard.mjs')) {
  try {
    main();
  } catch {
    process.exit(0);
  }
}
