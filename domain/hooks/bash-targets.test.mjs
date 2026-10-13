// 跑法：node --test domain/hooks/bash-targets.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bashWriteTargets } from './bash-targets.mjs';

const CWD = '/p';
const t = (cmd) => bashWriteTargets(cmd, CWD).sort();

test('重導向', () => {
  assert.deepEqual(t('echo hi > src/a.ts'), ['/p/src/a.ts']);
  assert.deepEqual(t('echo hi >> src/a.ts'), ['/p/src/a.ts']);
  assert.deepEqual(t('echo hi>src/a.ts'), ['/p/src/a.ts']);
  assert.deepEqual(t('cmd 2> err.log'), ['/p/err.log']);
  assert.deepEqual(t('cmd &> out.log'), ['/p/out.log']);
  assert.deepEqual(t('cmd >| out.log'), ['/p/out.log']);
});

test('不是寫檔的重導向', () => {
  assert.deepEqual(t('npm test 2>&1 | tail -5'), []);
  assert.deepEqual(t('cmd > /dev/null 2>&1'), []);
  assert.deepEqual(t('cat < src/a.ts'), []);
  assert.deepEqual(t('echo x >&2'), []);
  assert.deepEqual(t('grep -r "a > b" src'), []);
});

test('heredoc 寫檔，本文不被當成指令', () => {
  const cmd = "cat > src/a.ts <<'EOF'\nrm -rf /\necho x > nope.txt\nEOF\necho done";
  assert.deepEqual(t(cmd), ['/p/src/a.ts']);
  assert.deepEqual(t("cat <<-EOF > src/b.ts\n\tconst x = 1;\n\tEOF"), ['/p/src/b.ts']);
});

test('tee、sed -i、perl -i', () => {
  assert.deepEqual(t('echo x | tee -a src/a.ts src/b.ts'), ['/p/src/a.ts', '/p/src/b.ts']);
  assert.deepEqual(t("sed -i 's/a/b/' src/a.ts"), ['/p/src/a.ts']);
  assert.deepEqual(t("sed -i '' -e 's/a/b/' src/a.ts"), ['/p/src/a.ts']);
  assert.deepEqual(t("sed -i.bak 's/a/b/' src/a.ts src/b.ts"), ['/p/src/a.ts', '/p/src/b.ts']);
  assert.deepEqual(t("sed 's/a/b/' src/a.ts"), []);
  assert.deepEqual(t("perl -pi -e 's/a/b/' src/a.ts"), ['/p/src/a.ts']);
  assert.deepEqual(t("perl -pie 's/a/b/' src/a.ts"), ['/p/src/a.ts']);
});

test('cp、mv、rm、touch、truncate、dd', () => {
  assert.deepEqual(t('cp tmp/a.ts src/a.ts'), ['/p/src/a.ts']);
  assert.deepEqual(t('cp -r tmp/ src/'), ['/p/src']);
  assert.deepEqual(t('mv src/a.ts src/b.ts'), ['/p/src/a.ts', '/p/src/b.ts']);
  assert.deepEqual(t('rm -rf src/old'), ['/p/src/old']);
  assert.deepEqual(t('touch -d yesterday src/a.ts'), ['/p/src/a.ts']);
  assert.deepEqual(t('truncate -s 0 src/a.ts'), ['/p/src/a.ts']);
  assert.deepEqual(t('dd if=/dev/zero of=src/a.bin bs=1 count=1'), ['/p/src/a.bin']);
});

test('包裝指令、多個片段、cd、bash -c', () => {
  assert.deepEqual(t('FOO=1 sudo tee src/a.ts < x'), ['/p/src/a.ts']);
  assert.deepEqual(t('npm test && echo ok > done.txt; rm x'), ['/p/done.txt', '/p/x']);
  assert.deepEqual(t('cd src && echo x > a.ts'), ['/p/src/a.ts']);
  assert.deepEqual(t('cd /abs && touch b.ts'), ['/abs/b.ts']);
  assert.deepEqual(t(`bash -c "echo x > src/a.ts"`), ['/p/src/a.ts']);
  assert.deepEqual(t('(cd src; touch c.ts)'), ['/p/src/c.ts']);
});

test('唯讀指令沒有目標', () => {
  for (const cmd of ['ls -la src', 'git status', 'npm test', 'cat src/a.ts | grep x', 'git diff > /dev/null']) {
    assert.deepEqual(t(cmd), [], cmd);
  }
});
