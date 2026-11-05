import 'dotenv/config';
import fs from 'node:fs/promises';
import express from 'express';
import { Client, EmbedBuilder, Events, GatewayIntentBits, Partials } from 'discord.js';
import { collectGuildMessages } from './src/summary-service.js';
import { summarizeWithAI } from './src/ai-summary.js';

const PORT = process.env.PORT || 3000;
const STATE_FILE = process.env.SUMMARY_STATE_FILE || './data/summary-schedules.json';
const aiConfig = {
  apiKey: process.env.AI_API_KEY,
  providerUrl: process.env.AI_PROVIDER_URL || 'https://api.openai.com/v1/chat/completions',
  model: process.env.AI_MODEL || 'gpt-4o-mini',
};

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

async function readSchedules() {
  try {
    return JSON.parse(await fs.readFile(STATE_FILE, 'utf8'));
  } catch {
    return {};
  }
}

async function writeSchedules(schedules) {
  await fs.mkdir('./data', { recursive: true });
  await fs.writeFile(STATE_FILE, JSON.stringify(schedules, null, 2));
}

function splitText(text, max = 3500) {
  const normalized = String(text || 'Not detected').replace(/\n{3,}/g, '\n\n');
  const parts = [];
  for (let offset = 0; offset < normalized.length; offset += max) parts.push(normalized.slice(offset, offset + max));
  return parts.length ? parts : ['Not detected'];
}

function buildEmbeds(summary, stats) {
  const embed = new EmbedBuilder()
    .setTitle(summary.title)
    .setColor(0x5865F2)
    .setDescription(summary.overview)
    .addFields(
      { name: 'Topics & games', value: splitText(summary.topics)[0], inline: false },
      { name: 'Key highlights', value: splitText(summary.highlights)[0], inline: false },
      { name: 'Decisions', value: splitText(summary.decisions)[0], inline: false },
      { name: 'Action items', value: splitText(summary.actions)[0], inline: false },
      { name: 'Unanswered topics', value: splitText(summary.unanswered)[0], inline: false },
      { name: 'Sentiment & risks', value: `${summary.sentiment}\n${splitText(summary.risks || 'Not detected')[0]}`, inline: false },
      { name: 'Active participants', value: splitText(summary.participants)[0], inline: false },
      { name: 'Coverage', value: `${stats.messageCount} messages | ${stats.channelCount} channels | ${stats.hours} hours`, inline: false },
    )
    .setTimestamp(new Date());

  return [embed].filter((item) => item.data);
}

async function generateSummary(guild, options) {
  const collected = await collectGuildMessages(guild, options);
  const summary = await summarizeWithAI(collected.messages, {
    ...options,
    channelCount: collected.channelCount,
  }, aiConfig);
  return {
    summary,
    stats: { messageCount: collected.messages.length, channelCount: collected.channelCount, hours: options.hours },
  };
}

client.on(Events.ClientReady, (readyClient) => {
  console.log(`Logged in as ${readyClient.user.tag}`);
  setInterval(runScheduledSummaries, 15 * 60 * 1000).unref();
  runScheduledSummaries();
});

async function runScheduledSummaries() {
  const schedules = await readSchedules();
  const now = Date.now();

  for (const [guildId, schedule] of Object.entries(schedules)) {
    if (!schedule.enabled) continue;
    if (schedule.nextRunAt && schedule.nextRunAt > now) continue;

    const guild = client.guilds.cache.get(guildId);
    const outputChannel = guild?.channels.cache.get(schedule.outputChannelId);
    if (!guild || !outputChannel?.isTextBased()) continue;

    try {
      const result = await generateSummary(guild, {
        hours: schedule.lookbackHours || schedule.everyHours,
        channelId: null,
        excludeBots: true,
      });
      await outputChannel.send({ embeds: buildEmbeds(result.summary, result.stats) });
    } catch (error) {
      console.error(`Scheduled summary failed for guild ${guildId}:`, error);
    }

    schedule.nextRunAt = now + schedule.everyHours * 60 * 60 * 1000;
    schedules[guildId] = schedule;
  }
  await writeSchedules(schedules);
}

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'health') {
    return interaction.reply({
      content: `OK | Gateway ping: ${client.ws.ping}ms | AI: ${aiConfig.apiKey ? 'configured' : 'fallback mode'} | Guilds: ${client.guilds.cache.size}`,
      ephemeral: true,
    });
  }

  if (interaction.commandName === 'summary-schedule') {
    if (!interaction.inGuild()) return interaction.reply({ content: 'This command must be used in a server.', ephemeral: true });
    const enabled = interaction.options.getBoolean('enabled', true);
    const everyHours = interaction.options.getInteger('every_hours') || 24;
    const lookbackHours = interaction.options.getInteger('lookback_hours') || everyHours;
    const outputChannel = interaction.options.getChannel('output_channel');
    const schedules = await readSchedules();
    schedules[interaction.guildId] = {
      enabled,
      everyHours,
      lookbackHours,
      outputChannelId: outputChannel?.id || interaction.channelId,
      nextRunAt: enabled ? Date.now() + everyHours * 60 * 60 * 1000 : null,
    };
    await writeSchedules(schedules);
    return interaction.reply({
      content: enabled
        ? `Scheduled summaries enabled every ${everyHours}h, looking back ${lookbackHours}h, in <#${outputChannel?.id || interaction.channelId}>.`
        : 'Scheduled summaries disabled.',
      ephemeral: true,
    });
  }

  if (interaction.commandName === 'summary') {
    if (!interaction.inGuild()) return interaction.reply({ content: 'This command must be used in a server.', ephemeral: true });
    await interaction.deferReply();

    try {
      const hours = interaction.options.getInteger('hours') || 24;
      const channel = interaction.options.getChannel('channel');
      const includeBots = interaction.options.getBoolean('include_bots') || false;
      const result = await generateSummary(interaction.guild, {
        hours,
        channelId: channel?.id || null,
        excludeBots: !includeBots,
      });
      await interaction.editReply({ embeds: buildEmbeds(result.summary, result.stats) });
    } catch (error) {
      console.error('On-demand summary failed:', error);
      await interaction.editReply(`Summary failed: ${error.message}`);
    }
  }
});

const app = express();
app.get('/health', (_req, res) => res.json({
  ok: client.isReady(),
  ai: aiConfig.apiKey ? 'configured' : 'fallback',
  guilds: client.guilds.cache.size,
}));
app.listen(PORT, () => console.log(`Health server listening on port ${PORT}`));

if (!process.env.DISCORD_TOKEN) throw new Error('DISCORD_TOKEN is required');
await client.login(process.env.DISCORD_TOKEN);
