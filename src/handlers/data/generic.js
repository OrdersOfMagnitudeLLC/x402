module.exports = async function genericHandler(req, res, product) {
  const url = product.source_url || product.url;
  if (!url) return res.status(500).json({ error: 'no_upstream_url' });
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'OOM-x402-API/1.0 (https://ofmagnitude.com; orders@ofmagnitude.com)' }
    });
    clearTimeout(timeout);
    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (parseErr) {
      return res.status(502).json({ error: 'upstream_non_json' });
    }
    res.json(data);
  } catch (err) {
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: 'upstream_timeout' });
    }
    res.status(500).json({ error: 'upstream_error', detail: err.message });
  }
};
