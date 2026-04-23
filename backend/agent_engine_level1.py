"""
SubSync Agent Engine — ARCHIVED: LEVEL 1 SKILL INJECTION VERSION
================================================================

This file is kept for reference. It is NOT wired into main.py.
The active version is `agent_engine.py` which uses Level 2/3 (lazy)
skill discovery instead of Level 1 (system-prompt injection).

Differences from the active version:
  - This version relies on Hermes' default behavior: every skill's
    name + description is injected into the system prompt at session
    start via build_skills_system_prompt().
  - Per-turn token cost: ~80 tokens x number_of_skills, paid on EVERY
    turn even if the agent doesn't use any skill.
  - The agent can call skill_view(name) directly without discovery
    because the name is already visible in the system prompt.

Why we moved away from this version:
  - As the learned-skill library grows, the per-turn cost grows linearly
    without bound.
  - Most turns don't need skills - paying for all of them every time is
    wasteful.

When to revert to this version:
  - If you find the agent systematically ignores skills in the active
    Level 2/3 version (i.e., never calls skills_list).
  - If your skill count stays small (< 20 per agent) AND you need
    deterministic skill awareness without an extra discovery step.

To revert: `cp agent_engine_level1.py agent_engine.py` and restart.

See EXCERCISE.md for the full background.
"""
import os
import sys
import json
import inspect
from pathlib import Path
from typing import Optional

# Add hermes-src to path so we can import AIAgent
HERMES_PATH = str(Path(__file__).parent.parent.parent / "hermes-src")
if HERMES_PATH not in sys.path:
    sys.path.insert(0, HERMES_PATH)

# Add backend to path for tools
BACKEND_PATH = str(Path(__file__).parent)
if BACKEND_PATH not in sys.path:
    sys.path.insert(0, BACKEND_PATH)

SKILLS_PATH = str(Path(__file__).parent.parent / "skills")

AGENT_CONFIGS = {
    "onboarding": {
        "name": "Onboarding Agent",
        "skill_file": f"{SKILLS_PATH}/onboarding_agent.md",
        "description": "Guides new customers through setup and onboarding",
        "color": "emerald",
        "icon": "🚀",
    },
    "billing": {
        "name": "Billing Agent",
        "skill_file": f"{SKILLS_PATH}/billing_agent.md",
        "description": "Handles invoices, payments, and subscription billing",
        "color": "cyan",
        "icon": "💳",
    },
    "analytics": {
        "name": "Usage Analytics Agent",
        "skill_file": f"{SKILLS_PATH}/analytics_agent.md",
        "description": "Analyzes usage patterns and identifies growth opportunities",
        "color": "violet",
        "icon": "📊",
    },
    "support": {
        "name": "Customer Support Agent",
        "skill_file": f"{SKILLS_PATH}/support_agent.md",
        "description": "Resolves customer issues and manages support tickets",
        "color": "amber",
        "icon": "🎧",
    },
}


def load_skill(agent_type: str) -> str:
    config = AGENT_CONFIGS.get(agent_type)
    if not config:
        return ""
    skill_file = config["skill_file"]
    if os.path.exists(skill_file):
        with open(skill_file) as f:
            return f.read()
    return ""


def build_system_prompt(agent_type: str) -> str:
    skill = load_skill(agent_type)
    tools_desc = """
## Available Tools
You have access to these SubSync database tools:
- get_subscriptions(customer_id, status) — fetch subscriptions
- get_subscription_by_id(subscription_id) — get single subscription
- update_subscription_status(subscription_id, status) — change sub status
- get_customers(status) — list all customers
- get_customer_by_id(customer_id) — customer details + subscriptions
- mark_customer_onboarded(customer_id) — mark customer as onboarded
- get_invoices(customer_id, status) — fetch invoices
- update_payment_status(invoice_id, status, notes) — update payment
- get_billing_summary() — MRR, overdue stats
- get_usage_metrics(customer_id, days) — usage events
- get_top_products_by_usage(limit) — top products
- get_support_tickets(status, customer_id) — list tickets
- create_support_ticket(customer_id, subject, description, priority) — new ticket
- resolve_ticket(ticket_id, resolution_notes) — close ticket

Always use tools to fetch real data before answering. Never hallucinate customer data.
"""
    return skill + "\n\n" + tools_desc


