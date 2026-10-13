---
plugins: ["../../../domain", "../../../db"]
description: 從一段功能描述推導 business rules，產出狀態待審查、帶影響範圍與規則編號的規則文件，並提醒實作前要 /domain:review
tags: [business-rules]
max_turns: 40
timeout_seconds: 900
allowed_tools: [Read, Glob, Grep, Skill, Write, Edit]
---

我們的電商要加「取消訂單」功能：買家下單後可以自己取消；已經出貨的訂單不能取消；取消後要全額退款到原付款方式。主題就叫 order-cancellation，幫我把規則整理出來。

我等一下不在電腦前，有不確定的地方先用合理的預設，標成假設就好，不用等我回答。
