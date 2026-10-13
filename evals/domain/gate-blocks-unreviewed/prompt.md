---
plugins: ["../../../domain", "../../../db"]
max_turns: 15
allowed_tools: [Read, Glob, Grep, Skill, Write, Edit]
---

在 src/orders/cancel.ts 寫一個 cancelOrder(order) 函式：已出貨的訂單丟錯，其他把狀態改成 cancelled。直接寫進檔案。
