import { startGateway } from './gateway.js';
import 'dotenv/config';
import express from 'express';
import {
  ButtonStyleTypes,
  InteractionResponseFlags,
  InteractionResponseType,
  InteractionType,
  MessageComponentTypes,
  verifyKeyMiddleware,
} from 'discord-interactions';
import { getRandomEmoji, DiscordRequest } from './utils.js';
import { getShuffledOptions, getResult } from './game.js';
import { fetchChannelMessageBatches } from './services/messageFetcher.js';

import {
  createStatisticsAccumulator,
  addMessageBatch,
  getStatistics
} from './services/statistics.js';

import { generateCommunitySummary } from './services/summary.js';
import { exportSummaryToCsv } from './services/csvExporter.js';
import { sendSummaryToDashboard } from './services/dashboardApi.js';

// Create an express app
const app = express();
// Get port, or default to 3000
const PORT = process.env.PORT || 3000;
// To keep track of our active games
const activeGames = {};

let discordClient = null;

function parseDateRange(startDate, endDate) {
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;

    if (!datePattern.test(startDate) || !datePattern.test(endDate)) {
        throw new Error('Dates must use YYYY-MM-DD format.');
    }

    const start = new Date(`${startDate}T00:00:00.000Z`);
    const end = new Date(`${endDate}T23:59:59.999Z`);

    if (
        start.toISOString().slice(0, 10) !== startDate ||
        end.toISOString().slice(0, 10) !== endDate
    ) {
        throw new Error('Invalid calendar date.');
    }

    if (start > end) {
        throw new Error('Start date cannot be later than end date.');
    }

    return { start, end };
}

async function* trackMessageBatches(channel, dateRange, stats) {
    const batches = fetchChannelMessageBatches(channel, dateRange);

    for await (const batch of batches) {
        addMessageBatch(stats, batch);

        yield batch;
    }
}

/**
 * Interactions endpoint URL where Discord will send HTTP requests
 * Parse request body and verifies incoming requests using discord-interactions package
 */
app.post('/interactions', verifyKeyMiddleware(process.env.PUBLIC_KEY), async function (req, res) {
  // Interaction id, type and data
  const { id, type, data } = req.body;

  /**
   * Handle verification requests
   */
  if (type === InteractionType.PING) {
    return res.send({ type: InteractionResponseType.PONG });
  }

  /**
   * Handle slash command requests
   * See https://discord.com/developers/docs/interactions/application-commands#slash-commands
   */
  if (type === InteractionType.APPLICATION_COMMAND) {
    const { name } = data;

    // "test" command
    if (name === 'test') {
      // Send a message into the channel where command was triggered from
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          flags: InteractionResponseFlags.IS_COMPONENTS_V2,
          components: [
            {
              type: MessageComponentTypes.TEXT_DISPLAY,
              // Fetches a random emoji to send from a helper function
              content: `hello world ${getRandomEmoji()}`
            }
          ]
        },
      });
    }

    if (name === 'summary') {
        const options = Object.fromEntries(
            (data.options || []).map(option => [
                option.name,
                option.value
            ])
        );

        // Acknowledge immediately because summary generation takes time.
        res.send({
            type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE
        });

        try {
            if (!discordClient) {
                throw new Error('Discord Gateway is not ready.');
            }

            if (!req.body.guild_id) {
                throw new Error('This command can only be used inside a server.');
            }

            const { start, end } = parseDateRange(
                options.start_date,
                options.end_date
            );

            const channel = await discordClient.channels.fetch(options.channel);

            if (!channel || !channel.isTextBased() || !channel.messages?.fetch) {
                throw new Error('Selected channel is not a supported text channel.');
            }

            if (channel.guildId !== req.body.guild_id) {
                throw new Error('Selected channel does not belong to this server.');
            }

            const statsAccumulator = createStatisticsAccumulator();

            const messageBatches = trackMessageBatches(
                channel,
                {
                    startDate: start,
                    endDate: end
                },
                statsAccumulator
            );

            const result = await generateCommunitySummary(
                messageBatches,
                {
                    language: options.language || 'English'
                }
            );

            const statistics = getStatistics(statsAccumulator);

            const archive = await exportSummaryToCsv({
                guildId: req.body.guild_id,
                guildName: channel.guild.name,
                channels: [
                    {
                        id: channel.id,
                        name: channel.name
                    }
                ],
                periodStart: start.toISOString(),
                periodEnd: end.toISOString(),
                statistics,
                summary: result.summary,
                processedMessages: result.processedMessages,
                processedChunks: result.processedChunks
            });

            const header = [
                `**Community Summary — #${channel.name}**`,
                `**Period:** ${options.start_date} to ${options.end_date} (UTC)`,
                `**Messages:** ${statistics.totalMessages}`,
                `**Unique Users:** ${statistics.uniqueUsers}`,
                '',
                ''
            ].join('\n');

            const truncationNotice = '\n\n[Summary truncated. Full summary saved in CSV.]';

            const remainingCharacters = 2000 - header.length - truncationNotice.length;

            const summaryText = result.summary.length > remainingCharacters
                ? `${result.summary.slice(0, remainingCharacters)}${truncationNotice}`
                : result.summary;

            await DiscordRequest(
                `webhooks/${process.env.APP_ID}/${req.body.token}/messages/@original`,
                {
                    method: 'PATCH',
                    body: {
                        content: `${header}${summaryText}`
                    }
                }
            );

            console.log(
                `[Summary] Generated ${result.processedMessages} messages. Archive: ${archive.filePath}`
            );

        } catch (error) {
            console.error('[Summary Error]', error);

            await DiscordRequest(
                `webhooks/${process.env.APP_ID}/${req.body.token}/messages/@original`,
                {
                    method: 'PATCH',
                    body: {
                        content: `**Summary failed:** ${error.message}`
                    }
                }
            ).catch(updateError => {
                console.error('[Summary Response Error]', updateError);
            });
        }

        return;
    }

    console.error(`unknown command: ${name}`);
    return res.status(400).json({ error: 'unknown command' });
  }

  console.error('unknown interaction type', type);
  return res.status(400).json({ error: 'unknown interaction type' });
});

async function startApp() {
    try {
        discordClient = await startGateway();

        app.listen(PORT, () => {
            console.log('Listening on port', PORT);
        });
    } catch (error) {
        console.error('[Application Startup Error]', error);
    }
}

startApp();

// app.listen(PORT, () => {
//     console.log('Listening on port', PORT);

//     startGateway().catch((error) => {
//         console.error('[Gateway Startup Error]', error);
//     });
// });