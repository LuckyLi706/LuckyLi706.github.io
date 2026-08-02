"use client";

import { useEffect, useMemo, useState } from "react";

type Chain = "all" | "benefit" | "stress";

type Stock = {
  ticker: string;
  secid: string;
  name: string;
  sector: string;
  eventBeta: number;
  thesis: string;
  risk: string;
};

type Quote = {
  ticker: string;
  name: string;
  price: number | null;
  changePct: number | null;
  change: number | null;
  turnover: number | null;
  pe: number | null;
  pb: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  previousClose: number | null;
  updatedAt: string;
};

type PricePoint = {
  date: string;
  close: number;
};

type MacroMetric = {
  key: string;
  name: string;
  value: number | null;
  unit: string;
  period: string;
  description: string;
  source: string;
};

type MacroSnapshot = {
  generatedAt: string;
  provider: string;
  metrics: MacroMetric[];
};

type BacktestResult = {
  annualized: number;
  benchmarkAnnualized: number;
  maxDrawdown: number;
  sharpe: number;
  start: string;
  end: string;
  observations: number;
  strategyPolygon: string;
  benchmarkPolygon: string;
};

const STOCKS: Stock[] = [
  {
    ticker: "600938",
    secid: "1.600938",
    name: "中国海油",
    sector: "油气开采",
    eventBeta: 0.31,
    thesis: "高油价可能增厚上游盈利，自由现金流与股东回报形成缓冲。",
    risk: "停火快于预期、油价风险溢价快速回吐。",
  },
  {
    ticker: "601808",
    secid: "1.601808",
    name: "中海油服",
    sector: "油服工程",
    eventBeta: 0.24,
    thesis: "油企资本开支若抬升，钻井平台利用率和日费率存在改善空间。",
    risk: "油价冲击短暂，油企资本开支未跟随上行。",
  },
  {
    ticker: "601899",
    secid: "1.601899",
    name: "紫金矿业",
    sector: "有色金属",
    eventBeta: 0.13,
    thesis: "黄金与铜的组合暴露可能提供避险和供给扰动的双重弹性。",
    risk: "美元与实际利率同步走高，可能压制贵金属估值。",
  },
  {
    ticker: "600028",
    secid: "1.600028",
    name: "中国石化",
    sector: "炼化一体化",
    eventBeta: 0.04,
    thesis: "库存收益可能提供阶段性支撑，但炼化价差决定最终盈利弹性。",
    risk: "原料上涨快于成品油调价，炼化毛利受到挤压。",
  },
  {
    ticker: "600309",
    secid: "1.600309",
    name: "万华化学",
    sector: "基础化工",
    eventBeta: -0.22,
    thesis: "龙头具备一定成本转嫁能力，但短期可能受能源与原料价格压制。",
    risk: "油价持续高位且终端需求偏弱，产品价差收缩。",
  },
  {
    ticker: "600029",
    secid: "1.600029",
    name: "南方航空",
    sector: "航空机场",
    eventBeta: -0.34,
    thesis: "油价与绕航成本上升可能压制利润，票价传导存在时滞。",
    risk: "航油成本超预期上升、国际航线恢复受阻。",
  },
];

const PRESETS = {
  ceasefire: { conflict: 32, hormuz: 18, duration: 2, label: "快速停火" },
  contained: { conflict: 64, hormuz: 47, duration: 6, label: "局部延续" },
  blockade: { conflict: 88, hormuz: 82, duration: 10, label: "海峡受阻" },
};

const NAV = [
  ["⌂", "今日总览"],
  ["◎", "事件推演"],
  ["▦", "中国宏观"],
  ["◇", "选股工作台"],
  ["↗", "真实回测"],
  ["↻", "数据管线"],
  ["?", "研究课堂"],
];

const QUOTE_URL =
  "https://push2.eastmoney.com/api/qt/ulist.np/get?fltt=2&invt=2&fields=f2,f3,f4,f8,f9,f12,f14,f15,f16,f17,f18,f20,f23,f124&secids=" +
  STOCKS.map((stock) => stock.secid).join(",");

const HISTORY_URL = (secid: string, limit = 760) =>
  `https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=${secid}&klt=101&fqt=1&lmt=${limit}&end=20500101&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61`;

const toNumber = (value: unknown) => {
  const number = Number(value);
  return Number.isFinite(number) && value !== "-" ? number : null;
};

const percent = (value: number | null | undefined, digits = 2) =>
  value == null ? "--" : `${value > 0 ? "+" : ""}${value.toFixed(digits)}%`;

const numberText = (value: number | null | undefined, digits = 2) =>
  value == null ? "--" : value.toFixed(digits);

