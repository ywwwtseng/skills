---
plugins: ["../../../ui"]
description: 跟畫面無關的程式碼請求，不該觸發任何 ui 的 skill（防 description 過度觸發）
tags: [trigger]
max_turns: 6
allowed_tools: [Read, Skill]
---

把這段改成 async/await，直接回覆程式碼就好：

```js
function load() {
  return fetch('/api/orders').then((r) => r.json()).then((d) => console.log(d));
}
```
