
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

test('should create CSV file with header and summary data', async () => {
    const directory = await mkdtemp(
        join(tmpdir(), 'myuu-csv-test-')
    );

    const filePath = join(directory, 'summary.csv');

    try {
        const result = await exportSummaryToCsv(
            createTestRecord('Community discussed gaming events.'),
            { filePath }
        );

        const content = await readFile(filePath, 'utf8');

        assert.ok(result.summaryId);
        assert.equal(result.filePath, filePath);

        assert.ok(content.includes('summary_id'));
        assert.ok(content.includes('guild_name'));
        assert.ok(content.includes('total_messages'));
        assert.ok(content.includes('Community discussed gaming events.'));
    } finally {
        await rm(directory, { recursive: true, force: true });
    }
});

test('should append summaries without duplicating CSV header', async () => {
    const directory = await mkdtemp(
        join(tmpdir(), 'myuu-csv-test-')
    );

    const filePath = join(directory, 'summary.csv');

    try {
        await exportSummaryToCsv(
            createTestRecord('First community summary.'),
            { filePath }
        );

        await exportSummaryToCsv(
            createTestRecord('Second community summary.'),
            { filePath }
        );

        const content = await readFile(filePath, 'utf8');

        const headerCount = content
            .split('\n')
            .filter(line => line.startsWith('"summary_id"'))
            .length;

        assert.equal(headerCount, 1);

        assert.ok(content.includes('First community summary.'));
        assert.ok(content.includes('Second community summary.'));
    } finally {
        await rm(directory, { recursive: true, force: true });
    }
});

test('should escape commas and quotation marks in CSV values', async () => {
    const directory = await mkdtemp(
        join(tmpdir(), 'myuu-csv-test-')
    );

    const filePath = join(directory, 'summary.csv');

    try {
        await exportSummaryToCsv(
            createTestRecord('Community discussed "gaming", events.'),
            { filePath }
        );

        const content = await readFile(filePath, 'utf8');

        assert.ok(
            content.includes('"Community discussed ""gaming"", events."')
        );
    } finally {
        await rm(directory, { recursive: true, force: true });
    }
});