const formatDateTime = (value: string | number | null | undefined) => {
  if (!value) return "--";
  const date =
    typeof value === "number" ? new Date(value * 1000) : new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Shanghai",
  }).format(date);
};

const momentum20 = (points: PricePoint[] | undefined) => {
  if (!points || points.length < 21) return null;
  const latest = points.at(-1)?.close;
  const start = points.at(-21)?.close;
  if (!latest || !start) return null;
  return (latest / start - 1) * 100;
};

const polygonPair = (
  strategy: number[],
  benchmark: number[],
): [string, string] => {
  if (strategy.length < 2 || benchmark.length < 2) {
    return ["polygon(0 100%,100% 100%)", "polygon(0 100%,100% 100%)"];
  }
  const step = Math.max(1, Math.floor(strategy.length / 90));
  const indexes = Array.from(
    { length: Math.ceil(strategy.length / step) },
    (_, index) => Math.min(index * step, strategy.length - 1),
  );
  if (indexes.at(-1) !== strategy.length - 1) indexes.push(strategy.length - 1);
  const all = [...strategy, ...benchmark];
  const min = Math.min(...all);
  const max = Math.max(...all);
  const range = Math.max(max - min, 0.01);
  const make = (values: number[]) => {
    const line = indexes
      .map((index, pointIndex) => {
        const x = (pointIndex / (indexes.length - 1)) * 100;
        const y = 90 - ((values[index] - min) / range) * 78;
        return `${x.toFixed(1)}% ${y.toFixed(1)}%`;
      })
      .join(",");
    return `polygon(${line},100% 100%,0 100%)`;
  };
  return [make(strategy), make(benchmark)];
};

const calculateBacktest = (
  histories: Record<string, PricePoint[]>,
  benchmark: PricePoint[],
  tickers: string[],
): BacktestResult | null => {
  if (!tickers.length || !benchmark.length) return null;
  const series = tickers.map((ticker) => histories[ticker] ?? []);
  if (series.some((points) => points.length < 30)) return null;

  const dateSets = series.slice(1).map(
    (points) => new Set(points.map((point) => point.date)),
  );
  const benchmarkMap = new Map(benchmark.map((point) => [point.date, point.close]));
  const dates = series[0]
    .map((point) => point.date)
    .filter(
      (date) =>
        dateSets.every((set) => set.has(date)) && benchmarkMap.has(date),
    )
    .slice(-750);
  if (dates.length < 30) return null;

  const maps = series.map(
    (points) => new Map(points.map((point) => [point.date, point.close])),
  );
  const firstPrices = maps.map((map) => map.get(dates[0]) ?? 0);
  const firstBenchmark = benchmarkMap.get(dates[0]) ?? 0;
  if (firstPrices.some((price) => !price) || !firstBenchmark) return null;

  const strategy = dates.map(
    (date) =>
      maps.reduce(
        (sum, map, index) =>
          sum + (map.get(date) ?? firstPrices[index]) / firstPrices[index],
        0,
      ) / maps.length,
  );
  const benchmarkCurve = dates.map(
    (date) => (benchmarkMap.get(date) ?? firstBenchmark) / firstBenchmark,
  );
  const dailyReturns = strategy
    .slice(1)
    .map((value, index) => value / strategy[index] - 1);
  const years = (dates.length - 1) / 252;
  const annualized = (strategy.at(-1)! ** (1 / years) - 1) * 100;
  const benchmarkAnnualized =
    (benchmarkCurve.at(-1)! ** (1 / years) - 1) * 100;
  let peak = strategy[0];
  let maxDrawdown = 0;
  for (const value of strategy) {
    peak = Math.max(peak, value);
    maxDrawdown = Math.min(maxDrawdown, value / peak - 1);
  }
  const mean =
    dailyReturns.reduce((sum, value) => sum + value, 0) / dailyReturns.length;
  const variance =
    dailyReturns.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
    Math.max(dailyReturns.length - 1, 1);
  const standardDeviation = Math.sqrt(variance);
  const sharpe = standardDeviation
    ? ((mean - 0.02 / 252) / standardDeviation) * Math.sqrt(252)
    : 0;
  const [strategyPolygon, benchmarkPolygon] = polygonPair(
    strategy,
    benchmarkCurve,
  );
  return {
    annualized,
    benchmarkAnnualized,
    maxDrawdown: Math.abs(maxDrawdown) * 100,
    sharpe,
    start: dates[0],
    end: dates.at(-1)!,
    observations: dates.length,
    strategyPolygon,
    benchmarkPolygon,
  };
};

