import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";

export const config = { runtime: "nodejs", maxDuration: 60 };

export default async function handler(req, res) {
  const proto = req.headers["x-forwarded-proto"] === "https" ? "https" : "http";
  const base = `${proto}://${req.headers.host}`;
  const url = new URL(req.url, base);
  const pageUrl = url.searchParams.get("url") || `${base}/images.html`; // KHÔNG thêm ?date

  let browser;
  try {
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: { width: 1024, height: 768, deviceScaleFactor: 1 },
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });
    const page = await browser.newPage();
    await page.goto(pageUrl, { waitUntil: "networkidle2", timeout: 30000 }); // mở y như refresh
    await new Promise(r => setTimeout(r, 5000)); // chờ JS của bạn upload
    res.status(200).json({ ok: true, opened: pageUrl });
  } catch (e) {
    res.status(500).end("Headless error: " + e.message);
  } finally {
    if (browser) try { await browser.close(); } catch {}
  }
}
