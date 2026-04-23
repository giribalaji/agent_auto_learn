# SubSync Design System

## Concept
Dark, data-dense AI dashboard. Feels like a mission control for subscriptions — professional, intelligent, always on.

## Colors
- Background: `#0a0f1e` (deep navy)
- Surface: `#0d1424` (card/panel bg)
- Border: `#1a2540` (subtle borders)
- Primary accent: `#00d4ff` (cyan — primary actions, highlights)
- Secondary accent: `#00ff9d` (emerald — success, active states)
- Warning: `#f59e0b` (amber — overdue, pending)
- Danger: `#ef4444` (red — cancelled, errors)
- Text primary: `#e2e8f0`
- Text muted: `#64748b`
- Agent colors: emerald (onboarding), cyan (billing), violet (#8b5cf6) (analytics), amber (support)

## Typography
- Display: `Orbitron` or `Space Mono` (tech/sci-fi feel for headers)
- Body: `JetBrains Mono` (monospace, data-heavy)
- Fall back: system monospace

## Layout
- Sidebar nav (collapsible, 240px wide)
- Main content area with dense grid cards
- Top bar with status indicators

## Card Style
- Dark bg `#0d1424`, border `#1a2540`
- Glowing border on hover: `0 0 0 1px rgba(0,212,255,0.3)`
- Subtle gradient header bars

## Motion
- Page transitions: fade + slide up (150ms)
- Stat counters: animate on mount
- Agent chat: streaming text feel

## Agent Chat UI
- Each agent has a distinct color identity
- Messages bubble style, dark themed
- Tool call execution shown as collapsible steps
- Thinking indicator with pulsing dot
