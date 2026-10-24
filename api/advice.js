// Vercel Serverless Function (Node.js): необязательный облачный ИИ-помощник.
// Работает, только если в Vercel задана переменная окружения ANTHROPIC_API_KEY.
// Без ключа возвращает 501 — приложение тогда показывает встроенный анализ.
// В функцию приходят ТОЛЬКО анонимные оценки (без ФИО). ИИ только советует — оценки он не меняет.
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(501).json({ error: 'AI is not configured' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = null; } }
  if (!body || !Array.isArray(body.grades) || body.grades.length > 100) return res.status(400).json({ error: 'bad request' });

  const system = 'Ты — ЖАРДАМЧЫ AI, помощник учителя в электронном дневнике SABAK+. ' +
    'Ты НЕ выставляешь, НЕ изменяешь и НЕ утверждаешь оценки — только даёшь рекомендации; решение всегда за учителем. ' +
    'Отвечай по-русски, кратко (до 120 слов): 1) что видно по динамике; 2) где возможна проблема или нехватка данных; ' +
    '3) 2–3 конкретных педагогических шага. Типы работ: hw=ДЗ, act=активность, ind=самостоятельная, test=контрольная (вес 2), talk=доклад, essay=реферат.';
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5',
        max_tokens: 400,
        system,
        messages: [{ role: 'user', content: 'Данные ученика (анонимно):\n' + JSON.stringify(body) }],
      }),
    });
    if (!r.ok) return res.status(502).json({ error: 'upstream ' + r.status });
    const j = await r.json();
    const text = (j.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
    return res.status(200).json({ text: text || 'Нет ответа.' });
  } catch (e) {
    return res.status(502).json({ error: 'upstream error' });
  }
};
