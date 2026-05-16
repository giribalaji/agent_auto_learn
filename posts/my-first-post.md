---
title: "My First Post"
slug: my-first-post
date: 2026-05-16
version: 1.0.0
status: published
tags: [llm, evals, ai]
---

# LLM Evals: How to Know Your Model Actually Works

Everyone ships an LLM feature. Almost nobody knows if it works.

"It feels good" is not an eval. Neither is asking five colleagues to click thumbs up. This post covers what evals actually are, why they're hard, and how to build ones that give you real signal.

## What Is an Eval?

An eval is a reproducible test that measures model behavior against a defined criterion.

Three ingredients:
1. **Input** — the prompt or conversation turn
2. **Expected behavior** — what "correct" looks like
3. **Judge** — something that decides pass/fail

The judge can be: a string match, a regex, a human, another LLM, or a custom function. The right judge depends on the task.

## Why Evals Are Hard

### The Reference Problem

For most LLM tasks there's no single correct answer. "Summarize this article" has infinite valid outputs. You can't diff against a golden string.

This forces you toward *behavioral* criteria instead of exact-match:
- Does the summary mention all key entities?
- Is it under 100 words?
- Does it avoid hallucinating facts not in the source?

Each criterion is its own mini-eval.

### The Distribution Problem

Your eval set is a sample. If it's too small, you measure noise. If it's curated by hand, it over-represents cases you already thought of. Production traffic finds the gaps.

Rule of thumb: start with 50–100 representative examples minimum. Grow it with real failures — when prod breaks, add that case to your eval suite.

### The Evaluator Problem

LLM-as-judge is powerful but not free. A judge model can:
- Be sycophantic (prefers longer answers, mirrors the prompt's style)
- Hallucinate a reason for its verdict
- Disagree with itself across runs

Calibrate your judge. Run it against a human-labeled gold set. If judge accuracy is < 85%, fix the judge before trusting its verdicts.

## Eval Types (Pick the Right Tool)

### 1. Unit Evals
Fast, deterministic, cheap. Run on every commit.

Good for:
- Format compliance (`output.startswith("{")`)
- Safety/refusal behavior
- Tool call correctness (did the model call the right function?)

```python
def test_json_output():
    result = my_chain.invoke("List three fruits")
    parsed = json.loads(result)  # fails if not valid JSON
    assert len(parsed) == 3
```

### 2. Model-Graded Evals
LLM judges a rubric against model output. Scales to subjective tasks.

Good for:
- Answer quality
- Tone / style compliance
- Factual accuracy (with a reference doc)

```python
JUDGE_PROMPT = """
Given this question and answer, rate helpfulness 1-5.
Question: {question}
Answer: {answer}
Return JSON: {"score": <int>, "reason": "<str>"}
"""
```

Require JSON output from the judge. Parse and assert `score >= 4`.

### 3. Human Evals
Slow, expensive, highest signal. Use sparingly.

Good for:
- Calibrating your automated judge
- Evaluating tasks where criteria are genuinely ambiguous
- Pre-launch quality gates on high-stakes features

Tooling: Label Studio, Argilla, or even a Google Sheet with a review rotation.

### 4. A/B / Comparative Evals
Show two outputs, pick the better one. Sidesteps the reference problem.

Good for:
- Comparing model versions or prompt variants
- Building preference datasets for fine-tuning

Run with real users (implicit feedback via click/accept/regenerate) or with a judge model prompted for preference.

## Building Your First Eval Pipeline

```
1. Define the task precisely
2. Collect 50+ representative inputs
3. Label expected behavior (not exact output — criteria)
4. Pick a judge (string match → LLM → human, in order of cost)
5. Run baseline against current model/prompt
6. Set a threshold (e.g., pass rate ≥ 90%)
7. Run on every prompt change
```

Don't skip step 6. Without a threshold, evals are dashboards, not gates.

## Common Mistakes

**Eval set leakage** — using the same examples you optimized the prompt against. Your eval is now measuring memorization. Keep a held-out test set.

**Goodharting the judge** — prompt-engineering the model to satisfy the judge without actually improving quality. Cross-check with human spot review periodically.

**Single-metric thinking** — optimizing one eval breaks another. Track a suite: accuracy, refusal rate, latency, cost. Watch for regressions across all.

**No regression suite** — evals only run before launch. Prod model updates, prompt tweaks, and context changes silently degrade quality. Run evals in CI and on a schedule.

## The Meta-Point

Evals are a product discipline, not just an ML one. They force you to define what "good" means before you ship. That definition is often harder than the model work itself — and more valuable.

If you don't have evals, you're not iterating. You're guessing.
