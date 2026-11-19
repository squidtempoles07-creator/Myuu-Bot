
import { mkdir, stat, appendFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

// const DEFAULT_CSV_PATH = 'archives/community-summary.csv';

function createSummaryCsvPath(guildName, createdAt) {
    const safeGuildName = (guildName || 'Unknown Guild')
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, '-')
        .replace(/[. ]+$/g, '')
        .trim()
        .slice(0, 80) || 'Unknown Guild';

    const date = new Date(createdAt)
        .toISOString()
        .replace('T', ' ')
        .replace(/\.\d{3}Z$/, '')
        .replace(/:/g, '-');

    return `archives/summary - ${date} - ${safeGuildName}.csv`;
}

const CSV_HEADERS = [
    'summary_id',
    'guild_id',
    'guild_name',
    'selected_channels',
    'period_start',
    'period_end',
    'total_messages',
    'human_messages',
    'bot_messages',
    'unique_users',
    'messages_with_attachments',
    'edited_messages',
    'channel_statistics',
    'top_contributors',
    'summary',
    'processed_messages',
    'processed_chunks',
    'created_at'
];

/**
 * Convert a value into a safe CSV cell.
 */
function escapeCsvCell(value) {
    if (value === null || value === undefined) {
        return '""';
    }

    let text = typeof value === 'object'
        ? JSON.stringify(value)
        : String(value);

    // Reduce spreadsheet formula injection risk.
    if (/^[\t\r\n ]*[=+\-@]/.test(text)) {
        text = `'${text}`;
    }

    return `"${text.replace(/"/g, '""')}"`;
}

/**
 * Convert a row of values into a CSV line.
 */
function createCsvRow(values) {
    return values.map(escapeCsvCell).join(',');
}

/**
 * Export one community summary into a CSV archive.
 *
 * @param {Object} record
 * @param {Object} options
 * @param {string} [options.filePath]
 */
export async function exportSummaryToCsv(
    record,
    {
        filePath = createSummaryCsvPath(record.guildName, record.createdAt)
    } = {}
) {
    if (!record || typeof record !== 'object') {
        throw new Error('Summary record is required.');
    }

    if (typeof record.summary !== 'string' || !record.summary.trim()) {
        throw new Error('Summary content is required.');
    }

    if (!record.statistics || typeof record.statistics !== 'object') {
        throw new Error('Summary statistics are required.');
    }

    const statistics = record.statistics;

    const summaryId = record.summaryId || randomUUID();
    const createdAt = record.createdAt || new Date().toISOString();

    const values = [
        summaryId,
        record.guildId,
        record.guildName,
        record.channels || [],
        record.periodStart,
        record.periodEnd,
        statistics.totalMessages ?? 0,
        statistics.humanMessages ?? 0,
        statistics.botMessages ?? 0,
        statistics.uniqueUsers ?? 0,
        statistics.messagesWithAttachments ?? 0,
        statistics.editedMessages ?? 0,
        statistics.channels || [],
        statistics.topContributors || [],
        record.summary,
        record.processedMessages ?? 0,
        record.processedChunks ?? 0,
        createdAt
    ];

    const absolutePath = resolve(filePath);
    const directory = dirname(absolutePath);

    await mkdir(directory, { recursive: true });

    let needsHeader = false;

    try {
        const fileInfo = await stat(absolutePath);
        needsHeader = fileInfo.size === 0;
    } catch (error) {
        if (error.code !== 'ENOENT') {
            throw error;
        }

        needsHeader = true;
    }

    const lines = [];

    if (needsHeader) {
        lines.push(createCsvRow(CSV_HEADERS));
    }

    lines.push(createCsvRow(values));

    await appendFile(
        absolutePath,
        `${lines.join('\n')}\n`,
        'utf8'
    );

    return {
        summaryId,
        filePath: absolutePath
    };
}
