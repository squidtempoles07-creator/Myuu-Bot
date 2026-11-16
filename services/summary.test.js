
import test from 'node:test';
import assert from 'node:assert/strict';

import {
    generateCommunitySummary
} from '../services/summary.js';

const originalFetch = globalThis.fetch;

async function* createMessageBatches(messages) {
    yield messages.slice(0, 2);

    if (messages.length > 2) {
        yield messages.slice(2);
    }
}

function createMockResponse(content) {
    return new Response(
        JSON.stringify({
            choices: [
                {
                    message: {
                        content
                    }
                }
            ]
        }),
        {
            status: 200,
            headers: {
                'Content-Type': 'application/json'
            }
        }
    );
}

test('should generate a summary from message batches', async () => {
    process.env.AI_PROVIDER_URL = 'https://example.com/chat/completions';
    process.env.AI_API_KEY = 'test-api-key';
    process.env.AI_MODEL = 'test-model';

    const requests = [];

    globalThis.fetch = async (url, options) => {
        requests.push(JSON.parse(options.body));

        return createMockResponse(
            requests.length === 1
                ? 'Partial community summary'
                : 'Final community summary'
        );
    };

    try {
        const messages = [
            {
                id: '1',
                authorName: 'Alice',
                authorIsBot: false,
                timestamp: '2026-11-16T10:00:00.000Z',
                content: 'Hello everyone!',
                attachments: []
            }
        ];

        const result = await generateCommunitySummary(
            createMessageBatches(messages)
        );

        assert.equal(result.summary, 'Partial community summary');
        assert.equal(result.processedMessages, 1);
        assert.equal(result.processedChunks, 1);
        assert.equal(requests.length, 1);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test('should combine multiple partial summaries', async () => {
    process.env.AI_PROVIDER_URL = 'https://example.com/chat/completions';
    process.env.AI_API_KEY = 'test-api-key';
    process.env.AI_MODEL = 'test-model';

    const requests = [];

    globalThis.fetch = async (url, options) => {
        requests.push(JSON.parse(options.body));

        return createMockResponse(
            `Summary ${requests.length}`
        );
    };

    try {
        const messages = [
            {
                id: '1',
                authorName: 'Alice',
                authorIsBot: false,
                timestamp: '2026-11-16T10:00:00.000Z',
                content: 'A'.repeat(60),
                attachments: []
            },
            {
                id: '2',
                authorName: 'Bob',
                authorIsBot: false,
                timestamp: '2026-11-16T10:01:00.000Z',
                content: 'B'.repeat(60),
                attachments: []
            }
        ];

        const result = await generateCommunitySummary(
            createMessageBatches(messages),
            {
                chunkCharacterLimit: 100
            }
        );

        assert.equal(result.summary, 'Summary 3');
        assert.equal(result.processedMessages, 2);
        assert.equal(result.processedChunks, 2);

        // Two partial summaries + one final summary request
        assert.equal(requests.length, 3);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test('should handle empty message batches', async () => {
    let requestCount = 0;

    globalThis.fetch = async () => {
        requestCount++;
        return createMockResponse('Unexpected request');
    };

    try {
        const result = await generateCommunitySummary(
            createMessageBatches([])
        );

        assert.equal(result.processedMessages, 0);
        assert.equal(result.processedChunks, 0);
        assert.equal(requestCount, 0);
    } finally {
        globalThis.fetch = originalFetch;
    }
});
