# Discord AI Community Summary Bot

An AI-powered summary bot for gaming Discord communities. It scans every accessible text channel in a server and can produce manual or scheduled digests.

## Features

- `/summary [hours] [channel] [include_bots]`
- `/summary-schedule` with enable, disable, status, output channel, lookback, and interval
- `/health`
- Overview, topics/games, highlights, decisions, action items, unanswered questions, sentiment, risks, active participants, links, and coverage
- OpenAI-compatible provider support
- Extractive fallback when no AI API key is configured
- Permission-aware channel collection across the guild
- JSON schedule persistence at `data/summary-schedules.json`
- HTTP health endpoint at `GET /health`

## Architecture

```text
Discord Gateway
  -> discord.js client
  -> slash-command handlers
  -> summary-service message collection
  -> ai-summary provider/fallback analysis
  -> Discord embed delivery
```

The scheduler checks schedules every 15 minutes and sends a digest only after each configured interval.

## Setup

1. Use Node.js 18 or newer.
2. Create a Discord application and bot at the Discord Developer Portal.
3. Enable Message Content Intent.
4. Grant the bot View Channels, Read Message History, and Send Messages permissions.
5. Copy `.env.example` to `.env`.
6. Set at least:

```env
DISCORD_TOKEN=your_bot_token
DISCORD_CLIENT_ID=your_application_id
```

For one guild during development, set `DISCORD_GUILD_ID`; omit it to register commands globally.

Optional AI settings:

```env
AI_PROVIDER_URL=https://api.openai.com/v1/chat/completions
AI_API_KEY=your_api_key
AI_MODEL=gpt-4o-mini
MAX_MESSAGES_PER_CHANNEL=3000
```

## Run

```powershell
npm install
npm run register
npm start
```

Expose port `3000` (or your configured `PORT`) if you use the HTTP health endpoint in a hosted environment.
