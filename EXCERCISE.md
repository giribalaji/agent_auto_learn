# SubSync Agent — Debugging & Verification Exercises

A reference for validating that the self-learning loop is actually working, not just appearing to. Read this before you trust any "the agent is getting smarter" claim in the README.

---

## Why this document exists

During the initial integration, a tempting interpretation of the logs turned out to be wrong. The agent appeared to consult its skill library before executing — but the log ordering actually showed the skill being loaded AFTER all tool calls. That led to a deeper question: **is the skill driving behavior, or just decorating the final response?**

Answering that required understanding Hermes' skill-injection architecture at three distinct levels, and building a call-ordered log that separates "skill was visible to the model" from "agent explicitly loaded the skill."

If you extend the agent or add new skills, run the exercises in this document to verify the loop still works the way the README describes.

---

## The three levels of skill influence in Hermes

This is the single most important thing to understand about how skills affect agent behavior. There are three separate pathways, with very different costs and visibility:

### Level 1 — System prompt injection (always on)

Source: `hermes-src/agent/prompt_builder.py:583` → `build_skills_system_prompt()`

At session start, Hermes scans the skills directory and builds a compact index of every skill's **name + description + category**, then injects it into the system prompt. Two-layer cached (in-process LRU + disk snapshot), so it's cheap after the first call.

- **Visibility to agent:** From turn zero, before any tool calls
- **Cost:** ~80 tokens per skill × every turn
- **What the agent can do with it:** Recognize that a relevant skill exists, know its exact name (enough to call `skill_view` directly without first calling `skills_list`)
- **Not enough for:** Executing the skill's body — the canonical tool sequence, trigger conditions, output format all live in the SKILL.md body, which isn't in the system prompt

### Level 2 — `skills_list` tool call (agent-initiated)

Source: `hermes-src/tools/skills_tool.py:647` → `skills_list()`

The agent can call `skills_list()` mid-turn to get a JSON response with the same metadata as Level 1. Useful if the system prompt has been trimmed, or if the agent wants a structured response it can reason over programmatically.

- **Visibility to agent:** Only after the agent chooses to call it
- **Cost:** Same ~80 tokens per skill, one-time per call
- **Usually redundant** given Level 1, which is why you'll often see agents skip this step entirely

### Level 3 — `skill_view` tool call (agent-initiated)

Source: `hermes-src/tools/skills_tool.py:804` → `skill_view(name)`

The agent calls `skill_view(name="customer-billing-escalation-review")` to load the full SKILL.md body — all the prose about when to trigger, canonical tool sequence, output format, edge cases. This is what actually contains the operational knowledge.

- **Visibility to agent:** Only after explicit load
- **Cost:** Size of the skill body (~500-2000 tokens), paid only when loaded
- **What the agent can do with it:** Follow the playbook exactly, reproduce output format, handle edge cases the description doesn't capture

---

## How to read an agent log

Raw Hermes log:
```
🔵 [SubSync] Using HERMES loop — agent: support
  ⚡ get_customer_by_id  ✅ OK
  ⚡ get_invoices        ✅ OK
  ⚡ get_support_tickets ✅ OK
  📚 skill  customer-billing-escalation-review  0.0s
```

**Naïve reading:** "The agent consulted the skill after executing the 3 tools."

This is misleading. Hermes's pretty-printer shows tool calls in the order they EXECUTE, but it does NOT show:

- Which skills were visible to the model via the Level 1 system prompt injection
- The model's internal reasoning between calls
- What metadata influenced which tool-call decisions

**Better reading:** The skill was visible to the model from turn 0 via system prompt injection. The 3 tool calls could have been driven by that visibility OR by the user prompt being obvious enough. The `skill_view` at the end loaded the body — most likely for output format guidance when composing the final response.

**To distinguish "driven by skill" from "skill was just visible":** you need the A/B test in the next section.

---

## Patched log for call ordering

The stock pretty-printer can hide when certain tools fire. We added a call-numbered tracer in `backend/agent_engine.py` that logs EVERY tool invocation (SubSync + Hermes built-ins) with a sequence number and timestamp.

### The patch

```python
_original = _ra.handle_function_call
import time as _time
_call_idx = {"n": 0}
def _patched(fn, fa, *a, **kw):
    _call_idx["n"] += 1
    _i = _call_idx["n"]
    _ts = _time.strftime("%H:%M:%S")
    _args_preview = json.dumps(fa, default=str)[:80] if fa else ""
    print(f"  🔎 [{_ts}] call#{_i} {fn}({_args_preview})")
    if fn in SUBSYNC_TOOLS:
        try:
            result = SUBSYNC_TOOLS[fn](**fa)
            print(f"  ✅ call#{_i} {fn}() → OK")
            return result
        except Exception as e:
            print(f"  ❌ call#{_i} {fn}() → {e}")
            return json.dumps({"error": str(e)})
    return _original(fn, fa, *a, **kw)
_ra.handle_function_call = _patched
```

