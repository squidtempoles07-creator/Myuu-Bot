import 'dotenv/config';
import express from 'express';
import {
  Client,
  EmbedBuilder,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
} from 'discord.js';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { collectGuildMessages } from './src/summary-service.js';
import { summarizeMessages } from './src/ai-summary.js';

const PORT = Number(process.env.PORT || 3000);
const schedulePath = join(process.cwd(), 'data', 'summary-schedules.json');
const app = express();

if (!process.env.DISCORD_TOKEN) {
  console.error('DISCORD_TOKEN belum diisi di .env.');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
  ],
  partials: [Partials.Channel],
});

function listText(items, empty = 'Tidak ada data.') {
  if (!Array.isArray(items) || !items.length) return empty;
  return items.map((item, index) => `${index + 1}. ${String(item).slice(0, 700)}`).join('\n').slice(0, 1024);
}

function buildEmbeds(summary, metadata) {
  const coverage = summary.coverage || {};
  const madeAt = new Date().toISOString();
  return [
    new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('Discord Community Summary')
      .setDescription(summary.overview || 'Tidak ada ringkasan.')
      .addFields(
        { name: 'Topics & Games', value: listText(summary.topicsAndGames), inline: false },
        { name: 'Highlights', value: listText(summary.highlights), inline: false },
        { name: 'Decisions', value: listText(summary.decisions), inline: false },
        { name: 'Action Items', value: listText(summary.actionItems), inline: false },
      )
      .setFooter({ text: `${metadata.mode} mode | ${madeAt}` }),
    new EmbedBuilder()
      .setColor(0x57F287)
      .addFields(
        { name: 'Unanswered Questions', value: listText(summary.unansweredQuestions), inline: false },
        { name: 'Sentiment', value: `${summary.sentiment?.tone || 'Tidak diketahui'}\n${String(summary.sentiment?.evidence || '').slice(0, 700)}`, inline: false },
        { name: 'Risks', value: listText(summary.risks, 'Tidak ada risiko teridentifikasi.'), inline: false },
        { name: 'Active Participants', value: listText(summary.activeParticipants, 'Tidak ada peserta aktif.'), inline: false },
      ),
    new EmbedBuilder()
      .setColor(0xEB459E)
      .addFields(
        { name: 'Links', value: listText(summary.links, 'Tidak ada tautan.'), inline: false },
        { name: 'Coverage', value: [
          `Messages: ${coverage.messageCount ?? metadata.messageCount}`,
          `Channels: ${coverage.channelCount ?? metadata.channelsScanned}`,
          `Participants: ${coverage.participantCount ?? 0}`,
          `Lookback: ${metadata.hours} hours`,
        ].join('\n'), inline: false },
      ),
  ];
}

