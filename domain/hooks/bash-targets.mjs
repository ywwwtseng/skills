// 從一行 Bash 指令找出「會寫入或刪除哪些檔案」。
//
// domain/hooks 與 impl/hooks 各放一份，內容必須相同（impl 的測試會比對）；
// 兩個 plugin 安裝後在不同資料夾，無法互相 import。
//
// 這是盡力而為的解析，不是 shell 實作：認得常見的寫檔方式——
//   重導向（> >> &> 2>）、tee、sed -i / perl -i、cp / mv / install / ln / rsync、
//   rm / unlink / touch / truncate / shred、dd of=、bash -c / sh -c 裡面的指令、cd 之後的相對路徑。
// 認不得的（python -c、node -e、腳本內部、git apply、patch 等）不會回報，呼叫端要把這點寫清楚。

import path from 'node:path';

// 移除 heredoc 本文，避免把內容當成指令解析；<<EOF 這個標記本身留著。
function stripHeredocs(cmd) {
  const lines = cmd.split('\n');
  const out = [];
  let pending = [];
  for (const line of lines) {
    if (pending.length) {
      const want = pending[0];
      if (line.trim() === want.tag || (want.dash && line.replace(/^\t+/, '') === want.tag)) pending.shift();
      continue;
    }
    out.push(line);
    for (const m of line.matchAll(/<<(-?)\s*(['"]?)([A-Za-z_][\w-]*)\2/g)) {
      pending.push({ dash: m[1] === '-', tag: m[3] });
    }
  }
  return out.join('\n');
}

// 切成指令片段，每個片段是 token 陣列；處理引號、跳脫與運算子。
function tokenize(cmd) {
  const segments = [];
  let tokens = [];
  let cur = null; // 目前累積中的 token（null 表示還沒開始）
  let i = 0;
  const push = () => {
    if (cur !== null) tokens.push(cur);
    cur = null;
  };
  const endSegment = () => {
    push();
    if (tokens.length) segments.push(tokens);
    tokens = [];
  };
  while (i < cmd.length) {
    const c = cmd[i];
    if (c === "'") {
      const j = cmd.indexOf("'", i + 1);
      cur = (cur ?? '') + cmd.slice(i + 1, j === -1 ? cmd.length : j);
      i = j === -1 ? cmd.length : j + 1;
      continue;
    }
    if (c === '"') {
      let j = i + 1;
      let s = '';
      while (j < cmd.length && cmd[j] !== '"') {
        if (cmd[j] === '\\' && j + 1 < cmd.length) {
          s += cmd[j + 1];
          j += 2;
        } else {
          s += cmd[j++];
        }
      }
      cur = (cur ?? '') + s;
      i = j + 1;
      continue;
    }
    if (c === '\\' && i + 1 < cmd.length) {
      if (cmd[i + 1] !== '\n') cur = (cur ?? '') + cmd[i + 1];
      i += 2;
      continue;
    }
    if (c === '\n' || c === ';' || c === '|' || c === '(' || c === ')') {
      endSegment();
      i++;
      continue;
    }
    if (c === '&') {
      if (cmd[i + 1] === '&') {
        endSegment();
        i += 2;
        continue;
      }
      if (cmd[i + 1] === '>') {
        // &> file / &>> file
        push();
        const op = cmd[i + 2] === '>' ? '&>>' : '&>';
        tokens.push(op);
        i += op.length;
        continue;
      }
      endSegment();
      i++;
      continue;
    }
    if (c === '>' || c === '<') {
      // 數字前綴（2>）併進運算子
      let op = '';
      if (cur !== null && /^\d+$/.test(cur)) {
        op = cur;
        cur = null;
      } else {
        push();
      }
      op += c;
      if (cmd[i + 1] === c) {
        op += c;
        i++;
      }
      if (cmd[i + 1] === '&' || cmd[i + 1] === '|') {
        op += cmd[i + 1];
        i++;
      }
      tokens.push(op);
      i++;
      continue;
    }
    if (c === ' ' || c === '\t') {
      push();
      i++;
      continue;
    }
    cur = (cur ?? '') + c;
    i++;
  }
  endSegment();
  return segments;
}

const WRAPPERS = new Set(['sudo', 'command', 'exec', 'time', 'nohup', 'env', 'xargs']);

function positionals(args, consumesNext = new Set()) {
  const out = [];
  let rest = false;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (rest) {
      out.push(a);
      continue;
    }
    if (a === '--') {
      rest = true;
      continue;
    }
    if (a.startsWith('-') && a.length > 1) {
      if (consumesNext.has(a)) i++;
      continue;
    }
    out.push(a);
  }
  return out;
}

function targetsOfCommand(name, args) {
  switch (name) {
    case 'tee':
      return positionals(args);
    case 'sed': {
      if (!args.some((a) => /^-[a-zA-Z]*i/.test(a) || a.startsWith('--in-place'))) return [];
      const usesE = args.some((a) => a === '-e' || a === '-f' || a === '--expression' || a === '--file');
      const pos = positionals(args, new Set(['-e', '-f', '--expression', '--file']));
      return usesE ? pos : pos.slice(1);
    }
    case 'perl': {
      if (!args.some((a) => /^-[a-zA-Z]*i/.test(a))) return [];
      // -e / -E（含 -pie 這種合併寫法）後面接的是程式，不是檔案
      const consumes = new Set(args.filter((a) => /^-[a-zA-Z]*[eE]$/.test(a)));
      const pos = positionals(args, consumes);
      return consumes.size ? pos : pos.slice(1);
    }
    case 'mv':
      return positionals(args, new Set(['-t', '--target-directory', '-S', '--suffix']));
    case 'cp':
    case 'install':
    case 'ln':
    case 'rsync': {
      const pos = positionals(args, new Set(['-t', '--target-directory', '-m', '--mode', '-o', '-g', '-S', '--suffix', '-e']));
      return pos.length ? [pos[pos.length - 1]] : [];
    }
    case 'rm':
    case 'unlink':
      return positionals(args);
    case 'touch':
      return positionals(args, new Set(['-d', '-t', '-r', '--date', '--reference']));
    case 'shred':
      return positionals(args, new Set(['-n', '-s', '--iterations', '--size']));
    case 'truncate':
      return positionals(args, new Set(['-s', '--size', '-r', '--reference']));
    case 'dd':
      return args.filter((a) => a.startsWith('of=')).map((a) => a.slice(3));
    default:
      return [];
  }
}

/**
 * @param {string} command Bash 指令原文
 * @param {string} cwd 指令執行時的目錄
 * @returns {string[]} 會被寫入或刪除的檔案絕對路徑（去重）
 */
export function bashWriteTargets(command, cwd) {
  const found = new Set();
  walk(command, cwd, found, 0);
  return [...found];
}

function walk(command, cwd, found, depth) {
  if (depth > 3 || typeof command !== 'string') return;
  let base = cwd;
  for (const seg of tokenize(stripHeredocs(command))) {
    const words = [];
    for (let i = 0; i < seg.length; i++) {
      const t = seg[i];
      if (/^(\d*>>?|&>>?|\d*>\|)$/.test(t)) {
        const target = seg[++i];
        if (target && !target.startsWith('&') && target !== '/dev/null' && !/^\/dev\/(stdout|stderr|fd\/)/.test(target)) {
          found.add(path.resolve(base, target));
        }
        continue;
      }
      if (/^\d*>&$/.test(t)) {
        // 2>&1、>&2、>&-：複製檔案描述子，後面的數字或 - 不是檔名
        if (/^(\d+|-)$/.test(seg[i + 1] ?? '')) i++;
        continue;
      }
      if (/^<+&?$/.test(t)) {
        i++; // 輸入重導向的來源，不是寫入
        continue;
      }
      words.push(t);
    }
    // 去掉 VAR=value 前綴與 sudo / env 之類的包裝
    let k = 0;
    while (k < words.length && (/^[A-Za-z_][\w]*=/.test(words[k]) || WRAPPERS.has(words[k]))) k++;
    const name = words[k] ? path.basename(words[k]) : '';
    const args = words.slice(k + 1);
    if (name === 'cd') {
      const dest = args.find((a) => !a.startsWith('-'));
      if (dest && !dest.startsWith('$') && dest !== '~') base = path.resolve(base, dest);
      continue;
    }
    if ((name === 'bash' || name === 'sh' || name === 'zsh') && args[0] === '-c' && args[1]) {
      walk(args[1], base, found, depth + 1);
      continue;
    }
    for (const t of targetsOfCommand(name, args)) {
      if (t && !t.startsWith('$') && t !== '/dev/null') found.add(path.resolve(base, t));
    }
  }
}
