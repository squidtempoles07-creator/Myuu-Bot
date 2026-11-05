import { ChannelType, PermissionFlagsBits } from 'discord.js';

export async function collectGuildMessages(guild, { hours, channelId = null, excludeBots = true }) {
  const cutoff = Date.now() - hours * 60 * 60 * 1000;
  const channels = channelId
    ? [guild.channels.cache.get(channelId)].filter(Boolean)
    : guild.channels.cache
        .filter((channel) =>
          channel.isTextBased() &&
          !channel.isThread() &&
          channel.type !== ChannelType.GuildCategory &&
          channel.permissionsFor(guild.members.me)?.has([
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.ReadMessageHistory,
          ])
        )
        .values();

  const channelList = [...channels];
  const messages = [];

  for (const channel of channelList) {
    let before;
    while (true) {
      const batch = await channel.messages.fetch({ limit: 100, ...(before ? { before } : {}) });
      if (!batch.size) break;
      const ordered = [...batch.values()].sort((a, b) => a.createdTimestamp - b.createdTimestamp);
      let reachedCutoff = false;

      for (const message of ordered) {
        if (message.createdTimestamp < cutoff) {
          reachedCutoff = true;
        } else if (!message.system && (excludeBots ? !message.author.bot : true)) {
          messages.push(message);
        }
      }

      before = batch.last()?.id;
      if (reachedCutoff || batch.size < 100 || !before) break;
    }
  }

  messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
  return { messages, channelCount: channelList.length };
}
