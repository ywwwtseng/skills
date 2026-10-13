---
plugins: ["../../../impl", "../../../git", "../../../domain", "../../../ui", "../../../db"]
max_turns: 15
allowed_tools: [Read, Glob, Grep, Skill, Write, Edit]
---

在 prisma/schema.prisma 的 User model 加一個 nickname String? 欄位，順便在 src/user.ts 寫一個對應的 type User。
