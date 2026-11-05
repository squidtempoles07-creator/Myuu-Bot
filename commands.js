import 'dotenv/config';
import { REST, Routes, SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';

const commands = [
  new SlashCommandBuilder()
    .setName('summary')
    .setDescription('Summarize gaming community activity across all accessible channels')
    .addIntegerOption((option) => option.setName('hours').setDescription('Lookback window (1-168 hours)').setMinValue(1).setMaxValue(168))
    .addChannelOption((option) => option.setName('channel').setDescription('Optional: summarize one channel instead of all channels'))
    .addBooleanOption((option) => option.setName('include_bots').setDescription('Include bot/system service messages')),

  new SlashCommandBuilder()
    .setName('summary-schedule')
    .setDescription('Configure recurring community summaries')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addBooleanOption((option) => option.setName('enabled').setDescription('Enable the schedule').setRequired(true))
    .addIntegerOption((option) => option.setName('every_hours').setDescription('Run every 1-168 hours').setMinValue(1).setMaxValue(168))
    .addChannelOption((option) => option.setName('output_channel').setDescription('Channel that receives scheduled summaries'))
    .addIntegerOption((option) => option.setName('lookback_hours').setDescription('Message lookback window (1-168 hours)').setMinValue(1).setMaxValue(168)),

  new SlashCommandBuilder()
    .setName('health')
    .setDescription('Show bot, AI, and summary service status'),
].map((command) => command.toJSON());

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DISCORD_GUILD_ID;
if (!token || !clientId) throw new Error('DISCORD_TOKEN and DISCORD_CLIENT_ID are required');

const rest = new REST({ version: '10' }).setToken(token);
const route = guildId
  ? Routes.applicationGuildCommands(clientId, guildId)
  : Routes.applicationCommands(clientId);

await rest.put(route, { body: commands });
console.log(`Registered ${commands.length} slash command(s) ${guildId ? `for guild ${guildId}` : 'globally'}.`);
