#!/usr/bin/env node
// requirement-discovery-gate（UserPromptSubmit）
//
// 使用者送出「帶參數的 slash 指令」（/impl:fix 登入怪怪的）時，在這一輪加一段提醒：
// 照 skill 的步驟做之前，先載入 /intent:requirement-discovery 判斷要不要先複述理解。
//
// 為什麼要 hook：skill 要等模型自己覺得需要才會載入，而模型最常跳過確認的時候，
// 正好是它以為自己懂了的時候。hook 每次都會跑，判斷標準放在 skill 裡、只寫一處。
//
// 不提醒的情況：
// - 不是 slash 指令開頭的訊息（一般需求交給 skill 自己的 description 觸發）
// - 只有指令沒帶參數（/git:commit）：skill 有固定流程，意圖已經很清楚
// - /loop：無人看守，沒有人能回答
// - /intent:* 本身、Claude Code 內建的指令
//
// hook 本身出錯一律什麼都不輸出（等於放行）。

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const COMMAND_RE = /^\/[A-Za-z0-9_.-]+(?::[A-Za-z0-9_.-]+)?$/;

// 帶參數也不是「需求」的內建指令。
const BUILTINS = new Set([
  'add-dir', 'agents', 'clear', 'compact', 'config', 'context', 'cost', 'effort', 'exit',
  'export', 'fast', 'help', 'hooks', 'login', 'logout', 'mcp', 'memory', 'model',
  'output-style', 'permissions', 'plugin', 'rename', 'resume', 'rewind', 'status',
  'statusline', 'theme', 'vim',
]);

// 這則訊息需要提醒的話回 { command, args }，不需要回 null。
export function slashRequest(prompt) {
  const text = String(prompt ?? '').trim();
  const m = text.match(/^(\S+)\s*([\s\S]*)$/);
  if (!m) return null;
  const [, command, rest] = m;
  if (!COMMAND_RE.test(command)) return null;
  const name = command.slice(1);
  if (name === 'loop' || name.startsWith('intent:') || BUILTINS.has(name)) return null;
  const args = rest.trim();
  if (!args) return null;
  return { command, args };
}

export function reminder({ command }) {
  return [
    `這則訊息是帶參數的 slash 指令（${command}）。`,
    `照 ${command} 的步驟做任何事之前，先用 Skill 工具載入 intent:requirement-discovery，`,
    '照它的標準判斷這次要不要先複述理解：要的話就回覆複述、停下來等使用者確認，',
    `${command} 的步驟一步都還不要做；不用的話直接照 ${command} 做，不必說明你判斷過。`,
  ].join('');
}

function main() {
  let input;
  try {
    input = JSON.parse(readFileSync(0, 'utf8'));
  } catch {
    process.exit(0);
  }
  if (input.hook_event_name !== 'UserPromptSubmit') process.exit(0);
  const req = slashRequest(input.prompt);
  if (!req) process.exit(0);
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: reminder(req) },
    }),
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch {
    process.exit(0);
  }
}
