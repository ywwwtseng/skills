// 跑法：node --test intent/hooks/requirement-discovery-gate.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { slashRequest } from './requirement-discovery-gate.mjs';

const HOOK = path.join(path.dirname(fileURLToPath(import.meta.url)), 'requirement-discovery-gate.mjs');

function run(input) {
  const r = spawnSync('node', [HOOK], { input: typeof input === 'string' ? input : JSON.stringify(input), encoding: 'utf8' });
  return { code: r.status, out: r.stdout };
}

test('slashRequest：帶參數的 slash 指令才提醒', () => {
  assert.deepEqual(slashRequest('/impl:fix 登入怪怪的'), { command: '/impl:fix', args: '登入怪怪的' });
  assert.deepEqual(slashRequest('  /skills-feedback game-ui:classic-ro\n多行也算 '), {
    command: '/skills-feedback',
    args: 'game-ui:classic-ro\n多行也算',
  });
});

test('slashRequest：不提醒的情況', () => {
  assert.equal(slashRequest('/git:commit'), null, '沒帶參數');
  assert.equal(slashRequest('/git:commit   '), null, '只有空白');
  assert.equal(slashRequest('幫我修登入'), null, '不是 slash 指令');
  assert.equal(slashRequest('不要跑 /impl:fix'), null, '指令不在開頭');
  assert.equal(slashRequest('/loop 5m /impl:ship'), null, '無人看守');
  assert.equal(slashRequest('/intent:requirement-discovery 加匯出'), null, '自己');
  assert.equal(slashRequest('/compact 只留結論'), null, '內建指令');
  assert.equal(slashRequest('/model opus'), null, '內建指令');
  assert.equal(slashRequest('/usr/bin/env 是什麼'), null, '路徑不是指令');
  assert.equal(slashRequest(''), null);
  assert.equal(slashRequest(undefined), null);
});

test('hook：帶參數的指令輸出 additionalContext', () => {
  const { code, out } = run({ hook_event_name: 'UserPromptSubmit', prompt: '/impl:fix 登入怪怪的' });
  assert.equal(code, 0);
  const ctx = JSON.parse(out).hookSpecificOutput;
  assert.equal(ctx.hookEventName, 'UserPromptSubmit');
  assert.match(ctx.additionalContext, /intent:requirement-discovery/);
  assert.match(ctx.additionalContext, /\/impl:fix/);
});

test('hook：其他情況什麼都不輸出', () => {
  for (const input of [
    { hook_event_name: 'UserPromptSubmit', prompt: '/git:commit' },
    { hook_event_name: 'UserPromptSubmit', prompt: '幫我修登入' },
    { hook_event_name: 'PreToolUse', prompt: '/impl:fix 登入' },
    'not json',
  ]) {
    const { code, out } = run(input);
    assert.equal(code, 0);
    assert.equal(out, '');
  }
});
