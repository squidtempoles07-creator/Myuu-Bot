const stopWords = new Set(['yang', 'dan', 'untuk', 'dengan', 'dari', 'ini', 'itu', 'akan', 'lagi', 'the', 'and', 'for', 'with', 'from', 'this', 'that']);

function unique(items, limit = 8) {
  return [...new Set(items.map((item) => item.trim()).filter(Boolean))].slice(0, limit);
}

export function extractiveSummary(messages, hours) {
  const texts = messages.map((message) => `${message.author}: ${message.content}`).filter((text) => text.length > 4);
  const participants = new Map();
  const games = new Map();
  const links = new Set();

  for (const message of messages) {
    if (!message.authorBot) participants.set(message.author, (participants.get(message.author) || 0) + 1);
    for (const word of message.content.match(/[A-Za-z][A-Za-z0-9 -]{2,}/g) || []) {
      const normalized = word.trim().toLowerCase();
      if (!stopWords.has(normalized) && normalized.length >= 4) games.set(normalized, (games.get(normalized) || 0) + 1);
    }
    for (const match of message.content.match(/https?:\/\/\S+/g) || []) links.add(match.replace(/[)>.,]+$/, ''));
  }

  const topParticipants = [...participants.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
    .map(([name, count]) => `${name} (${count})`);
  const topics = [...games.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name]) => name);
  const questionCandidates = messages.filter((message) => /\?|help|minta|bantu|gimana|bagaimana/i.test(message.content))
    .map((message) => message.content).slice(0, 6);

  return {
    overview: `${messages.length} pesan dari ${participants.size} pengguna aktif dalam ${hours} jam terakhir.`,
    topicsAndGames: unique(topics, 10),
    highlights: unique(texts.filter((text) => /raid|event|win|menang|match|tournament|turnamen|update/i.test(text)).slice(0, 6), 6),
    decisions: [],
    actionItems: [],
    unansweredQuestions: unique(questionCandidates, 6),
    sentiment: {
      tone: 'Campuran/netral',
      evidence: messages.length ? 'Ringkasan berbasis frekuensi kata karena mode AI lokal aktif.' : 'Belum ada aktivitas.',
    },
    risks: unique(messages.filter((message) => /toxic|spam|report|bug|scam|hack|cheat/i.test(message.content)).map((message) => message.content).slice(0, 6), 6),
    activeParticipants: topParticipants,
    links: [...links].slice(0, 8),
    coverage: {
      messageCount: messages.length,
      channelCount: new Set(messages.map((message) => message.channelName)).size,
      participantCount: participants.size,
      botMessagesExcluded: messages.filter((message) => message.authorBot).length ? false : true,
    },
  };
}

function normalizeResult(value, fallback) {
  const result = value && typeof value === 'object' ? value : {};
  return {
    overview: typeof result.overview === 'string' ? result.overview : fallback.overview,
    topicsAndGames: Array.isArray(result.topicsAndGames) ? result.topicsAndGames.map(String) : fallback.topicsAndGames,
    highlights: Array.isArray(result.highlights) ? result.highlights.map(String) : fallback.highlights,
    decisions: Array.isArray(result.decisions) ? result.decisions.map(String) : [],
    actionItems: Array.isArray(result.actionItems) ? result.actionItems.map(String) : [],
    unansweredQuestions: Array.isArray(result.unansweredQuestions) ? result.unansweredQuestions.map(String) : fallback.unansweredQuestions,
    sentiment: result.sentiment && typeof result.sentiment === 'object'
      ? { tone: String(result.sentiment.tone || fallback.sentiment.tone), evidence: String(result.sentiment.evidence || fallback.sentiment.evidence) }
      : fallback.sentiment,
    risks: Array.isArray(result.risks) ? result.risks.map(String) : [],
    activeParticipants: Array.isArray(result.activeParticipants) ? result.activeParticipants.map(String) : fallback.activeParticipants,
    links: Array.isArray(result.links) ? result.links.map(String) : fallback.links,
    coverage: fallback.coverage,
  };
}

export async function summarizeMessages(messages, hours) {
  const fallback = extractiveSummary(messages, hours);
  if (!process.env.AI_API_KEY) return { ...fallback, mode: 'extractive' };

  const sample = messages.slice(-800).map((message) =>
    `[${message.createdAt.toISOString()}] #${message.channelName} ${message.author}: ${message.content.replace(/\s+/g, ' ').slice(0, 1200)}`,
  ).join('\n').slice(-180000);

  const response = await fetch(process.env.AI_PROVIDER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.AI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.AI_MODEL || 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content: 'You are an analyst for a gaming Discord community. Analyze only supplied messages. Return valid JSON with keys: overview, topicsAndGames, highlights, decisions, actionItems, unansweredQuestions, sentiment ({tone,evidence}), risks, activeParticipants, links. Keep claims grounded in the messages and redact secrets or access tokens.',
        },
        { role: 'user', content: `Summarize the last ${hours} hours. Messages:\n${sample || 'No messages found.'}` },
      ],
    }),
  });

  if (!response.ok) throw new Error(`AI provider returned ${response.status}: ${await response.text()}`);
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  let parsed;
  try { parsed = JSON.parse(content); } catch { throw new Error('AI provider returned invalid JSON'); }
  return { ...normalizeResult(parsed, fallback), mode: 'ai' };
}
