import 'dotenv/config';
import {
  PermissionFlagsBits,
  REST,
  Routes,
  SlashCommandBuilder,
} from 'discord.js';

const commands = [
  new SlashCommandBuilder()
    .setName('summary')
    .setDescription('Ringkas aktivitas komunitas gaming')
    .addIntegerOption((option) =>
      option.setName('hours').setDescription('Rentang waktu 1-168 jam').setMinValue(1).setMaxValue(168),
    )
    .addChannelOption((option) =>
      option.setName('channel').setDescription('Batasi ringkasan ke satu channel'),
    )
    .addBooleanOption((option) =>
      option.setName('include_bots').setDescription('Sertakan pesan bot'),
    ),

  new SlashCommandBuilder()
    .setName('summary-schedule')
    .setDescription('Kelola ringkasan berkala server ini')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption((option) =>
      option.setName('action').setDescription('Tindakan jadwal').setRequired(true)
        .addChoices(
          { name: 'Enable', value: 'enable' },
          { name: 'Disable', value: 'disable' },
          { name: 'Status', value: 'status' },
        ),
    )
    .addChannelOption((option) =>
      option.setName('output_channel').setDescription('Channel tujuan ringkasan'),
    )
    .addIntegerOption((option) =>
      option.setName('hours').setDescription('Rentang ringkasan 1-168 jam').setMinValue(1).setMaxValue(168),
    )
    .addIntegerOption((option) =>
      option.setName('interval').setDescription('Interval kirim dalam jam').setMinValue(1).setMaxValue(168),
    ),

  new SlashCommandBuilder().setName('health').setDescription('Periksa status bot'),
].map((command) => command.toJSON());

const rest = new REST().setToken(process.env.DISCORD_TOKEN);
const applicationId = process.env.DISCORD_CLIENT_ID || process.env.APP_ID;

if (!process.env.DISCORD_TOKEN) {
  throw new Error('DISCORD_TOKEN belum diisi di .env.');
}
if (!applicationId) {
  throw new Error('DISCORD_CLIENT_ID belum diisi di .env (atau APP_ID sebagai nama lama).');
}
if (!/^\d{17,20}$/.test(applicationId)) {
  throw new Error('DISCORD_CLIENT_ID/APP_ID harus berupa Discord Application ID (angka/snowflake).');
}
if (process.env.DISCORD_GUILD_ID && !/^\d{17,20}$/.test(process.env.DISCORD_GUILD_ID)) {
  throw new Error('DISCORD_GUILD_ID harus berupa Discord Server ID (angka/snowflake), atau dikosongkan.');
}

const route = process.env.DISCORD_GUILD_ID
  ? Routes.applicationGuildCommands(applicationId, process.env.DISCORD_GUILD_ID)
  : Routes.applicationCommands(applicationId);

await rest.put(route, { body: commands });
console.log(`Registered ${commands.length} slash commands.`);
