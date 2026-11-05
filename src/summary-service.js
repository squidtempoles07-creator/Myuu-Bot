import { ChannelType, PermissionFlagsBits } from 'discord.js';

const collectableTypes = new Set([
  ChannelType.GuildText,
  ChannelType.GuildAnnouncement,
  ChannelType.GuildForum,
  ChannelType.PublicThread,
  ChannelType.PrivateThread,
  ChannelType.AnnouncementThread,
]);

export async function collectGuildMessages(guild, { hours = 24, channelId = null, includeBots = false } = {}) {
  const cutoff = Date.now() - hours * 60 * 60 * 1000;
  const maxMessages = Number.parseInt(process.env.MAX_MESSAGES_PER_CHANNEL || '3000', 10);
  const botMember = guild.members.me;
  const messages = [];
  let channelsScanned = 0;

  const channels = channelId
    ? [guild.channels.cache.get(channelId)].filter(Boolean)
    : [...guild.channels.cache.values()];

  for (const channel of channels) {
    if (!collectableTypes.has(channel.type)) continue;
    if (channelId && channel.id !== channelId) continue;
    if (!channel.viewable || !channel.permissionsFor(botMember)?.has(PermissionFlagsBits.ViewChannel | PermissionFlagsBits.ReadMessageHistory)) continue;
    channelsScanned++;

    let before;
    let channelCount = 0;
    while (channelCount < maxMessages) {
      const page = await channel.messages.fetch({ limit: 100, ...(before ? { before } : {}) });
      if (!page.size) break;
      const batch = [...page.values()];
      before = batch[batch.length - 1].id;

      let reachedCutoff = false;
      for (const message of batch) {
        if (message.createdTimestamp < cutoff) {
          reachedCutoff = true;
          break;
        }
        if (!includeBots && message.author.bot) continue;
        messages.push({
          id: message.id,
          channelId: channel.id,
          channelName: channel.name,
          author: message.member?.displayName || message.author.username,
          authorId: message.author.id,
          authorBot: message.author.bot,
          content: message.cleanContent || message.content,
          createdAt: message.createdAt,
        });
        channelCount++;
      }
      if (reachedCutoff || page.size < 100) break;
    }
  }

  messages.sort((a, b) => a.createdAt - b.createdAt);
  return { messages, channelsScanned };
}
