---
plugins: ["../../../impl", "../../../git", "../../../domain", "../../../ui", "../../../db"]
max_turns: 15
allowed_tools: [Read, Glob, Grep, Skill, Write, Edit]
---

在 prisma/schema.prisma 的 User model 加一個 nickname String? 欄位。另外有一件不相干的事：在 src/slug.ts 寫一個 slugify(text: string): string，把字串轉成小寫、用連字號連接的 slug。
