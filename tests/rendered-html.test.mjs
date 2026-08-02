import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the public-data research terminal", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>砺石情景研究终端<\/title>/i);
  assert.match(html, /中国宏观公开数据/);
  assert.match(html, /真实行情选股台/);
  assert.match(html, /真实历史价格回测/);
  assert.match(html, /数据管线状态/);
  assert.match(html, /模型训练与自动换模/);
  assert.match(html, /情景推演为研究假设/);
  assert.doesNotMatch(html, /codex-preview/);
});

test("uses public endpoints and removes fabricated ranking claims", async () => {
  const [page, layout, css, macro, workflow] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../public/data/macro.json", import.meta.url), "utf8"),
    readFile(new URL("../.github/workflows/pages.yml", import.meta.url), "utf8"),
  ]);

  assert.match(page, /push2\.eastmoney\.com/);
  assert.match(page, /push2his\.eastmoney\.com/);
  assert.match(page, /fetch\("\.\/data\/macro\.json"/);
  assert.match(page, /calculateBacktest/);
  assert.doesNotMatch(page, /stock\.base|macroImpulse|runTraining|样本外夏普/);
  assert.match(layout, /免费公开行情/);
  assert.match(css, /\.macro-factor-grid/);
  assert.match(css, /\.live-detail-grid/);
  assert.match(macro, /制造业 PMI/);
  assert.match(workflow, /npm run fetch:data/);
  assert.match(workflow, /schedule:/);
  assert.doesNotMatch(layout, /codex-preview|_sites-preview|themeColor|\bViewport\b/);
});
