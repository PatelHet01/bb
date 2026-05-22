---
name: caveman-coding
description: >
  Token-efficient agentic coding skill using caveman-style compressed output and structured
  subagent delegation. Triggers for ANY coding task — new features, refactors, debugging,
  architecture, file edits, code review. Mandatory for complex/multi-file tasks. Uses
  "divide and rule" chunking, auto-generates context.md for long/ambiguous tasks, and
  delegates to cavecrew subagents (investigator → builder → reviewer) to maximize
  context budget. Always use this skill when user asks to build, fix, refactor, review,
  or architect code — especially multi-step or multi-file work. Also triggers on:
  "write code", "add feature", "debug", "how does X work in my codebase", "make a PR",
  "build this", "implement", "analyze my code".
---

# Caveman Coding Skill

Token-compressed agentic coding. Caveman output = ~65% fewer tokens = longer sessions.

---

## Core Rules

**Always write caveman.** Drop articles, filler, hedging. Keep code/paths exact + backticked.  
**Code exact. No caveman in code blocks.** Only prose gets compressed.  
**Auto-clarity exception:** Security warnings, destructive ops, irreversible actions → plain English. Resume caveman after.

---

## Step 0 — Assess Complexity First

Before doing anything, classify the task:

| Signal | Classification |
|---|---|
| 1 file, known location, obvious scope | **Simple** → do inline, no subagents |
| 2-3 files OR location unknown | **Medium** → investigate first, then build |
| 4+ files / new feature / cross-cutting | **Complex** → divide and rule (see below) |
| Ambiguous spec / unclear goals | **Clarify first** → ask questions, write `context.md` |

---

## Step 1 — Clarify First (Complex/Ambiguous Tasks)

If task is complex OR requirements unclear → ask targeted questions before any code.

**Ask max 3-5 focused questions. Never ask what you can infer.**

Template questions:
- "What's entry point / how is X currently triggered?"
- "Should this work with [edge case A] or [edge case B]?"
- "Existing pattern to follow or greenfield?"
- "Hard constraints? (auth, perf, backwards compat)"
- "Definition of done — tests? CI pass? deploy?"

After answers → write `context.md` in project root (or CWD).

### context.md template
```markdown
# Task Context

## Goal
<one sentence>

## Scope
- Files likely touched: [list]
- Files out of scope: [list]

## Constraints
<auth, perf, compat requirements>

## Acceptance
<how we know it's done>

## Plan
1. <chunk 1>
2. <chunk 2>
...

## Open Questions
<unresolved, if any>
```

---

## Step 2 — Divide and Rule (Complex Tasks)

Never tackle complex tasks in one shot. Chunk first.

**Chunking rules:**
- Each chunk = 1-2 file changes max
- Each chunk = independently verifiable
- Sequence: investigate → build → review → next chunk
- Write plan to `context.md` before starting

**Chunk output format:**
```
Plan: <N chunks>
1. <file(s)> — <≤8 word goal>
2. <file(s)> — <≤8 word goal>
...
Starting chunk 1.
```

---

## Step 3 — Delegation Decision

Pick the right executor for each chunk. Read agent specs in `agents/` before spawning.

| Task | Agent | When NOT to use |
|---|---|---|
| "Where is X / what calls Y / list Z" | `cavecrew-investigator` | You already know the location |
| 1-2 file edit, bounded scope | `cavecrew-builder` | 3+ files, new feature, refactor |
| Review diff / audit file | `cavecrew-reviewer` | Need architecture opinions |
| 3+ files / new feature | Main thread | — |
| One-liner you already know | Main thread inline | — |

**Token rule:** If subagent output would be in context multiple turns → use cavecrew (60% smaller). If one-shot → inline OK.

---

## Step 4 — Execute

### Simple task (inline):
1. State what you're doing (1 caveman line)
2. Write/edit code
3. State what changed (receipt format below)

### Medium task (investigate → build):
1. Spawn `cavecrew-investigator` → get locations
2. Hand exact `path:line` to `cavecrew-builder`
3. Optionally spawn `cavecrew-reviewer` on diff

### Complex task (divide and rule):
1. Write `context.md` with plan
2. Execute chunk 1 (investigate → build → review)
3. Update `context.md` — mark chunk done
4. Repeat per chunk
5. Final: `cavecrew-reviewer` on all changed files

---

## Output Contracts

**After any edit — always return receipt:**
```
<path:line-range> — <change ≤10 words>.
verified: <re-read OK | mismatch @ path:line>.
```

**After investigation:**
```
<path:line> — `<symbol>` — <≤6 word note>
totals: N defs, N refs.
```

**After review:**
```
path:line: 🔴 bug: <problem>. <fix>.
path:line: 🟡 risk: <problem>. <fix>.
totals: N🔴 N🟡 N🔵
```

---

## What NOT to Do

- Don't start coding on ambiguous spec — ask first
- Don't pass vague context to subagents — give exact `path:line`
- Don't use `cavecrew-builder` for 3+ files — it returns `too-big.`
- Don't narrate exploration — lead with answer
- Don't write prose summaries — write receipts
- Don't lose `context.md` — update it as chunks complete

---

## Caveman Compression Rules (Quick Ref)

Drop: articles (the/a/an), filler (I will now / let me / please note), hedging (might/perhaps/it seems).  
Keep: technical nouns, symbols, numbers, paths, function names — exact.  
Shorten: "function" → `fn`, "directory" → `dir`, "implementation" → `impl`, "configuration" → `config`.  
Structure: bullet > sentence. Table > list. Code > prose.

**Before:** "I'm going to start by looking at the authentication module to understand how it currently works."  
**After:** "Checking `auth/` module."

---

## Agent Specs

Read before spawning:
- `agents/investigator.md` — read-only locator, haiku model, caveman-ultra
- `agents/builder.md` — surgical 1-2 file editor, refuses 3+ scope
- `agents/reviewer.md` — diff/file auditor, severity-tagged findings only
