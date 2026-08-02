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

test("server-renders the macro and autonomous research terminal", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>砺石情景研究终端<\/title>/i);
  assert.match(html, /中国宏观雷达/);
  assert.match(html, /增长动能/);
  assert.match(html, /信用脉冲/);
  assert.match(html, /自主学习中心/);
  assert.match(html, /冠军晋级门槛/);
  assert.doesNotMatch(html, /codex-preview/);
});

test("keeps the macro model connected to ranking and risk controls", async () => {
  const [page, layout, css] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(page, /stock\.macroBeta \* macroImpulse/);
  assert.match(page, /正式接数后保留首次发布日期与修订值/);
  assert.match(page, /模型不会自动下单/);
  assert.match(page, /基金经理人工批准/);
  assert.match(layout, /中国宏观/);
  assert.match(css, /\.macro-factor-grid/);
  assert.match(css, /\.promotion-gate/);
  assert.doesNotMatch(layout, /codex-preview|_sites-preview|themeColor|\bViewport\b/);
});