export default function Home() {
  const [activeNav, setActiveNav] = useState("今日总览");
  const [conflict, setConflict] = useState(64);
  const [hormuz, setHormuz] = useState(47);
  const [duration, setDuration] = useState(6);
  const [activePreset, setActivePreset] = useState("contained");
  const [chain, setChain] = useState<Chain>("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(["600938", "601808", "601899"]);
  const [focused, setFocused] = useState("600938");
  const [notice, setNotice] = useState("");
  const [lesson, setLesson] = useState("传导链");
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [histories, setHistories] = useState<Record<string, PricePoint[]>>({});
  const [benchmark, setBenchmark] = useState<PricePoint[]>([]);
  const [macro, setMacro] = useState<MacroSnapshot | null>(null);
  const [quoteStatus, setQuoteStatus] = useState<"loading" | "live" | "error">(
    "loading",
  );
  const [historyStatus, setHistoryStatus] = useState<
    "loading" | "live" | "error"
  >("loading");
  const [quoteUpdatedAt, setQuoteUpdatedAt] = useState("");

  useEffect(() => {
    let cancelled = false;
    const loadQuotes = async () => {
      try {
        const response = await fetch(QUOTE_URL, { cache: "no-store" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = await response.json();
        const next: Record<string, Quote> = {};
        for (const item of payload?.data?.diff ?? []) {
          const ticker = String(item.f12);
          next[ticker] = {
            ticker,
            name: String(item.f14 ?? ""),
            price: toNumber(item.f2),
            changePct: toNumber(item.f3),
            change: toNumber(item.f4),
            turnover: toNumber(item.f8),
            pe: toNumber(item.f9),
            pb: toNumber(item.f23),
            open: toNumber(item.f17),
            high: toNumber(item.f15),
            low: toNumber(item.f16),
            previousClose: toNumber(item.f18),
            updatedAt: item.f124 ? new Date(Number(item.f124) * 1000).toISOString() : "",
          };
        }
        if (!cancelled && Object.keys(next).length) {
          setQuotes(next);
          setQuoteStatus("live");
          setQuoteUpdatedAt(
            Object.values(next).find((quote) => quote.updatedAt)?.updatedAt ??
              new Date().toISOString(),
          );
        }
      } catch {
        if (!cancelled) setQuoteStatus("error");
      }
    };

    const loadHistory = async () => {
      try {
        const targets = [
          ...STOCKS.map((stock) => [stock.ticker, stock.secid] as const),
          ["benchmark", "1.000906"] as const,
        ];
        const results = await Promise.all(
          targets.map(async ([ticker, secid]) => {
            const response = await fetch(HISTORY_URL(secid), {
              cache: "force-cache",
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const payload = await response.json();
            const points: PricePoint[] = (payload?.data?.klines ?? [])
              .map((row: string) => {
                const fields = row.split(",");
                return { date: fields[0], close: Number(fields[2]) };
              })
              .filter(
                (point: PricePoint) =>
                  point.date && Number.isFinite(point.close) && point.close > 0,
              );
            return [ticker, points] as const;
          }),
        );
        if (!cancelled) {
          const next: Record<string, PricePoint[]> = {};
          for (const [ticker, points] of results) {
            if (ticker === "benchmark") setBenchmark(points);
            else next[ticker] = points;
          }
          setHistories(next);
          setHistoryStatus("live");
        }
      } catch {
        if (!cancelled) setHistoryStatus("error");
      }
    };

    const loadMacro = async () => {
      try {
        const response = await fetch("./data/macro.json", {
          cache: "no-store",
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = (await response.json()) as MacroSnapshot;
        if (!cancelled) setMacro(payload);
      } catch {
        if (!cancelled) setMacro(null);
      }
    };

    void loadQuotes();
    void loadHistory();
    void loadMacro();
    const interval = window.setInterval(loadQuotes, 20_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  const riskScore = Math.round(
    Math.min(100, conflict * 0.39 + hormuz * 0.46 + duration * 1.25),
  );
  const oilPressure = Math.round(
    Math.min(100, conflict * 0.25 + hormuz * 0.55 + duration * 1.4),
  );
  const presetLabel =
    PRESETS[activePreset as keyof typeof PRESETS]?.label ?? "自定义情景";

  const filteredStocks = useMemo(() => {
    return STOCKS.filter((stock) => {
      const chainMatch =
        chain === "all" ||
        (chain === "benefit" && stock.eventBeta > 0.08) ||
        (chain === "stress" && stock.eventBeta < 0);
      const queryMatch =
        !query ||
        `${stock.ticker}${stock.name}${stock.sector}`
          .toLowerCase()
          .includes(query.toLowerCase());
      return chainMatch && queryMatch;
    }).sort((a, b) => {
      const aChange = quotes[a.ticker]?.changePct ?? -Infinity;
      const bChange = quotes[b.ticker]?.changePct ?? -Infinity;
      return bChange - aChange;
    });
  }, [chain, query, quotes]);

  const focusedStock =
    STOCKS.find((stock) => stock.ticker === focused) ?? STOCKS[0];
  const focusedQuote = quotes[focusedStock.ticker];
  const focusedMomentum = momentum20(histories[focusedStock.ticker]);
  const backtest = useMemo(
    () => calculateBacktest(histories, benchmark, selected),
    [histories, benchmark, selected],
  );

  const toggleStock = (ticker: string) => {
    setSelected((current) =>
      current.includes(ticker)
        ? current.filter((item) => item !== ticker)
        : [...current, ticker],
    );
  };

  const scrollTo = (id: string, nav: string) => {
    setActiveNav(nav);
    document.getElementById(id)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const applyPreset = (key: keyof typeof PRESETS) => {
    const preset = PRESETS[key];
    setConflict(preset.conflict);
    setHormuz(preset.hormuz);
    setDuration(preset.duration);
    setActivePreset(key);
    setNotice(`已载入“${preset.label}”研究假设；市场数据未被改写。`);
  };

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">砺</span>
          <div>
            <strong>砺石</strong>
            <span>SCENARIO LAB</span>
          </div>
        </div>
        <nav aria-label="主导航">
          {NAV.map(([icon, label], index) => {
            const ids = [
              "overview",
              "scenario",
              "macro",
              "stocks",
              "backtest",
              "autonomy",
              "learn",
            ];
            return (
              <button
                key={label}
                className={activeNav === label ? "nav-item active" : "nav-item"}
                onClick={() => scrollTo(ids[index], label)}
              >
                <span>{icon}</span>
                {label}
              </button>
            );
          })}
        </nav>
        <div className="sidebar-note">
          <span className="pulse-dot" />
          <div>
            <strong>公开数据模式</strong>
            <p>最新价可能延迟，不连接券商交易。</p>
          </div>
        </div>
        <div className="analyst">
          <span className="avatar">实</span>
          <div>
            <strong>研究实习生</strong>
            <span>观察组合 · 只读研究</span>
          </div>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div className="mobile-brand">
            <span className="brand-mark">砺</span>
            <strong>砺石研究</strong>
          </div>
          <div className="market-status">
            <span className={quoteStatus === "live" ? "live-dot" : "live-dot offline"} />
            {quoteStatus === "live"
              ? `公开最新价 · ${formatDateTime(quoteUpdatedAt)}`
              : quoteStatus === "error"
                ? "行情接口暂不可用"
                : "正在连接公开行情"}
            <span className="demo-pill real-pill">免费公开数据</span>
          </div>
          <div className="top-actions">
            <label className="global-search">
              <span>⌕</span>
              <input aria-label="全局搜索" placeholder="搜索公司 / 代码" />
            </label>
            <button
              className="export-button"
              onClick={() => window.print()}
            >
              导出研究简报
            </button>
          </div>
        </header>

        <div className="content">
          <section className="page-intro" id="overview">
            <div>
              <span className="eyebrow">公开数据投研台 / PUBLIC DATA</span>
              <h1>真实行情做底座，情景假设单独推演。</h1>
              <p>
                最新价、估值、历史回测来自免费公开数据；中国宏观指标按统计发布频率更新。所有主观情景均明确标注，不伪装成市场事实。
              </p>
            </div>
            <div className="brief-stats">
              <div>
                <span>行情状态</span>
                <strong>{quoteStatus === "live" ? "已连接" : quoteStatus === "error" ? "中断" : "连接中"}</strong>
              </div>
              <div>
                <span>观察池</span>
                <strong>{selected.length} 只</strong>
              </div>
              <div>
                <span>历史日线</span>
                <strong>{historyStatus === "live" ? "已加载" : historyStatus === "error" ? "失败" : "加载中"}</strong>
              </div>
            </div>
          </section>

          {notice && (
            <button className="notice" onClick={() => setNotice("")}>
              <span>✓</span>{notice}<b>×</b>
            </button>
          )}

          <section className="scenario-grid" id="scenario">
            <article className="event-card">
              <div className="card-heading">
                <div>
                  <span className="section-index">01</span>
                  <div>
                    <span className="eyebrow">研究假设 · 非实时事件判断</span>
                    <h2>美伊冲突 · 霍尔木兹传导</h2>
                  </div>
                </div>
                <span className="severity hypothesis-pill">情景推演</span>
              </div>
              <div className="event-body">
                <div className="event-score">
                  <div
                    className="score-ring"
                    style={{
                      background: `conic-gradient(#f0643b ${riskScore * 3.6}deg, #eee9df 0deg)`,
                    }}
                  >
                    <div><strong>{riskScore}</strong><span>假设压力</span></div>
                  </div>
                  <p>当前假设：<strong>{presetLabel}</strong></p>
                </div>
                <div className="transmission">
                  <span className="eyebrow">假设传导链</span>
                  <div className="chain-row">
                    <div><b>海峡通航</b><span>{100 - hormuz}%</span></div>
                    <i>→</i>
                    <div><b>油价压力</b><span>{oilPressure}/100</span></div>
                    <i>→</i>
                    <div><b>成本冲击</b><span>需验证</span></div>
                    <i>→</i>
                    <div><b>A股映射</b><span>按个股研究</span></div>
                  </div>
                  <div className="signal-strip">
                    <div><span>假设性质</span><strong>主观参数</strong></div>
                    <div><span>影响窗口</span><strong>{duration} 周</strong></div>
                    <div><span>验证变量</span><strong>油价 / 运价</strong></div>
                  </div>
                </div>
              </div>
              <div className="event-footer">
                <span>提示</span>
                <button>这部分不是预测</button>
                <button>不会改写真实行情</button>
                <button>需用新闻与原油数据复核</button>
              </div>
            </article>

            <aside className="scenario-control">
              <div className="card-heading compact">
                <div>
                  <span className="section-index">02</span>
                  <div><span className="eyebrow">情景控制台</span><h2>调整研究假设</h2></div>
                </div>
              </div>
              <div className="preset-tabs">
                {Object.entries(PRESETS).map(([key, value]) => (
                  <button
                    key={key}
                    className={activePreset === key ? "active" : ""}
                    onClick={() => applyPreset(key as keyof typeof PRESETS)}
                  >
                    {value.label}
                  </button>
                ))}
              </div>
              {[
                ["冲突强度", conflict, setConflict, 100, ""],
                ["海峡受阻比例", hormuz, setHormuz, 100, "%"],
                ["冲击持续时间", duration, setDuration, 12, "周"],
              ].map(([label, value, setter, max, suffix]) => (
                <label className="slider-field" key={String(label)}>
                  <span>{label as string} <b>{value as number}{suffix as string}</b></span>
                  <input
                    type="range"
                    min="1"
                    max={max as number}
                    value={value as number}
                    onChange={(event) => {
                      (setter as (value: number) => void)(Number(event.target.value));
                      setActivePreset("");
                    }}
                  />
                  <i style={{ width: `${((value as number) / (max as number)) * 100}%` }} />
                </label>
              ))}
              <div className="derived-impact">
                <span>仅为假设输出</span>
                <div><strong>{oilPressure}/100</strong><small>油价压力</small></div>
                <div><strong>{riskScore}/100</strong><small>组合压力</small></div>
              </div>
              <button
                className="primary-button"
                onClick={() => setNotice("情景假设已更新；行情与历史回测仍使用真实市场数据。")}
              >
                <span>↻</span>更新情景假设
              </button>
            </aside>
          </section>

          <section className="macro-section" id="macro">
            <div className="section-title macro-title">
              <div>
                <span className="eyebrow">03 / 中国宏观公开数据</span>
                <h2>只展示已发布指标，不填造空缺值。</h2>
              </div>
              <span>
                {macro
                  ? `快照生成 ${formatDateTime(macro.generatedAt)}`
                  : "宏观快照加载中"}
              </span>
            </div>
            <div className="macro-shell">
              <div className="macro-summary real-macro-summary">
                <div>
                  <span className="eyebrow">数据口径</span>
                  <strong>官方发布频率</strong>
                  <p>{macro?.provider ?? "正在读取公开宏观数据快照…"}</p>
                </div>
                <div className="source-status">
                  <b>{macro?.metrics.length ?? "--"}</b>
                  <span>已接入指标</span>
                </div>
                <div className="source-explain">
                  PMI、CPI、PPI 与货币供应量按月更新，GDP 按季更新；它们不是分钟级行情。
                </div>
              </div>
              <div className="macro-factor-grid">
                {(macro?.metrics ?? []).map((metric) => (
                  <article className="macro-factor positive" key={metric.key}>
                    <div>
                      <span>{metric.name}</span>
                      <strong>{metric.value == null ? "--" : metric.value.toFixed(1)}{metric.unit}</strong>
                    </div>
                    <p>报告期：{metric.period}</p>
                    <small>{metric.description}</small>
                    <a href={metric.source} target="_blank" rel="noreferrer">查看数据源 ↗</a>
                  </article>
                ))}
                {!macro && (
                  <div className="data-empty">正在加载宏观快照；失败时不会显示模拟数值。</div>
                )}
              </div>
              <div className="macro-transmission">
                <span>研究流程</span>
                <div><b>官方发布</b><small>保留报告期</small></div>
                <i>→</i>
                <div><b>公开数据快照</b><small>部署任务定时更新</small></div>
                <i>→</i>
                <div><b>研究员解释</b><small>不自动生成买卖信号</small></div>
                <i>→</i>
                <div><b>组合约束</b><small>人工决策与复核</small></div>
              </div>
            </div>
          </section>

          <section className="impact-section">
            <div className="section-title">
              <div>
                <span className="eyebrow">情景敏感度 / RESEARCH ASSUMPTION</span>
                <h2>事件 β 是研究假设，不是实时数据。</h2>
              </div>
              <span>用于提出问题，不作为收益预测</span>
            </div>
            <div className="heatmap">
              {[
                ["油气开采", 0.32],
                ["油服工程", 0.24],
                ["贵金属", 0.13],
                ["煤炭", 0.09],
                ["炼化", 0.03],
                ["电力", -0.05],
                ["物流", -0.15],
                ["基础化工", -0.22],
                ["航空机场", -0.34],
              ].map(([name, beta]) => {
                const value = Number(beta);
                return (
                  <div className={`heat-cell ${value > 0.08 ? "positive" : value < -0.08 ? "negative" : "neutral"}`} key={String(name)}>
                    <span>{name}</span>
                    <strong>{value > 0 ? "+" : ""}{value.toFixed(2)}</strong>
                    <small>假设事件 β</small>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="stock-lab" id="stocks">
            <div className="stock-table-card">
              <div className="section-title table-title">
                <div>
                  <span className="eyebrow">04 / 真实行情选股台</span>
                  <h2>最新价、估值与价格动量</h2>
                </div>
                <div className="table-actions">
                  <label>
                    <span>⌕</span>
                    <input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="代码 / 名称 / 行业"
                    />
                  </label>
                </div>
              </div>
              <div className="chain-filter">
                {[["all", "全部"], ["benefit", "假设受益链"], ["stress", "假设承压链"]].map(([key, label]) => (
                  <button
                    key={key}
                    className={chain === key ? "active" : ""}
                    onClick={() => setChain(key as Chain)}
                  >
                    {label}
                  </button>
                ))}
                <span>默认按当日涨跌幅排序 · 20 秒刷新公开最新价</span>
              </div>
              <div className="stock-table" role="table" aria-label="候选股票">
                <div className="stock-row live-stock-row table-head" role="row">
                  <span>加入</span><span>公司 / 行业</span><span>最新价</span>
                  <span>涨跌幅</span><span>换手率</span><span>PE(TTM)</span>
                  <span>PB</span><span>20日动量</span>
                </div>
                {filteredStocks.map((stock) => {
                  const quote = quotes[stock.ticker];
                  const momentum = momentum20(histories[stock.ticker]);
                  return (
                    <button
                      className={`stock-row live-stock-row ${focused === stock.ticker ? "focused" : ""}`}
                      key={stock.ticker}
                      onClick={() => setFocused(stock.ticker)}
                      role="row"
                    >
                      <span
                        className={selected.includes(stock.ticker) ? "check checked" : "check"}
                        onClick={(event) => {
                          event.stopPropagation();
                          toggleStock(stock.ticker);
                        }}
                      >
                        {selected.includes(stock.ticker) ? "✓" : ""}
                      </span>
                      <span className="stock-name">
                        <b>{stock.name}</b>
                        <small>{stock.ticker} · {stock.sector}</small>
                      </span>
                      <span className="quote-price">{numberText(quote?.price)}</span>
                      <span className={(quote?.changePct ?? 0) >= 0 ? "positive-text" : "negative-text"}>
                        {percent(quote?.changePct)}
                      </span>
                      <span>{percent(quote?.turnover)}</span>
                      <span>{numberText(quote?.pe)}</span>
                      <span>{numberText(quote?.pb)}</span>
                      <span className={(momentum ?? 0) >= 0 ? "positive-text" : "negative-text"}>
                        {percent(momentum)}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="table-foot">
                <span>行情：东方财富公开接口 · {quoteStatus === "live" ? formatDateTime(quoteUpdatedAt) : "等待连接"}</span>
                <span>非交易所授权逐笔行情，可能延迟、中断或调整口径</span>
              </div>
            </div>

            <aside className="stock-detail">
              <div className="detail-header real-detail-header">
                <div>
                  <span>{focusedStock.ticker}</span>
                  <h3>{focusedStock.name}</h3>
                  <p>{focusedStock.sector} · 公开最新价</p>
                </div>
                <strong>{numberText(focusedQuote?.price)}</strong>
              </div>
              <div className="live-detail-grid">
                <div><span>涨跌幅</span><b className={(focusedQuote?.changePct ?? 0) >= 0 ? "positive-text" : "negative-text"}>{percent(focusedQuote?.changePct)}</b></div>
                <div><span>今开</span><b>{numberText(focusedQuote?.open)}</b></div>
                <div><span>最高</span><b>{numberText(focusedQuote?.high)}</b></div>
                <div><span>最低</span><b>{numberText(focusedQuote?.low)}</b></div>
                <div><span>PE(TTM)</span><b>{numberText(focusedQuote?.pe)}</b></div>
                <div><span>PB</span><b>{numberText(focusedQuote?.pb)}</b></div>
                <div><span>换手率</span><b>{percent(focusedQuote?.turnover)}</b></div>
                <div><span>20日动量</span><b>{percent(focusedMomentum)}</b></div>
              </div>
              <div className="evidence-block">
                <span className="eyebrow">研究假设</span>
                <p>{focusedStock.thesis}</p>
              </div>
              <div className="risk-box">
                <span>反方条件</span><p>{focusedStock.risk}</p>
              </div>
              <button className="detail-button" onClick={() => toggleStock(focusedStock.ticker)}>
                {selected.includes(focusedStock.ticker) ? "✓ 已加入观察组合" : "+ 加入观察组合"}
              </button>
            </aside>
          </section>

          <section className="backtest-section" id="backtest">
            <div className="section-title">
              <div>
                <span className="eyebrow">05 / 真实历史价格回测</span>
                <h2>等权买入持有，先看真实基线。</h2>
              </div>
              <span>
                {backtest
                  ? `${backtest.start} 至 ${backtest.end} · ${backtest.observations} 个交易日`
                  : historyStatus === "error" ? "历史数据加载失败" : "正在计算"}
              </span>
            </div>
            <div className="backtest-grid">
              <article className="performance-card">
                <div className="metric-grid">
                  <div><span>组合年化</span><strong className={(backtest?.annualized ?? 0) >= 0 ? "positive-text" : "negative-text"}>{percent(backtest?.annualized)}</strong><small>观察池等权买入持有</small></div>
                  <div><span>中证800年化</span><strong>{percent(backtest?.benchmarkAnnualized)}</strong><small>指数前复权日线</small></div>
                  <div><span>最大回撤</span><strong className="negative-text">{backtest ? `-${backtest.maxDrawdown.toFixed(2)}%` : "--"}</strong><small>组合净值峰谷跌幅</small></div>
                  <div><span>夏普比率</span><strong>{backtest ? backtest.sharpe.toFixed(2) : "--"}</strong><small>无风险利率假设 2.0%</small></div>
                </div>
                <div className="chart-header">
                  <div><button className="active">累计净值</button></div>
                  <div className="legend">
                    <span><i className="strategy-line" />观察组合</span>
                    <span><i className="benchmark-line" />中证800</span>
                  </div>
                </div>
                <div className="performance-chart" aria-label="真实历史累计净值">
                  <div className="grid-line g1"><span>相对高位</span></div>
                  <div className="grid-line g2"><span>区间中位</span></div>
                  <div className="grid-line g3"><span>相对低位</span></div>
                  {backtest && (
                    <>
                      <div className="area strategy-area" style={{ clipPath: backtest.strategyPolygon }} />
                      <div className="area benchmark-area" style={{ clipPath: backtest.benchmarkPolygon }} />
                    </>
                  )}
                  <div className="x-axis">
                    <span>{backtest?.start ?? "--"}</span><span>真实前复权收盘价</span><span>{backtest?.end ?? "--"}</span>
                  </div>
                </div>
              </article>
              <aside className="diagnostics-card">
                <span className="eyebrow">回测口径</span>
                <h3>透明基线 <strong>{backtest ? "可复算" : "--"}</strong></h3>
                <div className="diagnostic-list">
                  <div className="pass"><span>✓</span><p><b>真实历史价格</b><small>公开接口前复权日线</small></p></div>
                  <div className="pass"><span>✓</span><p><b>无选股打分造数</b><small>只按用户勾选标的等权</small></p></div>
                  <div className="warn"><span>!</span><p><b>非样本外策略</b><small>这是买入持有基线，不代表可复制收益</small></p></div>
                  <div className="warn"><span>!</span><p><b>暂未计交易摩擦</b><small>未计税费、滑点与涨跌停约束</small></p></div>
                </div>
                <div className="cost-box">
                  <span>数据范围</span>
                  <strong>{selected.length} 只股票</strong>
                  <small>选择变化后自动重算 · 不影响真实行情</small>
                </div>
              </aside>
            </div>
          </section>

          <section className="autonomy-section" id="autonomy">
            <div className="section-title">
              <div>
                <span className="eyebrow">06 / 数据管线状态</span>
                <h2>先把数据做真，再谈自主学习。</h2>
              </div>
              <span className="pipeline-time">页面端行情每 20 秒刷新</span>
            </div>
            <div className="model-arena pipeline-arena">
              <article>
                <div className="model-card-head"><span className="model-badge champion">已启用</span><small>浏览器直连</small></div>
                <h3>公开最新行情</h3>
                <p>最新价、涨跌幅、换手率、PE 与 PB。接口失败时显示空值，不回退到模拟数。</p>
                <div className="model-metrics"><div><span>状态</span><b>{quoteStatus === "live" ? "正常" : quoteStatus === "error" ? "异常" : "连接中"}</b></div><div><span>标的</span><b>{Object.keys(quotes).length}</b></div><div><span>刷新</span><b>20秒</b></div></div>
              </article>
              <article>
                <div className="model-card-head"><span className="model-badge champion">已启用</span><small>前复权日线</small></div>
                <h3>历史价格与回测</h3>
                <p>免费公开日线用于价格动量与等权基线回测，结果随观察池实时重算。</p>
                <div className="model-metrics"><div><span>状态</span><b>{historyStatus === "live" ? "正常" : historyStatus === "error" ? "异常" : "加载中"}</b></div><div><span>股票</span><b>{Object.keys(histories).length}</b></div><div><span>基准</span><b>中证800</b></div></div>
              </article>
              <article>
                <div className="model-card-head"><span className="model-badge shadow">未启用</span><small>需要后端</small></div>
                <h3>模型训练与自动换模</h3>
                <p>GitHub Pages 只有前端，尚无特征库、训练任务、模型注册表或影子组合，因此不宣称自主学习。</p>
                <div className="model-metrics"><div><span>训练</span><b>关闭</b></div><div><span>自动下单</span><b>禁止</b></div><div><span>人工复核</span><b>必需</b></div></div>
              </article>
            </div>
            <p className="autonomy-note">
              下一阶段若接入数据库与定时计算，应保留原始数据版本、首次可得时间、样本外验证和人工晋级门槛。
            </p>
          </section>

          <section className="learning-section" id="learn">
            <div className="learning-copy">
              <span className="eyebrow">07 / 投研学习中心</span>
              <h2>每一个结论，都要能讲清楚“为什么”。</h2>
              <p>平台把事实、假设、回测口径与反例拆开，方便准备晨会与训练研究框架。</p>
              <div className="lesson-tabs">
                {["传导链", "因子词典", "回测陷阱"].map((item) => (
                  <button key={item} className={lesson === item ? "active" : ""} onClick={() => setLesson(item)}>{item}</button>
                ))}
              </div>
            </div>
            <article className="lesson-card">
              <div className="lesson-number">07</div>
              {lesson === "传导链" && <><span>今日微课 · 6分钟</span><h3>为什么油价上涨，不等于黄金一定上涨？</h3><p>地缘风险推高避险需求，但油价也可能抬升通胀与实际利率。当美元和美债收益率同步走高时，黄金的避险属性会被持有成本抵消。</p><div className="lesson-formula">黄金方向 ≈ 避险需求 − 实际利率压力 − 美元强度</div></>}
              {lesson === "因子词典" && <><span>核心概念 · 4分钟</span><h3>事件 β 不是实时事实，而是条件敏感度假设。</h3><p>它要用同类历史样本估计，并经过显著性、稳定性与样本外检验；事件改变后也应重新估计。</p><div className="lesson-formula">事件 β = 条件超额收益 ÷ 标准化冲击幅度</div></>}
              {lesson === "回测陷阱" && <><span>研究规范 · 8分钟</span><h3>真实价格，不代表回测天然可信。</h3><p>幸存者偏差、参数反复试验、忽略交易成本与直接用修订后宏观数据，都可能高估结果。</p><div className="lesson-formula">可实现收益 = 毛收益 − 费用 − 滑点 − 冲击 − 偏差</div></>}
            </article>
            <div className="checklist-card">
              <span className="eyebrow">提交前检查</span><h3>晨会研究清单</h3>
              {["原始事实与主观假设已分开", "记录数据来源与报告期", "至少保留一个反方情景", "回测口径可以复算", "结论注明失效条件"].map((item) => (
                <label key={item}><input type="checkbox" /><span>{item}</span></label>
              ))}
              <div><strong>0 / 5</strong><span>完成后再导出研究简报</span></div>
            </div>
          </section>

          <footer>
            <div>
              <span className="brand-mark small">砺</span>
              <p>
                砺石情景研究终端 · 公开数据版
                <small>行情来自免费公开接口，可能延迟或中断；宏观数据按官方发布频率更新；情景推演为研究假设，不构成投资建议。</small>
              </p>
            </div>
            <span>版本 0.2 · 只读研究</span>
          </footer>
        </div>
      </section>
    </main>
  );
}
