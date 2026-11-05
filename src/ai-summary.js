export function buildFallbackSummary(messages, hours, channelCount, botFiltered) {
  const visible = messages.filter((message) => message.author && !message.author.bot);
  const byAuthor = new Map();
  const terms = new Map();
  const noise = new Set(['the', 'and', 'for', 'that', 'with', 'this', 'you', 'from', 'have', 'are', 'was', 'but']);

  for (const message of visible) {
    const name = message.author.username;
    byAuthor.set(name, (byAuthor.get(name) || 0) + 1);
    for (const word of message.cleanContent.toLowerCase().match(/[a-z0-9]{4,}/g) || []) {
      if (!noise.has(word)) terms.set(word, (terms.get(word) || 0) + 1);
    }
  }

  const participants = [...byAuthor.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  const topics = [...terms.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([word]) => word);
  const samples = visible
    .slice(-12)
    .map((message) => `- #${message.channel.name}: ${message.author.username}: ${message.cleanContent.slice(0, 180)}`)
    .join('\n');

  return {
    title: `Community digest - last ${hours} hour${hours === 1 ? '' : 's'}`,
    overview: `Collected ${visible.length} human messages from ${channelCount} channel${channelCount === 1 ? '' : 's'}${botFiltered ? ' (bot messages excluded)' : ''}.`,
    topics: topics.length ? topics.join(', ') : 'No clear recurring topics were detected.',
    highlights: samples || 'No substantive messages were found in the requested period.',
    decisions: 'No explicit decisions could be identified without an AI provider.',
    actions: 'No explicit action items could be identified without an AI provider.',
    unanswered: 'No unanswered questions could be classified without an AI provider.',
    sentiment: 'Mixed/unknown; configure AI_PROVIDER_URL and AI_API_KEY for AI sentiment analysis.',
    participants: participants.length ? participants.map(([name, count]) => `${name} (${count})`).join(', ') : 'No human participants.',
  };
}

export async function summarizeWithAI(messages, options, aiConfig) {
  if (!aiConfig.apiKey) return buildFallbackSummary(messages, options.hours, options.channelCount, options.excludeBots);

  const transcript = messages
    .filter((message) => message.author && (options.excludeBots ? !message.author.bot : true))
    .map((message) => `[${message.createdAt.toISOString()}] #${message.channel.name} ${message.author.username}: ${message.cleanContent}`)
    .join('\n')
    .slice(-180000);

  const prompt = `Analyze this gaming community transcript for the last ${options.hours} hours across all accessible channels.
Return strict JSON with keys: title, overview, topics (array), highlights (array), decisions (array),
actions (array), unanswered (array), sentiment, participants (array), risks (array).
Include active games, events, technical issues, moderation themes, member needs, and ambiguity.
Do not invent facts. If a section has no evidence, use an empty array or "Not detected".`;

  const response = await fetch(aiConfig.providerUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${aiConfig.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: aiConfig.model,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: transcript || 'No messages found in the requested period.' },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`AI provider returned ${response.status}: ${body.slice(0, 300)}`);
  }

  const data = await response.json();
  const raw = data.choices?.[0]?.message?.content;
  if (!raw) throw new Error('AI provider returned no summary content');

  const parsed = JSON.parse(raw);
  return {
    title: parsed.title || `Community digest - last ${options.hours} hours`,
    overview: parsed.overview || 'Not detected',
    topics: Array.isArray(parsed.topics) ? parsed.topics.join(', ') : String(parsed.topics || 'Not detected'),
    highlights: Array.isArray(parsed.highlights) ? parsed.highlights.map((item) => `- ${item}`).join('\n') : String(parsed.highlights || 'Not detected'),
    decisions: Array.isArray(parsed.decisions) ? parsed.decisions.map((item) => `- ${item}`).join('\n') : String(parsed.decisions || 'Not detected'),
    actions: Array.isArray(parsed.actions) ? parsed.actions.map((item) => `- ${item}`).join('\n') : String(parsed.actions || 'Not detected'),
    unanswered: Array.isArray(parsed.unanswered) ? parsed.unanswered.map((item) => `- ${item}`).join('\n') : String(parsed.unanswered || 'Not detected'),
    sentiment: parsed.sentiment || 'Not detected',
    participants: Array.isArray(parsed.participants) ? parsed.participants.join(', ') : String(parsed.participants || 'Not detected'),
    risks: Array.isArray(parsed.risks) ? parsed.risks.map((item) => `- ${item}`).join('\n') : String(parsed.risks || 'Not detected'),
  };
}
