---
type: regex
target: { source: file, path: prisma/schema.prisma }
pattern: 'nickname'
match: not_contains
weight: 2
---
