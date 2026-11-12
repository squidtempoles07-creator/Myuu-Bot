
import {
    Client,
    Events,
    GatewayIntentBits
} from 'discord.js';

export async function startGateway() {
    const token = process.env.DISCORD_TOKEN;

    if (!token) {
        throw new Error('DISCORD_TOKEN is missing in .env');
    }

    const client = new Client({
        intents: [
            GatewayIntentBits.Guilds
        ]
    });

    client.once(Events.ClientReady, (readyClient) => {
        console.log(
            `[Gateway] Logged in as ${readyClient.user.tag}`
        );
    });

    client.on(Events.Error, (error) => {
        console.error('[Gateway Error]', error);
    });

    await client.login(token);

    return client;
}
