
import 'dotenv/config';
import { DiscordRequest } from './utils.js';

async function clearGuildCommands() {
    const appId = process.env.APP_ID;
    const guildId = process.env.GUILD_ID;

    if (!appId || !guildId) {
        throw new Error('APP_ID or GUILD_ID is missing');
    }

    const endpoint =
        `applications/${appId}/guilds/${guildId}/commands`;

    const response = await DiscordRequest(endpoint, {
        method: 'PUT',
        body: []
    });

    const result = await response.json();

    console.log('[Success] Guild commands cleared!');
    console.log('Remaining commands:', result.length);
}

clearGuildCommands().catch(console.error);
