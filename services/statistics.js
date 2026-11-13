
/**
 * Create a statistics accumulator.
 *
 * This allows us to process Discord messages batch by batch
 * without keeping all raw messages in memory.
 */
export function createStatisticsAccumulator() {
    return {
        totalMessages: 0,
        humanMessages: 0,
        botMessages: 0,
        messagesWithAttachments: 0,
        editedMessages: 0,

        uniqueUsers: new Set(),
        channels: new Map(),
        contributors: new Map()
    };
}

/**
 * Add one batch of messages to the statistics accumulator.
 *
 * @param {ReturnType<typeof createStatisticsAccumulator>} stats
 * @param {Array<Object>} messages
 */
export function addMessageBatch(stats, messages) {
    if (!Array.isArray(messages)) {
        throw new Error('Messages must be an array.');
    }

    for (const message of messages) {
        stats.totalMessages++;

        // Count bot and human messages
        if (message.authorIsBot) {
            stats.botMessages++;
        } else {
            stats.humanMessages++;

            if (message.authorId) {
                stats.uniqueUsers.add(message.authorId);

                const contributor = stats.contributors.get(message.authorId) || {
                    authorId: message.authorId,
                    authorName: message.authorName,
                    messageCount: 0
                };

                contributor.messageCount++;

                stats.contributors.set(message.authorId, contributor);
            }
        }

        // Count messages containing attachments
        if (message.attachments?.length > 0) {
            stats.messagesWithAttachments++;
        }

        // Count edited messages
        if (message.editedAt) {
            stats.editedMessages++;
        }

        // Count messages per channel
        const channelId = message.channelId || 'unknown';

        const channel = stats.channels.get(channelId) || {
            channelId,
            channelName: message.channelName || 'Unknown',
            messageCount: 0
        };

        channel.messageCount++;

        stats.channels.set(channelId, channel);
    }
}

/**
 * Get the final statistics in a serializable format.
 *
 * @param {ReturnType<typeof createStatisticsAccumulator>} stats
 * @param {number} [topLimit=10]
 */
export function getStatistics(stats, topLimit = 10) {
    return {
        totalMessages: stats.totalMessages,
        humanMessages: stats.humanMessages,
        botMessages: stats.botMessages,
        uniqueUsers: stats.uniqueUsers.size,
        messagesWithAttachments: stats.messagesWithAttachments,
        editedMessages: stats.editedMessages,

        channels: [...stats.channels.values()]
            .sort((a, b) => b.messageCount - a.messageCount),

        topContributors: [...stats.contributors.values()]
            .sort((a, b) => b.messageCount - a.messageCount)
            .slice(0, topLimit)
    };
}
