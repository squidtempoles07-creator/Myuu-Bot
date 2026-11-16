
import test from 'node:test';
import assert from 'node:assert/strict';

import {
    createStatisticsAccumulator,
    addMessageBatch,
    getStatistics
} from '../services/statistics.js';

test('should calculate statistics from multiple message batches', () => {
    const stats = createStatisticsAccumulator();

    const batch1 = [
        {
            id: '1',
            channelId: 'channel-1',
            channelName: 'general',
            authorId: 'user-1',
            authorName: 'Alice',
            authorIsBot: false,
            attachments: [],
            editedAt: null
        },
        {
            id: '2',
            channelId: 'channel-1',
            channelName: 'general',
            authorId: 'user-2',
            authorName: 'Bob',
            authorIsBot: false,
            attachments: [{ name: 'image.png' }],
            editedAt: null
        }
    ];

    const batch2 = [
        {
            id: '3',
            channelId: 'channel-2',
            channelName: 'gaming',
            authorId: 'bot-1',
            authorName: 'Myuu Bot',
            authorIsBot: true,
            attachments: [],
            editedAt: null
        },
        {
            id: '4',
            channelId: 'channel-1',
            channelName: 'general',
            authorId: 'user-1',
            authorName: 'Alice',
            authorIsBot: false,
            attachments: [],
            editedAt: '2026-11-16T10:00:00.000Z'
        }
    ];

    addMessageBatch(stats, batch1);
    addMessageBatch(stats, batch2);

    const result = getStatistics(stats);

    assert.equal(result.totalMessages, 4);
    assert.equal(result.humanMessages, 3);
    assert.equal(result.botMessages, 1);
    assert.equal(result.uniqueUsers, 2);
    assert.equal(result.messagesWithAttachments, 1);
    assert.equal(result.editedMessages, 1);

    assert.equal(result.channels.length, 2);
    assert.equal(result.channels[0].channelName, 'general');
    assert.equal(result.channels[0].messageCount, 3);

    assert.equal(result.topContributors.length, 2);
    assert.equal(result.topContributors[0].authorName, 'Alice');
    assert.equal(result.topContributors[0].messageCount, 2);
});

test('should return empty statistics when there are no messages', () => {
    const stats = createStatisticsAccumulator();
    const result = getStatistics(stats);

    assert.equal(result.totalMessages, 0);
    assert.equal(result.uniqueUsers, 0);
    assert.equal(result.channels.length, 0);
    assert.equal(result.topContributors.length, 0);
});
