# OurSchool AI — Gemini-Powered Assistant

A school-aware chat assistant available in every portal (Super Admin, Admin, Teacher, Parent, Student). Uses Gemini Flash by default and auto-escalates to Gemini Pro for complex queries. Answers general questions AND live school-specific questions ("what's my child's fee balance?", "how many absences this month?", "any homework due?") scoped strictly to the user's role, school, and children.

---

## User Experience

- **Floating chat button** (bottom-right, above mobile nav) on every authenticated page.
- Tap → opens a **mobile-first Drawer** (max 85dvh) / desktop side panel with the conversation.
- **Threaded history**: sidebar lists past chats, "New Chat" button, rename & delete.
- Streaming responses (word-by-word), markdown rendering, code blocks, copy button.
- **Suggested prompts** on empty state, tailored per role:
  - Parent: "Show my child's fee balance", "This week's homework"
  - Teacher: "My classes today", "Attendance summary for 8-A"
  - Admin: "Fee collection this month", "Absent students today"
- Loading shimmer ("Thinking..."), stop-generation button, error retry.
- Multilingual — respects the user's current i18n language setting.

---

## Intelligence & Safety

**Router logic** (server-side):
- Default → `google/gemini-3.6-flash` (fast, cheap).
- Escalate to `google/gemini-3.1-pro-preview` when the query is long, contains reasoning keywords, or needs multi-step tool chaining.

**Tools the AI can call** (scoped by role — enforced server-side, never trust client):
- `get_student_summary` (parent/student only, own children)
- `get_fee_balance` (parent for own children, admin for school)
- `get_attendance_summary` (role-scoped)
- `get_homework_upcoming` (student/parent for own class)
- `get_announcements_recent` (all, school-scoped)
- `get_school_stats` (admin/super-admin only)
- `get_class_roster` (teacher for own classes, admin)

Every tool re-verifies the caller's `user_id`, `role`, and `school_id` before returning data. Super Admin has cross-school access; everyone else is locked to their tenant.

**Guardrails**:
- System prompt anchors the AI: identity ("OurSchool AI"), scope, refusal rules for out-of-scope requests (medical advice, non-school topics stay general), never leaks other schools' data.
- Rate limit per user (e.g. 30 messages/hour) to control costs and abuse.
- Log every conversation for audit.

---

## Data Model

Two new tables:

- `ai_conversations` — `id, user_id, school_id, title, created_at, updated_at, last_message_at`
- `ai_messages` — `id, conversation_id, role (user|assistant|tool), content, tool_calls jsonb, tokens_in, tokens_out, model, created_at`

RLS: users see only their own conversations. Super admin can see all (for audit). Full GRANTs to `authenticated` + `service_role`.

Auto-title conversations from the first user message (short Gemini Flash call).

---

## Architecture

**Backend** — new edge function `ai-chat`:
- Auth-verified (JWT, extracts `user_id`, `role`, `school_id`).
- Loads full conversation history from DB.
- Streams response via Lovable AI Gateway (`ai-sdk-lovable-gateway`) — no user-provided key needed.
- Executes tool calls server-side with role-scoped Supabase queries.
- Persists user + assistant messages, tracks token usage.
- Rate-limit check before each call.

**Frontend**:
- `useAiChat` hook — wraps the AI SDK's `useChat` with our edge function transport, threaded history, streaming.
- `AiChatDrawer` component — Drawer/Dialog with `Conversation`, `Message`, `PromptInput` from AI Elements.
- `AiChatFab` — floating button, mounted globally in `App.tsx`.
- `AiChatThreadList` — sidebar with rename/delete.
- Realtime: subscribe to `ai_messages` inserts so multi-device users see updates live.

**AI Elements install** (per chat-ui-composition):
```
bun x ai-elements@latest add conversation message prompt-input shimmer tool
```

---

## Implementation Phases

1. **Backend**: migration for `ai_conversations` + `ai_messages` with RLS/GRANTs; edge function `ai-chat` with model router, tool registry, streaming, rate limit.
2. **Hooks & API**: `useAiConversations`, `useAiChat` (AI SDK integration), realtime subscription.
3. **UI**: install AI Elements, build `AiChatDrawer`, `AiChatFab`, `AiChatThreadList`, empty state with role-based suggestions, custom OurSchool AI avatar.
4. **Wire globally**: mount FAB in `App.tsx` inside authenticated layouts only; hide on login/tenant-error/receipt-verify pages.
5. **Polish**: markdown rendering, streaming shimmer, mobile viewport safety (keyboard resize, safe-area), i18n strings for all 8 languages, dark mode.
6. **Verify**: build check, test as each role (parent/teacher/admin/super-admin), confirm role-scoping (parent cannot see another child's data), realtime sync, rate limit.

---

## Technical Notes

- Uses existing Lovable AI Gateway (`LOVABLE_API_KEY` already provisioned) — no Gemini API key needed from you.
- Cost control: Flash-first routing, per-user rate limit, capped `stepCountIs(50)` for tool loops, message history windowing (last ~20 turns to keep tokens sane on long threads).
- Fully realtime via Supabase channels (matches your existing fee realtime pattern).
- No external Gemini SDK — the gateway handles it, keeps everything server-side and secure.