### What to look for in the output

```
🔎 [01:46:11] call#1 get_customer_by_id({"customer_id": 2})
✅ call#1 get_customer_by_id() → OK
🔎 [01:46:14] call#2 get_invoices({"customer_id": 2})
✅ call#2 get_invoices() → OK
🔎 [01:46:18] call#3 get_support_tickets({"customer_id": 2, "status": "open"})
✅ call#3 get_support_tickets() → OK
🔎 [01:46:23] call#4 skill_view({"name": "customer-billing-escalation-review"})
```

Key observations from this example:

1. **No `skills_list` call.** The agent didn't discover the skill at runtime — it already knew the name from Level 1 injection.
2. **`skill_view` fired last.** The agent loaded the body at the END, probably for output format guidance.
3. **Tool call order looks "correct"** (matches the skill's canonical sequence). But we cannot distinguish from the log alone whether the skill CAUSED that order or the agent would have done it anyway.

---

## Exercise 1 — The A/B test: does the skill actually drive behavior?

**Goal:** Determine whether a learned skill is influencing the agent's tool-call sequence, or just being decoratively loaded at the end.

**Procedure:**

### Step 1 — Baseline run WITH the skill

```bash
# Confirm skill exists
ls ~/Documents/work/Sub-hermes/subsync_3/hermes_home/support/skills/
# Expected: customer-billing-escalation-review/

# Run and capture tool sequence
curl -s http://localhost:8765/api/chat \
  -H 'Content-Type: application/json' \
  -d '{"agent": "support", "message": "Quick escalation check for customer 2 — profile, invoices, open tickets."}' \
  | jq -r '.tool_calls[] | .tool' > /tmp/with_skill.txt

cat /tmp/with_skill.txt
```

### Step 2 — Move the skill aside

```bash
mv ~/Documents/work/Sub-hermes/subsync_3/hermes_home/support/skills/customer-billing-escalation-review /tmp/
```

### Step 3 — Restart uvicorn (to invalidate Hermes' system-prompt cache)

```bash
# Ctrl-C uvicorn, then relaunch
uvicorn main:app --port 8765
```

**Why restart?** Hermes' Level 1 injection is disk-snapshot cached. Moving the SKILL.md out of the dir alone doesn't invalidate the system prompt until the next cold start.

### Step 4 — Run the SAME prompt without the skill

```bash
curl -s http://localhost:8765/api/chat \
  -H 'Content-Type: application/json' \
  -d '{"agent": "support", "message": "Quick escalation check for customer 2 — profile, invoices, open tickets."}' \
  | jq -r '.tool_calls[] | .tool' > /tmp/without_skill.txt

cat /tmp/without_skill.txt
```

### Step 5 — Diff

```bash
diff /tmp/with_skill.txt /tmp/without_skill.txt
```

### Interpreting the results

| Diff result | Interpretation |
|---|---|
| Identical | User prompt alone was enough — skill was not adding value on this turn |
| Different tool order | Skill was influencing sequencing |
| Missing tools without skill | Skill was supplying a canonical step the agent wouldn't derive alone |
| Extra tools without skill | Skill was CONSTRAINING the agent (stopping redundant calls) |

**Do this for each new skill once, to confirm it's actually earning its tokens.**

### Step 6 — Restore

```bash
mv /tmp/customer-billing-escalation-review ~/Documents/work/Sub-hermes/subsync_3/hermes_home/support/skills/
# Restart uvicorn again to refresh Level 1 cache
```

---

## Exercise 2 — Measuring system-prompt bloat as the library grows

**Goal:** Track actual token cost of Level 1 injection as skills accumulate.

**Procedure:**

### Step 1 — Add a size logger to `agent_engine.py`

After `agent = AIAgent(...)` is constructed:

```python
# Debug: log the size of the skills-prompt injection
from agent.prompt_builder import build_skills_system_prompt
_skills_prompt = build_skills_system_prompt(
    available_tools=agent.valid_tool_names or set(),
)
print(f"  📊 skills-prompt injection: {len(_skills_prompt)} chars (~{len(_skills_prompt)//4} tokens)")
```

### Step 2 — Log after every turn

Run 10+ varied turns to grow the library naturally via auto-learn. After each, note the line:

```
📊 skills-prompt injection: 1840 chars (~460 tokens)    # 3 skills
📊 skills-prompt injection: 2410 chars (~602 tokens)    # 5 skills
📊 skills-prompt injection: 3980 chars (~995 tokens)    # 8 skills
```

### Step 3 — Plot vs skill count

At a given point, `ls hermes_home/<agent>/skills/ | wc -l` gives the skill count. Pair that with the logged prompt size.

### Interpretation thresholds

| Prompt size | Action |
|---|---|
| < 5k tokens | Ignore — it's noise |
| 5–15k tokens | Start thinking about tightening descriptions |
| 15–30k tokens | Enable categorization; prune unused skills |
| > 30k tokens | Mandatory pruning + category filters |

---

## Exercise 3 — Verify auto-learn writes a valid SKILL.md

**Goal:** Confirm the background review agent produces frontmatter that passes Hermes' validator.

### Step 1 — Trigger a fresh auto-learn

Run any prompt with 3+ tool calls on a fresh agent:

```bash
curl -s http://localhost:8765/api/chat \
  -H 'Content-Type: application/json' \
  -d '{"agent": "analytics", "message": "Give me a usage-growth report: top 3 products, their customers, and weekly events for the top customer."}'
```

Wait for `💾 [skill-review/analytics] Skill '<name>' created.` in the uvicorn log.

### Step 2 — Inspect the generated file

```bash
ls ~/Documents/work/Sub-hermes/subsync_3/hermes_home/analytics/skills/
cat ~/Documents/work/Sub-hermes/subsync_3/hermes_home/analytics/skills/*/SKILL.md
```

### Step 3 — Validate frontmatter

The file MUST start with `---`, have a closing `---`, and contain valid YAML with at least `name:` and `description:`. Test with:

```bash
python3 -c "
import yaml
from pathlib import Path
p = list(Path('hermes_home/analytics/skills').rglob('SKILL.md'))[0]
content = p.read_text()
assert content.startswith('---'), 'Missing opening ---'
frontmatter, body = content[3:].split('---', 1)
data = yaml.safe_load(frontmatter)
assert 'name' in data, 'Missing name'
assert 'description' in data, 'Missing description'
assert body.strip(), 'Empty body'
print(f'✅ Valid SKILL.md: {data[\"name\"]}')
"
```

If validation fails, the review agent's output format needs debugging — check the `_SUBSYNC_SKILL_PROMPT` in `agent_engine.py`.

---

## Exercise 4 — Prove duplicate suppression works

**Goal:** Confirm the review agent updates an existing skill rather than creating a duplicate.

### Step 1 — Confirm a skill exists

```bash
ls ~/Documents/work/Sub-hermes/subsync_3/hermes_home/support/skills/
# Expected at least one, e.g., customer-billing-escalation-review/
```

### Step 2 — Re-run a similar prompt

```bash
curl -s http://localhost:8765/api/chat \
  -H 'Content-Type: application/json' \
  -d '{"agent": "support", "message": "Quick escalation check for customer 3 — pull everything."}'
```

### Step 3 — Look for the right log line

You should see one of:

- `💾 [skill-review/support] Skill '...' updated.` — skill was refined in place (good)
- `⏭  [skill-review/support] no skill created` + review text saying "already documented" (also good, means library is stable)
- `💾 [skill-review/support] Skill 'new-different-name' created.` — bad if the new skill is basically a duplicate of existing one

### Step 4 — Count total skills

```bash
ls ~/Documents/work/Sub-hermes/subsync_3/hermes_home/support/skills/ | wc -l
```

Over 10 similar-pattern turns, this count should plateau — not grow linearly. If it grows linearly, the review agent isn't recognizing its own past output. Tighten the `_SUBSYNC_SKILL_PROMPT` or add a `skills_list` check as a mandatory first step in that prompt.

---

## Common pitfalls in interpretation

### "Tool X was called last, so it influenced nothing"

False. Level 1 injection means the tool's metadata was visible from turn 0. Calling `skill_view` at the end may just be loading the body for formatting guidance — the planning was already done with the description alone.

### "No `skills_list` was called, so the agent didn't use any skills"

False. Level 1 injection replaces most uses of `skills_list`. Absence of that tool call does NOT mean absence of skill influence.

### "The agent always calls the same tools — skills aren't doing anything"

Only true if you run the A/B test in Exercise 1 and the diff is empty. The skill might be suppressing redundant calls OR adding a specific arg pattern — both are valuable influences that look like "same tools" in a summary.

### "We have 200 skills, the context is exploding"

Check the actual prompt size via Exercise 2 before panicking. 200 skills at ~80 tokens each is 16k tokens — noticeable but not catastrophic on a 131k context window.

### "The skill was created but never loaded"

Don't prune yet. Level 1 injection makes the skill's description influence the agent without it ever being explicitly loaded. Use the A/B test to decide, not the load counter alone.

---

## Exercise 5 — Verify Level 2/3 lazy discovery is working

**Context:** The active `agent_engine.py` disables Level 1 system-prompt skill
injection. Skills are discoverable only via `skills_list` / `skill_view` tool
calls. This exercise confirms the agent actually makes those calls.

**Why it matters:** Without Level 1 injection, a skill that's never explicitly
discovered is functionally invisible. If the model ignores the skill-discovery
nudge in the system prompt, the library is dead weight. This exercise catches
that regression.

### Step 1 — Confirm Level 1 is disabled

Restart uvicorn and trigger any turn. You should see in the log:

```
🧹 [SubSync] Level 1 skill injection disabled (lazy discovery mode)
```

If you don't see that line, the monkey-patch didn't apply — check that
`agent_engine.py` has the `_pb.build_skills_system_prompt = lambda...` block.

### Step 2 — Trigger a workflow-shaped prompt

```bash
curl -s http://localhost:8765/api/chat \
  -H 'Content-Type: application/json' \
  -d '{"agent": "support", "message": "Escalation check for customer 2."}'
```

### Step 3 — Verify skills_list fired FIRST

In the patched call-numbered log, you should see:

```
🔎 [...] call#1 skills_list({})
🔎 [...] call#2 skill_view({"name": "customer-billing-escalation-review"})   ← if relevant
🔎 [...] call#3 get_customer_by_id(...)
🔎 [...] call#4 get_invoices(...)
...
```

`skills_list` MUST be call#1 on any workflow-shaped turn. If it's absent,
the model is ignoring the discovery nudge. Tighten the `skill_discovery`
section in `build_system_prompt()` — make the instruction sharper, move it
earlier in the prompt, or add a few explicit trigger-word examples.

### Step 4 — Compare against Level 1 baseline

If you want to measure the token savings, temporarily revert to Level 1:

```bash
cp backend/agent_engine_level1.py backend/agent_engine.py
# restart, run the same prompt, capture response headers or count prompt tokens
cp backend/agent_engine.py /tmp/agent_engine_level2.py.bak
# then switch back after measurement
```

Measure via your provider's usage endpoint or by adding a prompt-size logger
(see Exercise 2) in each mode.

Typical savings (empirical estimate):
- 5 skills: ~400 tokens/turn saved
- 20 skills: ~1600 tokens/turn saved
- 100 skills: ~8000 tokens/turn saved

The trade-off is one extra tool iteration (~200ms latency + a few hundred
tokens for the `skills_list` response) on turns that DO need skills.

---

## When to re-run these exercises

- After any change to `agent_engine.py`, especially the tool handler or review-agent patch
- After upgrading the `hermes-src` submodule (behaviour of `build_skills_system_prompt`, `_spawn_background_review`, and the tool definitions can change)
- After swapping the underlying LLM (different models exhibit very different skill-consultation patterns — qwen3-next is relatively disciplined, smaller models may ignore the system prompt entirely)
- Quarterly, as a library-health audit even if nothing changed — model updates on the provider side can subtly change behavior

---

## Quick reference — where each thing lives

| Thing | Path | Purpose |
|---|---|---|
| Skill index injection | `hermes-src/agent/prompt_builder.py:583` | Level 1 — system prompt |
| `skills_list` tool | `hermes-src/tools/skills_tool.py:647` | Level 2 — metadata tool call |
| `skill_view` tool | `hermes-src/tools/skills_tool.py:804` | Level 3 — body tool call |
| Skill manager (write/update) | `hermes-src/tools/skill_manager_tool.py` | Auto-learn target |
| Review prompt (stock) | `hermes-src/run_agent.py:2351` | `_SKILL_REVIEW_PROMPT` |
| Background spawn (stock) | `hermes-src/run_agent.py:2375` | `_spawn_background_review` |
| Nudge trigger | `hermes-src/run_agent.py:11367` | Fires review after N iterations |
| Iteration counter | `hermes-src/run_agent.py:8704` | `_iters_since_skill` |
| SubSync override: spawn | `backend/agent_engine.py` | Fix creds + logging |
| SubSync override: review prompt | `backend/agent_engine.py` | `_SUBSYNC_SKILL_PROMPT` |
| SubSync override: tracer | `backend/agent_engine.py` | Call-numbered log |

---

## The core insight

Agent behavior in Hermes isn't driven by one mechanism. It's the composition of:

1. System prompt (fixed per session, includes skill index, includes MEMORY.md + USER.md)
2. Tool definitions (fixed per session)
3. Tool responses mid-turn (dynamic)
4. Model's own reasoning over all of the above

When diagnosing "why did the agent do X?", you cannot look at tool logs alone. You have to also consider what was in the system prompt, what semantic memory was injected, and what the user prompt itself made obvious. The exercises above give you tools to disentangle these sources of influence.
