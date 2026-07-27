module.exports = async function genericHandler(req, res, product) {
  const url = product.source_url || product.url;
  if (!url) return res.status(500).json({ error: 'no_upstream_url' });
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'OOM-Crawler/1.0 (orders@ofmagnitude.com)' }
    });
    clearTimeout(timeout);
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('json')) {
      return res.status(502).json({ error: 'upstream_non_json' });
    }
    const data = await response.json();
    res.json(data);
  } catch (err) {
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: 'upstream_timeout' });
    }
    res.status(500).json({ error: 'upstream_error', detail: err.message });
  }
};
