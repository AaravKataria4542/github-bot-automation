# AI Notes — GitHub Automation Bot

## Tools and Models Used

**Primary tool**: Antigravity (Google DeepMind's agentic coding assistant, powered by Claude Sonnet).

The AI assisted with:
- Generating all boilerplate code (Next.js API routes, React components, TypeScript interfaces)
- Researching free-tier service options and their exact limits
- Writing comprehensive documentation (README, schema SQL)
- Suggesting the security architecture (HMAC verification, AES-256-GCM token encryption)

**I decided**: Overall architecture, key tradeoffs between services, database schema design, the rules engine data model, and which stretch goals to include.

---

## Key Decisions I Made (and Why)

### 1. Single OAuth App (not GitHub App + OAuth App)
The AI initially suggested a dual-auth pattern: GitHub App (JWT-based) for bot operations + a separate OAuth App for user login. I evaluated this and chose to use a single OAuth App for the MVP because:
- GitHub App JWT auth requires storing a private key, generating short-lived tokens, and handling installation IDs — significant added complexity
- For the scope of this exercise (public repos, single user per account), the OAuth token has sufficient permissions (`public_repo`)
- A "wrong turn" here would have been implementing GitHub App JWT auth and debugging the signing/exchange flow under time pressure

The tradeoff: the bot acts as the authenticated user, not as a named bot account. For production, GitHub App would be the right upgrade path.

### 2. Supabase Over Neon for the Database
Both are free Postgres. The key difference: Neon scales to zero after **5 minutes** of inactivity, while Supabase pauses after **7 days**. For a webhook-receiving app where cold starts matter (GitHub marks deliveries failed if there's no response in 10 seconds), Neon's aggressive sleep policy would require a workaround (external pinger). Supabase's pattern of use makes cold starts essentially a non-issue.

### 3. `X-GitHub-Delivery` as the Idempotency Key
GitHub documents this header as a unique UUID per delivery attempt. Using it as a `UNIQUE` database constraint is the simplest and most reliable idempotency mechanism — no Redis, no distributed locks, no separate dedup table needed. The Postgres constraint is atomic and provides exactly-once semantics for free.

---

## The Hardest Bug / Wrong Turn

**The raw body parsing problem in Next.js App Router.**

The AI initially generated the webhook handler like this:

```typescript
export async function POST(req: Request) {
  const payload = await req.json() // ← WRONG for signature verification
  const rawBody = JSON.stringify(payload) // ← doesn't preserve original bytes
  // verify HMAC against rawBody...
}
```

This silently breaks webhook signature verification because `JSON.stringify(JSON.parse(body))` is not byte-identical to the original body — key ordering, whitespace, and Unicode escaping may differ. GitHub signs the **exact bytes** it sends, not a re-serialized version.

The AI didn't initially flag this as a problem. I noticed it when testing: valid webhooks from GitHub were being rejected with 403, but manually constructed payloads (which I'd serialized myself) passed. I traced it to the JSON round-trip.

**Fix**: Read the raw body as text **before** any parsing:

```typescript
const rawBody = await req.text() // preserves exact bytes
// verify HMAC against rawBody
const payload = JSON.parse(rawBody) // parse after verification
```

This is the correct approach and what the final implementation uses.

---

## What I'd Improve with More Time

1. **GitHub App authentication**: Upgrade from OAuth App to GitHub App for proper bot identity (`@gitbot[bot]` in comments/labels), higher rate limits, and more granular permissions.

2. **Event queue with retries**: Currently, if Gemini or Slack is temporarily unavailable, the action fails and is recorded as an error with no retry. A proper queue (e.g., Supabase's pg_cron or an external queue) would retry failed actions with exponential backoff.

3. **Multi-repo event grouping in Slack**: When multiple events fire close together, send a digest instead of individual messages to avoid Slack noise.

4. **Rule testing UI**: A "dry run" button in the rule editor that shows which recent events would have matched the rule — much easier than creating an issue and waiting.

5. **GitHub App webhook management**: Currently we store the `webhook_id` per repo and delete it on disconnect. A GitHub App would handle this centrally and be more robust.

6. **Structured logging / observability**: Add request IDs, log event processing duration, track Gemini latency — useful for diagnosing slow events in the dashboard.

---

## One Illustrative Prompt Exchange

The trickiest part was getting the Gemini structured output to work reliably. I asked:

> "How do I use Gemini 2.0 Flash with a JSON schema constraint so it always returns valid JSON without markdown fences?"

The AI suggested using `responseMimeType: "application/json"` and `responseSchema` in the generation config. However, the TypeScript types for `responseSchema` in the `@google/generative-ai` SDK aren't perfectly typed — the SDK accepts `SchemaType` enum values but the type definitions made this tricky to wire up.

The fix was using `SchemaType.OBJECT` from the SDK's enum and casting the schema object to satisfy TypeScript, while keeping the runtime behavior correct. This is the kind of "AI helps, but you have to understand the underlying API" moment — the AI got the concept right but the type-level details required manual adjustment.
