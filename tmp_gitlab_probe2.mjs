const token = 'glpat-bXOBxqE_wKwjryrlWVMe6WM6MQpvOjEKdTptdXpicg8.01.170s91x32';

async function probe(name, url) {
  console.log('\n=== ' + name + ' ===');
  console.log('URL:', url);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const r = await fetch(url, {
      headers: {
        'PRIVATE-TOKEN': token,
        'Accept': 'application/json',
        'User-Agent': 'KUP50-Integration/1.0'
      },
      redirect: 'manual',
      signal: controller.signal
    });
    clearTimeout(timeout);
    const text = await r.text();
    let json;
    try { json = JSON.parse(text); } catch (e) { json = null; }
    console.log('STATUS:', r.status);
    console.log('CT:', r.headers.get('content-type'));
    console.log('TEXT-LEN:', text.length);
    console.log('PARSED-ARRAY:', Array.isArray(json), 'LEN:', Array.isArray(json) ? json.length : 'n/a');
    console.log('BODY-SAMPLE:', text.slice(0, 800));
  } catch (err) {
    clearTimeout(timeout);
    console.error('ERROR:', err.name, err.message);
  }
}

await probe('merge_requests', 'https://gitlab.com/api/v4/merge_requests?scope=all&order_by=updated_at&sort=desc&per_page=5');
await probe('commits', 'https://gitlab.com/api/v4/projects/30890252/repository/commits?per_page=5');
