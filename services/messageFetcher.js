
/**
 * Fetch Discord messages in batches.
 *
 * @param {import('discord.js').TextBasedChannel} channel
 * @param {Object} options
 * @param {Date|string} options.startDate
 * @param {Date|string} [options.endDate]
 * @param {number} [options.pageSize=100]
 */
export async function* fetchChannelMessageBatches(
    channel,
    {
        startDate,
        endDate = new Date(),
        pageSize = 100
    }
) {
    if (!channel?.messages?.fetch) {
        throw new Error('Invalid channel or channel is not text-based.');
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        throw new Error('Invalid startDate or endDate.');
    }

    if (start > end) {
        throw new Error('startDate cannot be later than endDate.');
    }

    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
        throw new Error('pageSize must be between 1 and 100.');
    }

    const startTimestamp = start.getTime();
    const endTimestamp = end.getTime();

    let before;
    let previousCursor;

    while (true) {
        const options = {
            limit: pageSize
        };

        if (before) {
            options.before = before;
        }

        // Fetch one page from Discord
        const fetched = await channel.messages.fetch(options);

        if (fetched.size === 0) {
            break;
        }

        const messages = [...fetched.values()];

        // Find the oldest message in this page
        const oldestMessage = messages.reduce((oldest, message) => {
            return message.createdTimestamp < oldest.createdTimestamp
                ? message
                : oldest;
        });

        // Keep only messages inside the requested period
        const filteredMessages = messages
            .filter(message => {
                return (
                    message.createdTimestamp >= startTimestamp &&
                    message.createdTimestamp <= endTimestamp
                );
            })
            .map(message => ({
                id: message.id,
                channelId: message.channelId,
                channelName: channel.name,

                authorId: message.author.id,
                authorName: message.author.username,
                authorIsBot: message.author.bot,

                content: message.content,

                timestamp: message.createdAt.toISOString(),

                editedAt: message.editedAt
                    ? message.editedAt.toISOString()
                    : null,

                attachments: [...message.attachments.values()].map(file => ({
                    id: file.id,
                    name: file.name,
                    url: file.url,
                    contentType: file.contentType,
                    size: file.size
                }))
            }))
            .sort((a, b) => {
                return new Date(a.timestamp) - new Date(b.timestamp);
            });

        // Yield one batch at a time
        if (filteredMessages.length > 0) {
            yield filteredMessages;
        }

        // Stop when we have reached the beginning of the period
        if (oldestMessage.createdTimestamp < startTimestamp) {
            break;
        }

        // Move pagination cursor to the oldest message
        before = oldestMessage.id;

        // Safety check against duplicate pagination
        if (before === previousCursor) {
            break;
        }

        previousCursor = before;
    }
}
