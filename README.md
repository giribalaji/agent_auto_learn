# SubSync

Subscription-management SaaS with an **autonomous, self-improving AI agent layer** built on top of the [Hermes](https://github.com/NousResearch/hermes) agent framework.

SubSync's agents don't just execute — they **learn the operator's workflow over time**. Every multi-step interaction is reviewed in the background, and when the agent sees a reusable pattern (a billing audit, a ticket escalation, an onboarding check), it writes a `SKILL.md` playbook that future turns consult automatically.

---

## Why this project is different

Most "LLM agent framework" demos use stateless role-prompts — a Marketer agent, a Researcher agent, etc. — wired through a fixed orchestration graph (CrewAI, AutoGen, LangGraph, Swarm). The agents don't remember what worked. They don't get better. Every session starts from zero.

SubSync takes a different bet: **the agent's value compounds the longer you use it.** It remembers, it learns, it consolidates. That's what Hermes was built for, and SubSync is a concrete SaaS use case of that design.

### vs. CrewAI

| | CrewAI | SubSync (on Hermes) |
|---|---|---|
| Agent role | Fixed role prompt | Role prompt + learned skill library |
| Memory | Conversation buffer (in-RAM) | 4-layer persistent memory (episodic, semantic × 2, procedural) |
| Learning | None — stateless between runs | Auto-learns reusable playbooks from successful turns |
| Orchestration | Crew-level `Process` (sequential / hierarchical) | Per-agent autonomous loops + tool-driven delegation |
| Cross-agent isolation | All agents share prompts/tools | Per-agent `HERMES_HOME` — billing's skills stay in billing |
| Tool execution | Task-scoped | Global tool registry, overridable per agent |
| Token efficiency | Often injects everything into system prompt | Progressive disclosure — skills loaded on demand |

### vs. LangGraph / AutoGen / Swarm

Those frameworks give you a **graph compiler** — you declare states and transitions, they run the finite-state-machine. Great for deterministic pipelines, weak for adaptive behavior. Hermes gives you an **autonomous loop** with persistent memory, so the agent can invent its own path through the problem and remember what worked.

---

## Architecture

```
┌───────────────────────────────────────────────────────────────┐
│                      React Frontend                            │
│              (Vite + shadcn/ui + wouter)                       │
└────────────────────────┬──────────────────────────────────────┘
                         │  REST + SSE
┌────────────────────────▼──────────────────────────────────────┐
│                 FastAPI Backend                                │
│                   main.py                                      │
│    ┌──────────────────────────────────────────┐                │
│    │         SubSyncAgent wrapper              │                │
│    │           agent_engine.py                 │                │
│    │                                           │                │
│    │  ┌─────────────────────────────────────┐  │                │
│    │  │  Hermes AIAgent (from hermes-src)  │  │                │
│    │  │    • run_conversation loop         │  │                │
│    │  │    • SubSync tool handler patch    │  │                │
│    │  │    • Per-agent HERMES_HOME         │  │                │
│    │  │    • Override _spawn_background_   │  │                │
│    │  │       review (Ollama creds fix)    │  │                │
│    │  │    • Custom SubSync skill prompt   │  │                │
│    │  └─────────────────────────────────────┘  │                │
│    └──────────────────────────────────────────┘                │
│    ┌─────────────────┐ ┌──────────────────────┐                │
│    │  subsync_tools  │ │   SQLite (subsync.db)│                │
│    │  (15 DB tools)  │ │   customers, subs,   │                │
│    │                 │ │   invoices, tickets  │                │
│    └─────────────────┘ └──────────────────────┘                │
└───────────────────────┬───────────────────────────────────────┘
                        │  OpenAI-compatible API
┌───────────────────────▼───────────────────────────────────────┐
│                      Ollama Cloud                              │
│                  (qwen3-next:80b)                              │
└────────────────────────────────────────────────────────────────┘
```

---

## Four agents, four independent minds

Each agent has its own:

- Role prompt (`subsync_3/skills/<agent>_agent.md`)
- Persistent memory directory (`hermes_home/<agent>/`)
- Auto-learned skill library (`hermes_home/<agent>/skills/`)
- Session history (`hermes_home/<agent>/sessions.db`)

| Agent | Purpose | Typical tools |
|---|---|---|
| `onboarding` | Guides new customers through setup | `get_customer_by_id`, `mark_customer_onboarded` |
| `billing` | Invoices, payments, subscription billing | `get_invoices`, `update_payment_status`, `get_billing_summary` |
| `analytics` | Usage patterns, growth opportunities | `get_usage_metrics`, `get_top_products_by_usage` |
| `support` | Ticket triage, issue resolution | `get_support_tickets`, `create_support_ticket`, `resolve_ticket` |

Skills learned by billing are never visible to support, because they're filed under per-agent directories. This prevents cross-contamination of workflows and keeps each agent's decision space tight.

---

## Hermes' four-layer memory architecture

SubSync inherits Hermes' full memory stack. Each layer serves a distinct purpose:

| Layer | Cognitive category | Storage | What lives here |
|---|---|---|---|
| `SessionDB` | **Episodic** | `hermes_home/<agent>/sessions.db` (SQLite) | Full turn-by-turn transcripts with timestamps — the audit trail |
| `MEMORY.md` | **Semantic (environment)** | `hermes_home/<agent>/MEMORY.md` | Facts about the workspace, tool quirks, project conventions |
| `USER.md` | **Semantic (about user)** | `hermes_home/<agent>/USER.md` | User preferences, communication style, workflow habits |
| `skills/*/SKILL.md` | **Procedural** | `hermes_home/<agent>/skills/` | How-to playbooks, canonical tool sequences |

Semantic memory is injected into the system prompt at session start (for prefix caching). Procedural memory uses progressive disclosure — metadata via `skills_list`, full bodies via `skill_view` — so library size doesn't blow up the context window. Episodic memory stays on disk and is queryable for debugging or judge-based pruning.

---

## The self-learning loop

This is the core of SubSync's "agents that compound value over time" design.

```
User request → Agent executes a multi-step turn (2+ tool calls)
                           │
                           ▼
      Turn finishes, response delivered to user
                           │
      ┌────────────────────┴────────────────────┐
      │   Skill-nudge threshold check           │
      │   (_iters_since_skill >= 3)             │
      └────────────────────┬────────────────────┘
                           │  threshold hit
                           ▼
      ┌──────────────────────────────────────────┐
      │  Background daemon thread spawns a       │
      │  review_agent (separate AIAgent fork)    │
      │                                          │
      │  Input:                                  │
      │    • Full turn transcript                │
      │    • SubSync-specific review prompt      │
      │                                          │
      │  Review agent decides:                   │
      │    • Was this a reusable workflow?       │
      │    • Does a similar skill exist?         │
      │    • Create new / update existing / skip │
      │                                          │
      │  If create → skill_manage writes         │
      │     hermes_home/<agent>/skills/          │
      │                <name>/SKILL.md           │
      └──────────────────────────────────────────┘
                           │
                           ▼
      Next turn on this agent: skills_list() returns the new skill
                  → agent applies it automatically
```

This happens asynchronously — the user never waits for skill review. It takes ~15-30 seconds in the background per qualifying turn and typically adds negligible cost (one additional short LLM call via the review fork).

---

## Customizations on top of stock Hermes

Stock Hermes' auto-learn is designed for a general-purpose coding agent. We made three targeted modifications in `backend/agent_engine.py` to fit a SaaS-operations context:

1. **Per-agent `HERMES_HOME`** — set before `AIAgent` construction so each agent resolves its own skills/memory/session directories. Without this, all four agents would share one pool and contaminate each other's learning.

2. **Fixed background review agent credentials** — Hermes' stock `_spawn_background_review` creates the review fork without passing `base_url` or `api_key`, so it silently 401s against non-default LLM providers (Ollama Cloud, in our case). We wrap the method to inject creds and surface errors to stdout instead of `/dev/null`.

3. **SubSync-specific review prompt** — Hermes' default prompt only saves skills from turns with trial-and-error or course-correction. That's correct for coding but too strict for SaaS operations, where the value IS in freezing successful routine workflows. We swap in a prompt that saves multi-step patterns, arg-choice patterns, and formatting patterns even on first-try successes.

4. **Aggressive skill nudge** — `_skill_nudge_interval = 3` (default 10). SubSync turns are typically shorter than coding turns, so the threshold fires on any genuinely multi-step operation.

None of these modifications fork the Hermes source. They're all instance-level overrides, so upgrading the `hermes-src` submodule won't break us unless Hermes renames the hooks we're patching.

---

## Token economics

Because Hermes uses progressive disclosure instead of system-prompt injection, the skill library can grow without proportionally growing per-turn cost:

| Skills in library | `skills_list` overhead | % of 131k context |
|---|---|---|
| 10 | ~800 tokens | 0.6% |
| 50 | ~4,000 tokens | 3% |
| 100 | ~8,000 tokens | 6% |
| 500 | ~40,000 tokens | 30% |

Skill bodies (the SKILL.md content) are only loaded when the agent explicitly calls `skill_view` — so 100 skills on disk with one loaded costs ~9k tokens, not 150k. Per-agent isolation divides this further: a 200-skill total library with 4 agents averages 50 skills per agent.

---

## Fallback path

If the Hermes loop fails — rate-limited, truncated, invalid tool calls from the model — `SubSyncAgent.run()` falls back to a direct OpenRouter chat-completions loop (`_fallback_run`). It loses the auto-learn + memory features for that turn but keeps the user-visible experience working. Every agent has a safety net.

---

## Running it

### Prerequisites: clone Hermes alongside this repo

SubSync imports the Hermes agent framework from a **sibling directory**, not from PyPI. `backend/agent_engine.py` computes `HERMES_PATH = Path(__file__).parent.parent.parent / "hermes-src"` and prepends it to `sys.path`, so your working tree must look like this:

```
<parent-folder>/
├── agent_auto_learn/      ← this repo
└── hermes-src/            ← clone of nousresearch/hermes-agent
```

Set it up:

```bash
# From the folder that contains agent_auto_learn/
git clone https://github.com/nousresearch/hermes-agent.git hermes-src

# Pin to the exact Hermes commit this project was built against
cd hermes-src && git checkout d0e1388c && cd ..
```

> If you'd rather install Hermes from pip than maintain a sibling folder, see the note in `backend/requirements.txt` — it's a one-line change to `agent_engine.py`.

### Backend

```bash
cd agent_auto_learn/backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # fill in OPENROUTER_API_KEY
uvicorn main:app --port 8765
```

### Frontend (separate terminal)

```bash
cd agent_auto_learn/frontend
cp .env.example .env.local  # fill in BETTER_AUTH_SECRET, AI_GATEWAY_API_KEY, etc.
npm install
npm run dev
```

Test the agent directly:

```bash
curl -s http://localhost:8765/api/chat \
  -H 'Content-Type: application/json' \
  -d '{"agent": "billing", "message": "Audit billing for customer 1."}' | jq
```

After any 3+ tool turn, check for auto-learned skills:

```bash
ls hermes_home/billing/skills/
cat hermes_home/billing/skills/*/SKILL.md
```

---

## File layout

```
<parent-folder>/
├── hermes-src/                 ← Hermes framework (cloned separately — see Setup)
│                                  https://github.com/nousresearch/hermes-agent
│
└── agent_auto_learn/           ← this repo
    ├── backend/
    │   ├── main.py                 FastAPI entry
    │   ├── agent_engine.py         SubSyncAgent wrapper + Hermes patches
    │   ├── subsync_tools.py        15 SubSync DB tools exposed to the agent
    │   ├── db.py                   SQLite schema + seed
    │   ├── requirements.txt        Python deps
    │   └── .env.example            Backend env template
    ├── frontend/                   React app (Vite + shadcn/ui)
    ├── skills/                     Hand-authored role prompts per agent
    │   ├── onboarding_agent.md
    │   ├── billing_agent.md
    │   ├── analytics_agent.md
    │   └── support_agent.md
    ├── hermes_home/                Per-agent memory + learned skills (runtime)
    │   ├── onboarding/
    │   │   ├── MEMORY.md           semantic (environment)
    │   │   ├── USER.md             semantic (user)
    │   │   ├── sessions.db         episodic
    │   │   └── skills/             procedural (auto-learned)
    │   ├── billing/
    │   ├── analytics/
    │   └── support/
    ├── .env.example                Root env template
    └── .gitignore
```

**Note:** `hermes-src/` lives *outside* `agent_auto_learn/` — it is a sibling, not a child. This matches the `sys.path` resolution in `backend/agent_engine.py` (`parent.parent.parent / "hermes-src"`). Do not commit `hermes-src/` into this repo — it's an external dependency.

---

## Design tradeoffs to be aware of

**Latency on multi-step turns.** Every 3+ tool turn triggers a background skill review that runs a full LLM call. The user doesn't wait for it, but it does add ~15-30s of background activity and token cost.

**Skill library drift.** The permissive review prompt means the library grows faster than stock Hermes. Plan for periodic pruning — usage telemetry via a `skill_view` counter is the cheapest first pass; an LLM-as-judge audit is the correct second pass.

**Model sensitivity.** Hermes is tuned for Claude-family + larger open models (qwen3-next:80b, DeepSeek V3). Smaller models often produce malformed tool calls (e.g., gpt-oss's `functions.clarify` harmony format getting mangled to `functionsclarify`). Test any model swap.

**Not multi-tenant yet.** `hermes_home/` is keyed by agent type, not by end-user. If you want per-tenant skill isolation, add a tenant dimension: `hermes_home/<tenant>/<agent>/skills/`. Not hard, just not done.

---

## License

[Your license here]
