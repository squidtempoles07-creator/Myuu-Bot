
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
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.MessageContent
        ]
    });

    client.once(Events.ClientReady, (readyClient) => {
        console.log(
            `[Gateway] Logged in as ${readyClient.user.tag}`
        );
    });

    client.on(Events.MessageCreate, (message) => {
        // Ignore messages from bots
        if (message.author.bot) return;

        console.log('------------------------------');
        console.log(`[Guild] ${message.guild?.name ?? 'DM'}`);
        console.log(`[Channel] ${message.channel.name ?? message.channelId}`);
        console.log(`[User] ${message.author.tag}`);
        console.log(`[Message] ${message.content}`);
        console.log('------------------------------');
    });

    client.on(Events.Error, (error) => {
        console.error('[Gateway Error]', error);
    });

    await client.login(token);

    return client;
}
