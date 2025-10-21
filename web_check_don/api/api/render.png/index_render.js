import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

export const config = { runtime: 'nodejs', maxDuration: 60 };

export default async function handler(req, res) {
  try {
    const { src, out = 'img_hd.png', bucket = 'images', w = '794', s = '2' } = req.query;
    if (!src) return res.status(400).send('Missing query ?src=<public HTML URL>');

    const width = Number(w);
    const scale = Number(s);

    const executablePath = await chromium.executablePath();
    const browser = await puppeteer.launch({
      args: chromium.args,
      executablePath,
      headless: true,
      defaultViewport: { width, height: 1123, deviceScaleFactor: scale },
    });

    const page = await browser.newPage();
    const tsSrc = src + (src.includes('?') ? '&' : '?') + 'ts=' + Date.now();
    await page.goto(tsSrc, { waitUntil: 'networkidle0' });
    await page.addStyleTag({ content: 'html,body{background:#fff}' });

    const png = await page.screenshot({ type: 'png', fullPage: true });
    await browser.close();

    const { SUPABASE_URL, SUPABASE_SERVICE_ROLE } = process.env;
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
      return res.status(500).send('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE env');
    }

    const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${bucket}/${out}`;
    const up = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
        'Content-Type': 'image/png',
        'x-upsert': 'true',
      },
      body: png,
    });
    if (!up.ok) {
      const t = await up.text().catch(() => '');
      return res.status(500).send('Upload PNG failed: ' + up.status + ' ' + t);
    }

    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${out}`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.end(JSON.stringify({ image_url: publicUrl }));
  } catch (e) {
    res.status(500).send(e?.message || 'Error');
  }
}
