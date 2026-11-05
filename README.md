# Discord AI Community Summary Bot

An AI-powered summary bot for a gaming Discord community. It reads every text channel visible to the bot and produces an evidence-based community digest.

## Commands

- `/summary`: Summarize the last 24 hours across all accessible channels. Options: `hours`, `channel`, and `include_bots`.
- `/summary-schedule`: Administrators can enable or disable recurring summaries and configure interval, lookback, and output channel.
- `/health`: Show gateway and AI configuration status.

## Output

Every summary includes:

- Overview and coverage statistics
- Topics and active games
- Key highlights
- Decisions
- Action items
- Unanswered topics
- Sentiment
- Risks
- Active participants

## Setup

1. Copy `.env.sample` to `.env`.
2. Set `DISCORD_TOKEN` and `DISCORD_CLIENT_ID`. For guild-only testing, set `DISCORD_GUILD_ID`.
3. Optionally configure `AI_PROVIDER_URL`, `AI_API_KEY`, and `AI_MODEL`.
4. In the Discord Developer Portal, enable the bot's `bot` scope and these gateway application permissions:
   - View Channels
   - Read Message History
   - Send Messages
   - Use Slash Commands
   - Optionally Read Message Content
5. Install dependencies and register commands:

```powershell
npm install
npm run register
npm start
```

The bot uses an extractive fallback summary when no AI API key is configured. For real AI analysis, configure an OpenAI-compatible chat-completions endpoint.

## Architecture

```text
Discord Gateway
    -> app.js (slash commands and scheduler)
       -> src/summary-service.js (permission-aware multi-channel collection)
       -> src/ai-summary.js (AI analysis or local fallback)
       -> Discord embed delivery
```

Scheduled configuration is persisted in `data/summary-schedules.json`. The scheduler checks enabled guilds every 15 minutes. Human and bot filtering, lookback limits, output channel selection, and message collection are handled server-side.

HTTP health endpoint:

```text
GET /health
```