async function readSchedules() {
  try {
    return JSON.parse(await readFile(schedulePath, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw error;
  }
}

async function writeSchedules(schedules) {
  await mkdir(dirname(schedulePath), { recursive: true });
  const temporary = `${schedulePath}.tmp`;
  await writeFile(temporary, JSON.stringify(schedules, null, 2));
  await rename(temporary, schedulePath);
}

async function generateGuildSummary(guild, options) {
  const collected = await collectGuildMessages(guild, options);
  const summary = await summarizeMessages(collected.messages, options.hours);
  return {
    embeds: buildEmbeds(summary, {
      mode: summary.mode,
      messageCount: collected.messages.length,
      channelsScanned: collected.channelsScanned,
      hours: options.hours,
    }),
  };
}

client.once('clientReady', async () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  try {
    if (interaction.commandName === 'health') {
      await interaction.reply({
        content: `Online | Guilds: ${client.guilds.cache.size} | AI: ${process.env.AI_API_KEY ? 'configured' : 'extractive fallback'}`,
        ephemeral: true,
      });
      return;
    }

    if (interaction.commandName === 'summary') {
      await interaction.deferReply();
      const hours = interaction.options.getInteger('hours') || 24;
      const channel = interaction.options.getChannel('channel');
      const includeBots = interaction.options.getBoolean('include_bots') || false;
      const result = await generateGuildSummary(interaction.guild, {
        hours,
        channelId: channel?.id || null,
        includeBots,
      });
      await interaction.editReply(result);
      return;
    }

    if (interaction.commandName === 'summary-schedule') {
      await interaction.deferReply({ ephemeral: true });
      const action = interaction.options.getString('action', true);
      const schedules = await readSchedules();
      const guildId = interaction.guildId;

      if (action === 'status') {
        const schedule = schedules[guildId];
        await interaction.editReply(schedule
          ? `Status: ${schedule.enabled ? 'enabled' : 'disabled'} | Output: <#${schedule.outputChannelId}> | Hours: ${schedule.hours} | Interval: ${schedule.intervalHours}h`
          : 'No schedule is configured for this server.');
        return;
      }

      if (action === 'disable') {
        schedules[guildId] = { ...schedules[guildId], enabled: false };
        await writeSchedules(schedules);
        await interaction.editReply('Scheduled summaries disabled.');
        return;
      }

      const outputChannel = interaction.options.getChannel('output_channel');
      if (!outputChannel?.isTextBased?.()) {
        await interaction.editReply('Enable requires a text-channel output_channel option.');
        return;
      }
      const hours = interaction.options.getInteger('hours') || 24;
      const intervalHours = interaction.options.getInteger('interval') || 24;
      schedules[guildId] = {
        enabled: true,
        outputChannelId: outputChannel.id,
        hours,
        intervalHours,
        lastRunAt: new Date().toISOString(),
      };
      await writeSchedules(schedules);
      await interaction.editReply(`Scheduled summaries enabled: <#${outputChannel.id}> every ${intervalHours}h, summarizing ${hours}h.`);
    }
  } catch (error) {
    console.error('Interaction error:', error);
    const message = 'Unable to complete the request. Check bot permissions and AI configuration.';
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(message).catch(() => {});
    } else {
      await interaction.reply({ content: message, ephemeral: true }).catch(() => {});
    }
  }
});

async function runScheduledSummaries() {
  const schedules = await readSchedules();
  const now = Date.now();
  let changed = false;

  for (const [guildId, schedule] of Object.entries(schedules)) {
    if (!schedule.enabled) continue;
    const elapsed = now - new Date(schedule.lastRunAt || 0).getTime();
    if (elapsed < schedule.intervalHours * 60 * 60 * 1000) continue;

    const guild = client.guilds.cache.get(guildId);
    if (!guild) continue;
    const channel = guild.channels.cache.get(schedule.outputChannelId);
    if (!channel?.isTextBased?.()) continue;

    try {
      const result = await generateGuildSummary(guild, {
        hours: schedule.hours || 24,
        includeBots: false,
      });
      await channel.send(result);
      schedule.lastRunAt = new Date().toISOString();
      changed = true;
    } catch (error) {
      console.error(`Scheduled summary failed for guild ${guildId}:`, error);
    }
  }
  if (changed) await writeSchedules(schedules);
}

app.get('/health', (_request, response) => {
  response.json({
    status: 'ok',
    discordReady: client.isReady(),
    guilds: client.guilds.cache.size,
    aiMode: process.env.AI_API_KEY ? 'ai' : 'extractive',
  });
});

app.listen(PORT, () => console.log(`Health server listening on port ${PORT}`));

client.login(process.env.DISCORD_TOKEN).catch((error) => {
  console.error('Discord login failed:', error);
  if (String(error?.message || '').includes('disallowed intents')) {
    console.error('Aktifkan Message Content Intent di Discord Developer Portal > Bot > Privileged Gateway Intents, lalu mulai ulang bot.');
  }
  process.exit(1);
});

setInterval(runScheduledSummaries, 15 * 60 * 1000).unref();
