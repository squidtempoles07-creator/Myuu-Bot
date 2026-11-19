
import test from 'node:test';
import assert from 'node:assert/strict';

import {
    mkdtemp,
    readFile,
    rm
} from 'node:fs/promises';

import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
    exportSummaryToCsv
} from '../services/csvExporter.js';

function createTestRecord(summary) {
    return {
        guildId: '123456789',
        guildName: 'Myuu Gaming Community',

        channels: [
            {
                channelId: '111',
                channelName: 'general'
            },
            {
                channelId: '222',
                channelName: 'gaming'
            }
        ],

        periodStart: '2026-11-09T00:00:00.000Z',
        periodEnd: '2026-11-16T00:00:00.000Z',

        statistics: {
            totalMessages: 100,
            humanMessages: 90,
            botMessages: 10,
            uniqueUsers: 25,
            messagesWithAttachments: 5,
            editedMessages: 2,
            channels: [],
            topContributors: []
        },

        summary,
        processedMessages: 100,
        processedChunks: 2
    };
}

test('should create a new CSV file when filename already exists', async () => {
    const directory = await mkdtemp(
        join(tmpdir(), 'myuu-csv-test-')
    );

    const filePath = join(directory, 'summary.csv');
    const secondFilePath = join(directory, 'summary (1).csv');

    try {
        const firstResult = await exportSummaryToCsv(
            createTestRecord('First community summary.'),
            { filePath }
        );

        const secondResult = await exportSummaryToCsv(
            createTestRecord('Second community summary.'),
            { filePath }
        );

        const firstContent = await readFile(filePath, 'utf8');
        const secondContent = await readFile(secondFilePath, 'utf8');

        assert.equal(firstResult.filePath, filePath);
        assert.equal(secondResult.filePath, secondFilePath);

        assert.ok(firstContent.includes('First community summary.'));
        assert.ok(!firstContent.includes('Second community summary.'));

        assert.ok(secondContent.includes('Second community summary.'));
        assert.ok(!secondContent.includes('First community summary.'));
    } finally {
        await rm(directory, { recursive: true, force: true });
    }
});