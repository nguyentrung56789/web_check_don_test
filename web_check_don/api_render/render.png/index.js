import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";

export const config = { runtime: "nodejs", maxDuration: 60 };

/**
 * GET /api_render/render.png?src=<PUBLIC_HTML_URL>&w=794&s=2
 * - Render HTML (public URL) to PNG and return the image directly.
 * - No Supabase upload, no extra step.
 */
export default async function handler(req, res) {
  try {
    const base = `http${req.headers["x-forwarded-proto"] === "https" ? "s" : ""}://${req.headers.host}`;
    const urlObj = new URL(req.url, base);
    const src = urlObj.searchParams.get("src");
    const width = Number(urlObj.searchParams.get("w") || 794);
    const scale = Number(urlObj.searchParams.get("s") || 2);

    if (!src) {
      res.statusCode = 400;
      return res.end("Missing query ?src=<PUBLIC_HTML_URL>");
    }

    const execPath = await chromium.executablePath();
    const browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: execPath,
      headless: true,
      defaultViewport: { width, height: 1123, deviceScaleFactor: scale },
    });

    try {
      const page = await browser.newPage();
      // Avoid cached content
      const srcWithTs = src + (src.includes("?") ? "&" : "?") + "ts=" + Date.now();
      await page.goto(srcWithTs, { waitUntil: "networkidle0" });
      await page.addStyleTag({ content: "html,body{background:#fff}" });

      const png = await page.screenshot({ type: "png", fullPage: true });

      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", "public, max-age=60");
      return res.end(png);
    } finally {
      await browser.close();
    }
  } catch (err) {
    console.error("Render error:", err);
    res.statusCode = 500;
    return res.end("Render failed: " + (err?.message || String(err)));
  }
}
