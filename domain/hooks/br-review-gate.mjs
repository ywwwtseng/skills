#!/usr/bin/env node
// business rules review gate（PreToolUse：Write / Edit / MultiEdit / NotebookEdit / Bash）
//
// 規則：business rules 在開始實作前必須經過一次 /domain:review。
// 本 hook 把這條從「靠模型自律」改成機械檢查：
//   docs/domain/business-rules/*.md 裡有狀態不是「已審查」（或舊格式「已確認」）的文件時，
//   擋下對原始碼的寫入，請 Claude 先跑 /domain:review。
//
// 範圍判斷：
//   - 文件標頭有「影響範圍：`glob`, `glob`」→ 只擋改到這些路徑的寫入
//   - 沒寫影響範圍 → 不知道它影響哪裡，保守擋所有原始碼寫入
//
// 不擋：任何 .md / .mdx 檔、docs/ 與 .claude/ 底下、專案目錄以外的檔案。
// 沒有 docs/domain/business-rules/ 的專案：完全不檢查。
//
// Bash：用 bash-targets.mjs 找出指令會寫入的檔案（重導向、tee、sed -i、cp / mv、rm、touch…）再套同樣的判斷。
// 擋不到的：腳本內部寫檔（python -c、node -e、npm script）、git apply / patch。這是防忘記的閘，不是防繞過的閘：
//   模型直接把狀態改成「已審查」或自己補影響範圍，hook 也分不出來。
// 失敗方向：hook 本身出錯（讀不到輸入、例外）一律放行（fail open），不讓壞掉的閘卡住所有工作。

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { bashWriteTargets } from './bash-targets.mjs';

const RULES_DIR = path.join('docs', 'domain', 'business-rules');
const HEADER_LINES = 15;
// 影響範圍寫這些值時視同沒寫（擋所有原始碼）
const PLACEHOLDERS = new Set(['無', '未定', '待定', '-', '—', 'TBD']);

function allow() {
  process.exit(0);
}

function deny(reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: reason,
      },
    }),
  );
  process.exit(0);
}

// glob → RegExp。支援 **（跨層）、*（單層）、?；其餘字元照字面比對。
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

// 讀規則文件標頭：狀態與影響範圍。
export function parseHeader(text) {
  const head = text.split(/\r?\n/).slice(0, HEADER_LINES).join('\n');
  const statusMatch = head.match(/狀態\s*[:：]\s*([^\s｜|`]+)/);
  const status = statusMatch ? statusMatch[1] : null;

  let scope = [];
  const scopeMatch = head.match(/影響範圍\s*[:：]\s*([^\n｜|]*)/);
  if (scopeMatch) {
    const raw = scopeMatch[1].trim();
    const ticked = [...raw.matchAll(/`([^`]+)`/g)].map((m) => m[1].trim());
    scope = (ticked.length ? ticked : raw.split(/[,，、\s]+/))
      .map((s) => s.trim())
      .filter((s) => s && !PLACEHOLDERS.has(s));
  }
  return { status, scope };
}

export function isReviewed(status) {
  return !!status && (status.startsWith('已審查') || status.startsWith('已確認'));
}

export function isExempt(rel) {
  if (/\.mdx?$/i.test(rel)) return true;
  return rel.startsWith('docs/') || rel.startsWith('.claude/');
}

// 回傳擋下的理由；放行時回傳 null。
export function evaluate(projectDir, filePath) {
  if (!filePath) return null;
  const abs = path.resolve(projectDir, filePath);
  const rel = path.relative(projectDir, abs).split(path.sep).join('/');
  if (rel.startsWith('..') || path.isAbsolute(rel)) return null;
  if (isExempt(rel)) return null;

  const dir = path.join(projectDir, RULES_DIR);
  let files;
  try {
    files = readdirSync(dir).filter((f) => f.endsWith('.md'));
  } catch {
    return null;
  }

  const blocking = [];
  for (const f of files.sort()) {
    let text;
    try {
      text = readFileSync(path.join(dir, f), 'utf8');
    } catch {
      continue;
    }
    const { status, scope } = parseHeader(text);
    if (isReviewed(status)) continue;
    if (scope.length && !scope.some((g) => globToRegExp(g).test(rel))) continue;
    blocking.push({ file: `${RULES_DIR.split(path.sep).join('/')}/${f}`, status: status ?? '沒有狀態', scoped: scope.length > 0 });
  }
  if (!blocking.length) return null;

  const list = blocking
    .map((b) => `- ${b.file}（狀態：${b.status}${b.scoped ? '' : '，沒寫影響範圍，視為影響全部原始碼'}）`)
    .join('\n');
  return [
    `[domain:br-review-gate] 擋下對 ${rel} 的寫入：下列 business rules 還沒經過 /domain:review，裡面的假設使用者還沒逐條確認過。`,
    list,
    '',
    '下一步：停止實作，告訴使用者這件事，建議先跑 /domain:review（逐條請使用者裁定；不要自己把狀態改成已審查）。',
    '如果這次的修改跟上述規則無關：請使用者確認該文件的影響範圍，在標頭加一行「> 影響範圍：`src/<模組>/**`」，不要自行判定後補上。',
  ].join('\n');
}

function main() {
  let input;
  try {
    input = JSON.parse(readFileSync(0, 'utf8'));
  } catch {
    allow();
  }
  const ti = input.tool_input ?? {};
  const projectDir = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
  if (input.tool_name === 'Bash') {
    for (const target of bashWriteTargets(ti.command ?? '', input.cwd || projectDir)) {
      const reason = evaluate(projectDir, target);
      if (reason) deny(`${reason}\n（這次是 Bash 指令要寫入該檔案；改用別的指令或腳本寫入同樣會被擋。）`);
    }
    allow();
  }
  const reason = evaluate(projectDir, ti.file_path ?? ti.notebook_path);
  if (reason) deny(reason);
  allow();
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('br-review-gate.mjs')) {
  try {
    main();
  } catch {
    allow();
  }
}