def build_tool_definitions(subsync_tools: dict) -> list:
    """Build OpenAI-style tool definitions from SubSync tool functions."""
    tool_defs = []
    for name, func in subsync_tools.items():
        sig = inspect.signature(func)
        props = {}
        required = []
        for param_name, param in sig.parameters.items():
            ptype = "integer" if param.annotation == int else "string"
            props[param_name] = {"type": ptype, "description": param_name}
            if param.default == inspect.Parameter.empty:
                required.append(param_name)
        tool_defs.append({
            "type": "function",
            "function": {
                "name": name,
                "description": func.__doc__ or name,
                "parameters": {
                    "type": "object",
                    "properties": props,
                    "required": required,
                }
            }
        })
    return tool_defs
def coerce_args(func, args: dict) -> dict:
    sig = inspect.signature(func)
    coerced = {}
    for param_name, param in sig.parameters.items():
        if param_name not in args:
            continue
        val = args[param_name]
        if param.annotation == int:
            try:
                val = int(val)
            except (ValueError, TypeError):
                pass
        coerced[param_name] = val
    return coerced


class SubSyncAgent:
    """Wrapper around Hermes AIAgent for SubSync agents"""

    def __init__(self, agent_type: str, openrouter_api_key: str, model: str = "anthropic/claude-3.5-sonnet", base_url: str = "https://openrouter.ai/api/v1"):
        self.agent_type = agent_type
        self.config = AGENT_CONFIGS.get(agent_type, {})
        self.api_key = openrouter_api_key
        self.model = model
        self.base_url = base_url
        self.system_prompt = build_system_prompt(agent_type)

    def run(self, user_message: str, conversation_history: list = None) -> dict:
        """Run the Hermes agent loop for a single turn."""
        try:
            # ── Per-agent HERMES_HOME so each agent keeps its own learned skills,
            #    memory, and session DB. Must be set BEFORE importing/instantiating
            #    AIAgent so get_hermes_home() resolves to the agent-scoped path.
            _agent_home = Path(__file__).parent.parent / "hermes_home" / self.agent_type
            _agent_home.mkdir(parents=True, exist_ok=True)
            (_agent_home / "skills").mkdir(exist_ok=True)
            os.environ["HERMES_HOME"] = str(_agent_home)

            from run_agent import AIAgent
            from subsync_tools import SUBSYNC_TOOLS
            import run_agent as _ra
            print(f"🔵 [SubSync] Using HERMES loop — agent: {self.agent_type} | home: {_agent_home}")

            # ── Patch handle_function_call in run_agent module globals ──
            # tools.py must NOT be in sys.path — it shadows Hermes' tools/ package
            _original = _ra.handle_function_call
            import time as _time
            _call_idx = {"n": 0}
            def _patched(fn, fa, *a, **kw):
                _call_idx["n"] += 1
                _i = _call_idx["n"]
                _ts = _time.strftime("%H:%M:%S")
                # Log EVERY tool call (including Hermes built-ins) with order + args preview
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

            agent = AIAgent(
                base_url=self.base_url,
                api_key=self.api_key,
                model=self.model,
                ephemeral_system_prompt=self.system_prompt,
                skip_context_files=True,
                skip_memory=False,
                max_iterations=15,
                quiet_mode=True,
            )

            # ── Auto-skill-learning: fire the background skill-review nudge
            #    after 3 tool iterations in a turn (default is 10, too high for
            #    typical SubSync flows of 1–5 tool calls).
            agent._skill_nudge_interval = 3

            # ── Fix: Hermes' stock _spawn_background_review creates the review
            #    fork WITHOUT passing base_url/api_key (run_agent.py:2405), so
            #    the fork silently 401s against our Ollama Cloud endpoint. Also
            #    redirects stdout/stderr to /dev/null so failures are invisible.
            #    Wrap it to inject creds + log visibly.
            _orig_spawn = agent._spawn_background_review
            _self_creds = {
                "base_url": self.base_url,
                "api_key": self.api_key,
                "model": self.model,
                "agent_type": self.agent_type,
            }
            # ── SubSync-specific skill review prompt. Hermes' stock prompt
            #    only saves a skill when the turn had trial-and-error or course
            #    correction, which almost never happens on clean SaaS tool
            #    flows. We want to crystallize routine multi-step workflows
            #    into reusable playbooks even when they succeed first-try.
            _SUBSYNC_SKILL_PROMPT = (
                f"Review the conversation above from the '{self.agent_type}' agent.\n\n"
                "You are building a library of reusable playbooks for this SubSync agent. "
                "Save a skill whenever the turn matches ANY of:\n"
                "  • A multi-step tool sequence (2+ tools) that would recur for similar requests "
                "(e.g., 'billing audit', 'customer onboarding check', 'ticket escalation review').\n"
                "  • A decision pattern where the agent picked specific tool arguments "
                "(e.g., filtering by status='overdue') based on user intent.\n"
                "  • Any sequence that produced a structured output the user would want formatted "
                "the same way next time.\n\n"
                "When saving:\n"
                "  1. Use skill_manage with action='create' (or 'update' if a similar skill exists — "
                "check with skills_list first).\n"
                "  2. Give the skill a specific, task-oriented name like 'customer-ticket-triage' "
                "not 'general-support'.\n"
                "  3. In the body, document: when to trigger it, the canonical tool sequence, "
                "and the expected output format.\n\n"
                "If the turn was a single tool call or purely conversational, say 'Nothing to save.' "
                "and stop. Otherwise, save the skill."
            )
            def _fixed_spawn(messages_snapshot, review_memory=False, review_skills=False):
                import threading, contextlib, io, traceback
                if review_skills and not review_memory:
                    prompt = _SUBSYNC_SKILL_PROMPT
                elif review_memory and review_skills:
                    prompt = agent._COMBINED_REVIEW_PROMPT
                elif review_memory:
                    prompt = agent._MEMORY_REVIEW_PROMPT
                else:
                    prompt = agent._SKILL_REVIEW_PROMPT
                def _run():
                    buf = io.StringIO()
                    # Remember snapshot length so we can tell review's own
                    # messages apart from the parent transcript we fed in.
                    snapshot_len = len(messages_snapshot)
                    try:
                        with contextlib.redirect_stdout(buf), contextlib.redirect_stderr(buf):
                            review_agent = AIAgent(
                                base_url=_self_creds["base_url"],
                                api_key=_self_creds["api_key"],
                                model=_self_creds["model"],
                                max_iterations=8,
                                quiet_mode=True,
                                skip_context_files=True,
                                skip_memory=True,
                            )
                            review_agent._skill_nudge_interval = 0
                            review_agent._memory_nudge_interval = 0
                            review_agent.run_conversation(
                                user_message=prompt,
                                conversation_history=messages_snapshot,
                            )
                        # Scan ONLY the review agent's own additions
                        # (_session_messages includes the parent transcript we fed in).
                        all_msgs = getattr(review_agent, "_session_messages", [])
                        review_msgs = all_msgs[snapshot_len:] if len(all_msgs) > snapshot_len else all_msgs

                        created = []
                        tool_calls_seen = []
                        final_text = ""
                        for msg in review_msgs:
                            if not isinstance(msg, dict):
                                continue
                            if msg.get("role") == "assistant":
                                if msg.get("tool_calls"):
                                    for tc in msg["tool_calls"]:
                                        fn = tc.get("function", {}) if isinstance(tc, dict) else {}
                                        name = fn.get("name")
                                        if name:
                                            tool_calls_seen.append(name)
                                elif msg.get("content"):
                                    final_text = str(msg.get("content", ""))[:200]
                            if msg.get("role") == "tool":
                                try:
                                    data = json.loads(msg.get("content", "{}"))
                                except Exception:
                                    continue
                                items = data if isinstance(data, list) else [data]
                                for item in items:
                                    if not isinstance(item, dict):
                                        continue
                                    if item.get("success") and "created" in str(item.get("message", "")).lower():
                                        created.append(item.get("message"))
                        tag = f"[skill-review/{_self_creds['agent_type']}]"
                        if created:
                            print(f"  💾 {tag} {' · '.join(created)}")
                        else:
                            print(f"  ⏭  {tag} no skill created")
                            print(f"     tools the review agent called: {tool_calls_seen or '(none)'}")
                            if final_text:
                                print(f"     review's final text: {final_text!r}")
                    except Exception as e:
                        print(f"  ❌ [skill-review/{_self_creds['agent_type']}] {type(e).__name__}: {e}")
                        print(f"  {traceback.format_exc()}")
                        print(f"  --- review stdout/stderr ---\n{buf.getvalue()}")
                threading.Thread(target=_run, daemon=True, name="bg-review-fixed").start()
            agent._spawn_background_review = _fixed_spawn

            # ── Inject SubSync tools into Hermes tool list ──
            custom_tool_defs = build_tool_definitions(SUBSYNC_TOOLS)
            if agent.tools is None:
                agent.tools = []
            agent.tools.extend(custom_tool_defs)
            agent.valid_tool_names = {t["function"]["name"] for t in agent.tools}

            # Run the Hermes loop
            result = agent.run_conversation(
                user_message=user_message,
                conversation_history=conversation_history or [],
            )

            # Restore original handler
            _ra.handle_function_call = _original

            # Hermes returns {"final_response": str, "messages": [...], "completed": bool, ...}
            # NOT {"response": ...} — that was the key-name bug.
            if isinstance(result, dict):
                response_text = result.get("final_response") or ""
                msgs = result.get("messages", []) or []
            else:
                response_text = str(result) if result else ""
                msgs = []

            # Auto-fallback only if Hermes truly produced no text (rate-limited,
            # interrupted, or truncated past recovery).
            if not response_text or not response_text.strip():
                print("🟡 [SubSync] Hermes returned empty final_response — switching to FALLBACK loop")
                return self._fallback_run(user_message, conversation_history, "hermes_empty_response")

            # Extract tool_calls from the assistant turns in the message history
            tool_calls = []
            for m in msgs:
                if m.get("role") == "assistant" and m.get("tool_calls"):
                    for tc in m["tool_calls"]:
                        fn = tc.get("function", {}) if isinstance(tc, dict) else {}
                        name = fn.get("name") or tc.get("name") if isinstance(tc, dict) else None
                        args_raw = fn.get("arguments") or (tc.get("arguments") if isinstance(tc, dict) else None)
                        try:
                            args = json.loads(args_raw) if isinstance(args_raw, str) else (args_raw or {})
                        except Exception:
                            args = {"_raw": args_raw}
                        if name:
                            tool_calls.append({"tool": name, "args": args})

            return {
                "success": True,
                "agent": self.agent_type,
                "agent_name": self.config.get("name", "Agent"),
                "response": response_text,
                "tool_calls": tool_calls,
            }

        except Exception as e:
            print(f"🟡 [SubSync] Using FALLBACK loop — agent: {self.agent_type} | reason: {e}")
            return self._fallback_run(user_message, conversation_history, str(e))

    def _fallback_run(self, user_message: str, conversation_history: list, error: str) -> dict:
        """Fallback using direct OpenRouter API call with tool definitions."""
        try:
            from openai import OpenAI
            from subsync_tools import SUBSYNC_TOOLS

            client = OpenAI(
                api_key=self.api_key,
                base_url=self.base_url
            )

            tool_defs = build_tool_definitions(SUBSYNC_TOOLS)

            messages = [{"role": "system", "content": self.system_prompt}]
            if conversation_history:
                messages.extend(conversation_history)
            messages.append({"role": "user", "content": user_message})

            # Hermes-style loop: sense → plan → act → observe
            max_iters = 10
            tool_calls_made = []

            for iteration in range(max_iters):
                response = client.chat.completions.create(
                    model=self.model,
                    messages=messages,
                    tools=tool_defs,
                    max_tokens=2048,
                )
                msg = response.choices[0].message

                if not msg.tool_calls:
                    return {
                        "success": True,
                        "agent": self.agent_type,
                        "agent_name": self.config.get("name", "Agent"),
                        "response": msg.content or "",
                        "tool_calls": tool_calls_made,
                        "iterations": iteration + 1,
                    }

                messages.append({
                    "role": "assistant",
                    "content": msg.content,
                    "tool_calls": [
                        {
                            "id": tc.id,
                            "type": "function",
                            "function": {"name": tc.function.name, "arguments": tc.function.arguments}
                        }
                        for tc in msg.tool_calls
                    ]
                })

                for tc in msg.tool_calls:
                    fn_name = tc.function.name
                    fn_args = json.loads(tc.function.arguments)
                    tool_calls_made.append({"tool": fn_name, "args": fn_args})

                    if fn_name in SUBSYNC_TOOLS:
                        try:
                            result = SUBSYNC_TOOLS[fn_name](**fn_args)
                            print(f"  ✅ [fallback] {fn_name}() → OK")
                        except Exception as te:
                            result = json.dumps({"error": str(te)})
                            print(f"  ❌ [fallback] {fn_name}() → {te}")
                    else:
                        result = json.dumps({"error": f"Unknown tool: {fn_name}"})

                    messages.append({
                        "role": "tool",
                        "tool_call_id": tc.id,
                        "content": result
                    })

            return {
                "success": True,
                "agent": self.agent_type,
                "agent_name": self.config.get("name", "Agent"),
                "response": "Completed analysis.",
                "tool_calls": tool_calls_made,
            }

        except Exception as e2:
            return {
                "success": False,
                "agent": self.agent_type,
                "agent_name": self.config.get("name", "Agent"),
                "response": f"Agent error: {str(e2)}",
                "tool_calls": [],
            }
