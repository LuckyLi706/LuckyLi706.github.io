import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const output = path.join(root, "public", "data", "macro.json");

const reports = {
  pmi: "RPT_ECONOMY_PMI",
  cpi: "RPT_ECONOMY_CPI",
  ppi: "RPT_ECONOMY_PPI",
  gdp: "RPT_ECONOMY_GDP",
  money: "RPT_ECONOMY_CURRENCY_SUPPLY",
};

async function latest(reportName) {
  const url = new URL("https://datacenter-web.eastmoney.com/api/data/v1/get");
  url.searchParams.set("reportName", reportName);
  url.searchParams.set("columns", "ALL");
  url.searchParams.set("sortColumns", "REPORT_DATE");
  url.searchParams.set("sortTypes", "-1");
  url.searchParams.set("pageSize", "3");
  url.searchParams.set("pageNumber", "1");

  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "Mozilla/5.0 public-data-research-dashboard",
    },
  });
  if (!response.ok) {
    throw new Error(`${reportName} returned HTTP ${response.status}`);
  }
  const payload = await response.json();
  const row = payload?.result?.data?.[0];
  if (!row) throw new Error(`${reportName} returned no observations`);
  return row;
}

const period = (row) =>
  String(row.TIME ?? row.REPORT_DATE ?? "")
    .replace(" 00:00:00", "")
    .replace("年", "-")
    .replace("月份", "")
    .replace("月", "");

try {
  const [pmi, cpi, ppi, gdp, money] = await Promise.all(
    Object.values(reports).map(latest),
  );

  const snapshot = {
    generatedAt: new Date().toISOString(),
    provider:
      "指标原始口径来自国家统计局、中国人民银行；本页通过东方财富公开数据接口生成只读快照。",
    metrics: [
      {
        key: "manufacturing-pmi",
        name: "制造业 PMI",
        value: Number(pmi.MAKE_INDEX),
        unit: "",
        period: period(pmi),
        description: "50 为扩张与收缩分界，按月公布。",
        source: "https://data.stats.gov.cn/easyquery.htm?cn=A01",
      },
      {
        key: "non-manufacturing-pmi",
        name: "非制造业 PMI",
        value: Number(pmi.NMAKE_INDEX),
        unit: "",
        period: period(pmi),
        description: "反映服务业和建筑业商务活动。",
        source: "https://data.stats.gov.cn/easyquery.htm?cn=A01",
      },
      {
        key: "cpi-yoy",
        name: "CPI 同比",
        value: Number(cpi.NATIONAL_SAME),
        unit: "%",
        period: period(cpi),
        description: "全国居民消费价格同比变化。",
        source: "https://data.stats.gov.cn/easyquery.htm?cn=A01",
      },
      {
        key: "ppi-yoy",
        name: "PPI 同比",
        value: Number(ppi.BASE_SAME),
        unit: "%",
        period: period(ppi),
        description: "工业生产者出厂价格同比变化。",
        source: "https://data.stats.gov.cn/easyquery.htm?cn=A01",
      },
      {
        key: "gdp-yoy",
        name: "GDP 累计同比",
        value: Number(gdp.SUM_SAME),
        unit: "%",
        period: period(gdp),
        description: "国内生产总值累计同比增速，按季公布。",
        source: "https://data.stats.gov.cn/easyquery.htm?cn=A01",
      },
      {
        key: "m2-yoy",
        name: "广义货币同比",
        value: Number(money.BASIC_CURRENCY_SAME),
        unit: "%",
        period: period(money),
        description: "广义货币供应量 M2 同比增速。",
        source:
          "https://www.pbc.gov.cn/diaochatongjisi/116219/index.html",
      },
    ],
  };

  for (const metric of snapshot.metrics) {
    if (!Number.isFinite(metric.value)) {
      throw new Error(`Invalid value for ${metric.key}`);
    }
  }

  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  console.log(`Updated ${path.relative(root, output)}`);
} catch (error) {
  try {
    const previous = JSON.parse(await readFile(output, "utf8"));
    if (Array.isArray(previous.metrics) && previous.metrics.length) {
      console.warn(`Public macro refresh failed; keeping prior snapshot: ${error}`);
      process.exitCode = 0;
    } else {
      throw error;
    }
  } catch {
    throw error;
  }
}
