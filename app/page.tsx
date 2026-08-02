"use client";

import { useMemo, useState } from "react";

type Chain = "all" | "benefit" | "stress";

type Stock = {
  ticker: string;
  name: string;
  sector: string;
  base: number;
  eventBeta: number;
  macroBeta: number;
  quality: number;
  valuation: number;
  momentum: number;
  thesis: string;
  risk: string;
};

const STOCKS: Stock[] = [
  {
    ticker: "600938",
    name: "中国海油",
    sector: "油气开采",
    base: 72,
    eventBeta: 0.31,
    macroBeta: -0.03,
    quality: 88,
    valuation: 72,
    momentum: 81,
    thesis: "高油价直接增厚上游盈利，自由现金流与股东回报形成缓冲。",
    risk: "停火快于预期、油价风险溢价快速回吐。",
  },
  {
    ticker: "601808",
    name: "中海油服",
    sector: "油服工程",
    base: 65,
    eventBeta: 0.24,
    macroBeta: 0.05,
    quality: 74,
    valuation: 68,
    momentum: 76,
    thesis: "资本开支预期抬升，钻井平台利用率和日费率存在改善空间。",
    risk: "油价冲击短暂，油企资本开支未跟随上行。",
  },
  {
    ticker: "601899",
    name: "紫金矿业",
    sector: "有色金属",
    base: 69,
    eventBeta: 0.13,
    macroBeta: 0.10,
    quality: 82,
    valuation: 63,
    momentum: 73,
    thesis: "黄金与铜的组合暴露提供避险和供给扰动的双重弹性。",
    risk: "美元与实际利率同步走高，压制贵金属估值。",
  },
  {
    ticker: "600028",
    name: "中国石化",
    sector: "炼化一体化",
    base: 66,
    eventBeta: 0.04,
    macroBeta: 0.14,
    quality: 79,
    valuation: 78,
    momentum: 61,
    thesis: "库存收益提供阶段性支撑，但炼化价差决定最终盈利弹性。",
    risk: "原料上涨快于成品油调价，炼化毛利受到挤压。",
  },
  {
    ticker: "600309",
    name: "万华化学",
    sector: "基础化工",
    base: 68,
    eventBeta: -0.22,
    macroBeta: 0.29,
    quality: 91,
    valuation: 74,
    momentum: 48,
    thesis: "优质龙头具备成本转嫁能力，但短期受能源与原料价格压制。",
    risk: "油价持续高位且终端需求偏弱，价差收缩。",
  },
  {
    ticker: "600029",
    name: "南方航空",
    sector: "航空机场",
    base: 61,
    eventBeta: -0.34,
    macroBeta: 0.21,
    quality: 65,
    valuation: 57,
    momentum: 42,
    thesis: "油价与绕航成本上升压制利润，票价传导存在时滞。",
    risk: "航油成本超预期上升、国际航线恢复受阻。",
  },
];

const PRESETS = {
  ceasefire: { conflict: 32, hormuz: 18, duration: 2, label: "快速停火" },
  contained: { conflict: 64, hormuz: 47, duration: 6, label: "局部延续" },
  blockade: { conflict: 88, hormuz: 82, duration: 10, label: "海峡受阻" },
};

const MACRO_PRESETS = {
  support: {
    label: "稳增长加码",
    summary: "财政与流动性改善，信用向实体扩散",
    factors: [58, 64, 72, 48, 78, 59],
  },
  baseline: {
    label: "温和修复",
    summary: "政策托底，但地产与需求修复仍不均衡",
    factors: [51, 54, 61, 39, 67, 55],
  },
  pressure: {
    label: "需求承压",
    summary: "信用扩张放缓，风险偏好与顺周期盈利承压",
    factors: [41, 38, 47, 30, 52, 44],
  },
};

const MACRO_FACTORS = [
  {
    name: "增长动能",
    source: "PMI · 工业增加值 · 出口",
    direction: "盈利周期",
  },
  {
    name: "信用脉冲",
    source: "社融 · 信贷结构 · M1",
    direction: "顺周期估值",
  },
  {
    name: "流动性",
    source: "DR007 · 公开市场操作",
    direction: "成长股折现率",
  },
  {
    name: "地产链",
    source: "销售 · 开工 · 竣工",
    direction: "建材与居民资产负债表",
  },
  {
    name: "财政力度",
    source: "专项债 · 政府支出",
    direction: "基建与内需",
  },
  {
    name: "人民币",
    source: "CFETS · 中美利差",
    direction: "外资与进口成本",
  },
];

const NAV = [
  ["⌂", "今日总览"],
  ["◎", "事件推演"],
  ["▦", "中国宏观"],
  ["◇", "选股工作台"],
  ["↗", "回测实验室"],
  ["↻", "自主学习"],
  ["?", "研究课堂"],
];

const clamp = (value: number, min = 0, max = 100) =>
  Math.max(min, Math.min(max, value));

export default function Home() {
  const [activeNav, setActiveNav] = useState("今日总览");
  const [conflict, setConflict] = useState(64);
  const [hormuz, setHormuz] = useState(47);
  const [duration, setDuration] = useState(6);
  const [activePreset, setActivePreset] = useState("contained");
  const [chain, setChain] = useState<Chain>("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([
    "600938",
    "601808",
    "601899",
  ]);
  const [focused, setFocused] = useState("600938");
  const [runId, setRunId] = useState(12);
  const [notice, setNotice] = useState("");
  const [lesson, setLesson] = useState("传导链");
  const [macroPreset, setMacroPreset] =
    useState<keyof typeof MACRO_PRESETS>("baseline");
  const [trainingCycle, setTrainingCycle] = useState(24);

  const riskScore = Math.round(
    clamp(conflict * 0.39 + hormuz * 0.46 + duration * 1.25),
  );
  const oilShock = Math.round(
    clamp(conflict * 0.2 + hormuz * 0.42 + duration * 1.6 - 9, 2, 68),
  );
  const inflationShock = (oilShock * 0.032).toFixed(1);
  const presetLabel =
    PRESETS[activePreset as keyof typeof PRESETS]?.label ?? "自定义情景";
  const macro = MACRO_PRESETS[macroPreset];
  const macroScore = Math.round(
    macro.factors.reduce((sum, value) => sum + value, 0) /
      macro.factors.length,
  );
  const macroImpulse = macroScore - 50;

  const scoredStocks = useMemo(() => {
    return STOCKS.map((stock) => ({
      ...stock,
      score: Math.round(
        clamp(
          stock.base +
            stock.eventBeta * oilShock +
            stock.macroBeta * macroImpulse,
        ),
      ),
    })).sort((a, b) => b.score - a.score);
  }, [oilShock, macroImpulse]);

  const filteredStocks = scoredStocks.filter((stock) => {
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
  });

  const focusedStock =
    scoredStocks.find((stock) => stock.ticker === focused) ?? scoredStocks[0];

  const annualReturn = (
    10.8 +
    oilShock * 0.16 +
    macroImpulse * 0.08
  ).toFixed(1);
  const benchmarkReturn = (
    7.1 -
    oilShock * 0.035 +
    macroImpulse * 0.04
  ).toFixed(1);
  const drawdown = (
    6.4 +
    riskScore * 0.045 -
    macroImpulse * 0.025
  ).toFixed(1);
  const sharpe = (
    1.12 +
    oilShock * 0.009 +
    macroImpulse * 0.004
  ).toFixed(2);

  const applyPreset = (key: keyof typeof PRESETS) => {
    const preset = PRESETS[key];
    setConflict(preset.conflict);
    setHormuz(preset.hormuz);
    setDuration(preset.duration);
    setActivePreset(key);
    setNotice(`已载入“${preset.label}”情景`);
  };

  const updateScenario = () => {
    setRunId((id) => id + 1);
    setNotice("黑天鹅、中国宏观、个股评分与净值回测已重新计算");
  };

  const runTraining = () => {
    setTrainingCycle((cycle) => cycle + 1);
    setNotice("挑战者模型已完成新一轮滚动样本外训练，等待人工复核");
  };

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
            <strong>研究沙盒</strong>
            <p>当前为模拟数据，不连接实盘交易。</p>
          </div>
        </div>

        <div className="analyst">
          <span className="avatar">实</span>
          <div>
            <strong>研究实习生</strong>
            <span>模拟组合 · 观察员</span>
          </div>
          <button aria-label="更多">···</button>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div className="mobile-brand">
            <span className="brand-mark">砺</span>
            <strong>砺石研究</strong>
          </div>
          <div className="market-status">
            <span className="live-dot" />
            情景快照 · 2026.03.02 10:30
            <span className="demo-pill">模拟数据</span>
          </div>
          <div className="top-actions">
            <label className="global-search">
              <span>⌕</span>
              <input
                aria-label="全局搜索"
                placeholder="搜索公司 / 事件 / 因子"
              />
              <kbd>⌘ K</kbd>
            </label>
            <button className="icon-button" aria-label="通知">
              ◌
              <i />
            </button>
            <button className="export-button">导出研究简报</button>
          </div>
        </header>

        <div className="content">
          <section className="page-intro" id="overview">
            <div>
              <span className="eyebrow">今日研究任务 / DAILY BRIEF</span>
              <h1>把黑天鹅，拆成可验证的投资假设。</h1>
              <p>
                从地缘事件识别、跨资产传导到A股个股暴露，建立可解释、可回测、可复盘的研究闭环。
              </p>
            </div>
            <div className="brief-stats">
              <div>
                <span>风险状态</span>
                <strong className={riskScore > 70 ? "risk-high" : ""}>
                  {riskScore > 70 ? "高警戒" : riskScore > 45 ? "警戒" : "平稳"}
                </strong>
              </div>
              <div>
                <span>观察池</span>
                <strong>{selected.length} 只</strong>
              </div>
              <div>
                <span>最新回测</span>
                <strong>#{runId}</strong>
              </div>
            </div>
          </section>

          {notice && (
            <button
              className="notice"
              onClick={() => setNotice("")}
              aria-label="关闭提示"
            >
              <span>✓</span>
              {notice}
              <b>×</b>
            </button>
          )}

          <section className="scenario-grid" id="scenario">
            <article className="event-card">
              <div className="card-heading">
                <div>
                  <span className="section-index">01</span>
                  <div>
                    <span className="eyebrow">外生事件监测</span>
                    <h2>美伊冲突 · 霍尔木兹传导</h2>
                  </div>
                </div>
                <span className="severity">
                  <i />
                  重大事件
                </span>
              </div>

              <div className="event-body">
                <div className="event-score">
                  <div
                    className="score-ring"
                    style={{
                      background: `conic-gradient(#f0643b ${riskScore * 3.6}deg, #eee9df 0deg)`,
                    }}
                  >
                    <div>
                      <strong>{riskScore}</strong>
                      <span>冲击分</span>
                    </div>
                  </div>
                  <p>
                    当前情景：<strong>{presetLabel}</strong>
                  </p>
                </div>

                <div className="transmission">
                  <span className="eyebrow">核心传导链</span>
                  <div className="chain-row">
                    <div>
                      <b>海峡通航</b>
                      <span>-{Math.round(hormuz * 0.7)}%</span>
                    </div>
                    <i>→</i>
                    <div>
                      <b>Brent冲击</b>
                      <span>+{oilShock}%</span>
                    </div>
                    <i>→</i>
                    <div>
                      <b>通胀预期</b>
                      <span>+{inflationShock}pp</span>
                    </div>
                    <i>→</i>
                    <div>
                      <b>A股风险偏好</b>
                      <span>-{(riskScore * 0.045).toFixed(1)}%</span>
                    </div>
                  </div>
                  <div className="signal-strip">
                    <div>
                      <span>方向可信度</span>
                      <strong>{Math.round(59 + riskScore * 0.26)}%</strong>
                    </div>
                    <div>
                      <span>影响窗口</span>
                      <strong>{duration}–{duration + 3}周</strong>
                    </div>
                    <div>
                      <span>主要矛盾</span>
                      <strong>能源供给</strong>
                    </div>
                  </div>
                </div>
              </div>

              <div className="event-footer">
                <span>先行指标</span>
                <button>油轮AIS ↓</button>
                <button>Brent跨期 ↑</button>
                <button>战争险费率 ↑</button>
                <button>美元指数 ↑</button>
              </div>
            </article>

            <aside className="scenario-control">
              <div className="card-heading compact">
                <div>
                  <span className="section-index">02</span>
                  <div>
                    <span className="eyebrow">情景控制台</span>
                    <h2>调整假设</h2>
                  </div>
                </div>
                <span className="unsaved">动态</span>
              </div>

              <div className="preset-tabs">
                {Object.entries(PRESETS).map(([key, value]) => (
                  <button
                    key={key}
                    className={activePreset === key ? "active" : ""}
                    onClick={() =>
                      applyPreset(key as keyof typeof PRESETS)
                    }
                  >
                    {value.label}
                  </button>
                ))}
              </div>

              <label className="slider-field">
                <span>
                  冲突强度 <b>{conflict}</b>
                </span>
                <input
                  type="range"
                  min="10"
                  max="100"
                  value={conflict}
                  onChange={(event) => {
                    setConflict(Number(event.target.value));
                    setActivePreset("");
                  }}
                />
                <i style={{ width: `${conflict}%` }} />
              </label>

              <label className="slider-field">
                <span>
                  海峡受阻比例 <b>{hormuz}%</b>
                </span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={hormuz}
                  onChange={(event) => {
                    setHormuz(Number(event.target.value));
                    setActivePreset("");
                  }}
                />
                <i style={{ width: `${hormuz}%` }} />
              </label>

              <label className="slider-field">
                <span>
                  冲击持续时间 <b>{duration}周</b>
                </span>
                <input
                  type="range"
                  min="1"
                  max="12"
                  value={duration}
                  onChange={(event) => {
                    setDuration(Number(event.target.value));
                    setActivePreset("");
                  }}
                />
                <i style={{ width: `${(duration / 12) * 100}%` }} />
              </label>

              <div className="derived-impact">
                <span>模型推导</span>
                <div>
                  <strong>+{oilShock}%</strong>
                  <small>Brent压力值</small>
                </div>
                <div>
                  <strong>{riskScore}/100</strong>
                  <small>组合风险</small>
                </div>
              </div>

              <button className="primary-button" onClick={updateScenario}>
                <span>↻</span>
                重新推演并回测
              </button>
              <p className="control-note">
                每次推演均保留参数快照，便于向基金经理复盘。
              </p>
            </aside>
          </section>

          <section className="macro-section" id="macro">
            <div className="section-title macro-title">
              <div>
                <span className="eyebrow">03 / 中国宏观雷达</span>
                <h2>把政策、信用与需求，变成可回测的行业信号。</h2>
              </div>
              <span>模拟信号 · 正式接数后保留首次发布日期与修订值</span>
            </div>

            <div className="macro-shell">
              <div className="macro-summary">
                <div>
                  <span className="eyebrow">当前宏观状态</span>
                  <strong>{macro.label}</strong>
                  <p>{macro.summary}</p>
                </div>
                <div
                  className="macro-gauge"
                  style={{
                    background: `conic-gradient(#a9d67a ${macroScore * 3.6}deg, rgba(255,255,255,.12) 0deg)`,
                  }}
                >
                  <div>
                    <b>{macroScore}</b>
                    <span>综合脉冲</span>
                  </div>
                </div>
                <div className="macro-presets" aria-label="宏观情景选择">
                  {Object.entries(MACRO_PRESETS).map(([key, value]) => (
                    <button
                      key={key}
                      className={macroPreset === key ? "active" : ""}
                      onClick={() => {
                        setMacroPreset(key as keyof typeof MACRO_PRESETS);
                        setNotice(`已切换中国宏观情景：“${value.label}”`);
                      }}
                    >
                      <b>{value.label}</b>
                      <span>{value.summary}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="macro-factor-grid">
                {MACRO_FACTORS.map((factor, index) => {
                  const value = macro.factors[index];
                  const tone =
                    value >= 60 ? "positive" : value < 45 ? "negative" : "";
                  return (
                    <article className={`macro-factor ${tone}`} key={factor.name}>
                      <div>
                        <span>{factor.name}</span>
                        <strong>{value}</strong>
                      </div>
                      <p>{factor.source}</p>
                      <small>主要传导：{factor.direction}</small>
                      <i>
                        <em style={{ width: `${value}%` }} />
                      </i>
                    </article>
                  );
                })}
              </div>

              <div className="macro-transmission">
                <span>进入模型</span>
                <div><b>宏观状态</b><small>{macro.label}</small></div>
                <i>→</i>
                <div><b>行业敏感度</b><small>地产 / 消费 / 科技 / 周期</small></div>
                <i>→</i>
                <div><b>个股盈利暴露</b><small>收入、成本与估值三层校验</small></div>
                <i>→</i>
                <div><b>组合约束</b><small>仓位、集中度与回撤门禁</small></div>
              </div>
            </div>
          </section>

          <section className="impact-section">
            <div className="section-title">
              <div>
                <span className="eyebrow">行业映射 / SECTOR MAP</span>
                <h2>冲击不是一条直线，而是一组利润再分配。</h2>
              </div>
              <span>基于当前情景 · 预估20交易日超额收益</span>
            </div>
            <div className="heatmap">
              {[
                ["油气开采", 0.32, "positive"],
                ["油服工程", 0.24, "positive"],
                ["贵金属", 0.13, "positive"],
                ["煤炭", 0.09, "positive"],
                ["炼化", 0.03, "neutral"],
                ["电力", -0.05, "neutral"],
                ["物流", -0.15, "negative"],
                ["基础化工", -0.22, "negative"],
                ["航空机场", -0.34, "negative"],
              ].map(([name, beta, tone]) => {
                const value = Number(beta) * oilShock * 0.42;
                return (
                  <div className={`heat-cell ${tone}`} key={String(name)}>
                    <span>{name}</span>
                    <strong>
                      {value > 0 ? "+" : ""}
                      {value.toFixed(1)}%
                    </strong>
                    <small>事件β {Number(beta).toFixed(2)}</small>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="stock-lab" id="stocks">
            <div className="stock-table-card">
              <div className="section-title table-title">
                <div>
                  <span className="eyebrow">04 / 选股工作台</span>
                  <h2>候选股评分与证据</h2>
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
                  <button>筛选器 <b>3</b></button>
                </div>
              </div>

              <div className="chain-filter">
                {[
                  ["all", "全市场"],
                  ["benefit", "受益链"],
                  ["stress", "承压链"],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    className={chain === key ? "active" : ""}
                    onClick={() => setChain(key as Chain)}
                  >
                    {label}
                  </button>
                ))}
                <span>模型综合：基本面 30% · 估值 15% · 动量 15% · 事件 20% · 中国宏观 20%</span>
              </div>

              <div className="stock-table" role="table" aria-label="候选股票">
                <div className="stock-row table-head" role="row">
                  <span>加入</span>
                  <span>公司 / 行业</span>
                  <span>综合分</span>
                  <span>质量</span>
                  <span>估值</span>
                  <span>动量</span>
                  <span>事件β</span>
                  <span>信号</span>
                </div>
                {filteredStocks.map((stock, index) => (
                  <button
                    className={
                      focused === stock.ticker
                        ? "stock-row focused"
                        : "stock-row"
                    }
                    key={stock.ticker}
                    onClick={() => setFocused(stock.ticker)}
                    role="row"
                  >
                    <span
                      className={
                        selected.includes(stock.ticker)
                          ? "check checked"
                          : "check"
                      }
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleStock(stock.ticker);
                      }}
                    >
                      {selected.includes(stock.ticker) ? "✓" : ""}
                    </span>
                    <span className="stock-name">
                      <b>
                        {index + 1}. {stock.name}
                      </b>
                      <small>
                        {stock.ticker} · {stock.sector}
                      </small>
                    </span>
                    <span className="score-value">{stock.score}</span>
                    <span>{stock.quality}</span>
                    <span>{stock.valuation}</span>
                    <span>{stock.momentum}</span>
                    <span
                      className={
                        stock.eventBeta > 0
                          ? "positive-text"
                          : "negative-text"
                      }
                    >
                      {stock.eventBeta > 0 ? "+" : ""}
                      {stock.eventBeta.toFixed(2)}
                    </span>
                    <span
                      className={
                        stock.score >= 75
                          ? "signal buy"
                          : stock.score < 55
                            ? "signal avoid"
                            : "signal watch"
                      }
                    >
                      {stock.score >= 75
                        ? "重点"
                        : stock.score < 55
                          ? "规避"
                          : "观察"}
                    </span>
                  </button>
                ))}
              </div>
              <div className="table-foot">
                <span>显示 {filteredStocks.length} / {STOCKS.length} 只演示标的</span>
                <span>分数仅用于研究流程演示，不构成投资建议</span>
              </div>
            </div>

            <aside className="stock-detail">
              <div className="detail-header">
                <div>
                  <span>{focusedStock.ticker}</span>
                  <h3>{focusedStock.name}</h3>
                  <p>{focusedStock.sector} · 事件敏感型</p>
                </div>
                <strong>{focusedStock.score}</strong>
              </div>
              <div className="evidence-block">
                <span className="eyebrow">入选逻辑</span>
                <p>{focusedStock.thesis}</p>
              </div>
              <div className="factor-bars">
                {[
                  ["基本面质量", focusedStock.quality],
                  ["估值吸引力", focusedStock.valuation],
                  ["价格动量", focusedStock.momentum],
                  [
                    "事件适配度",
                    Math.round(clamp(50 + focusedStock.eventBeta * oilShock)),
                  ],
                ].map(([label, value]) => (
                  <div key={String(label)}>
                    <span>
                      {label} <b>{value}</b>
                    </span>
                    <i>
                      <em style={{ width: `${value}%` }} />
                    </i>
                  </div>
                ))}
              </div>
              <div className="risk-box">
                <span>反方证据</span>
                <p>{focusedStock.risk}</p>
              </div>
              <button
                className="detail-button"
                onClick={() => toggleStock(focusedStock.ticker)}
              >
                {selected.includes(focusedStock.ticker)
                  ? "✓ 已加入观察组合"
                  : "+ 加入观察组合"}
              </button>
            </aside>
          </section>

          <section className="backtest-section" id="backtest">
            <div className="section-title">
              <div>
                <span className="eyebrow">04 / 回测实验室</span>
                <h2>先看回撤，再看收益。</h2>
              </div>
              <div className="backtest-settings">
                <label>
                  回测区间
                  <select defaultValue="3y">
                    <option value="3y">近3年</option>
                    <option value="5y">近5年</option>
                  </select>
                </label>
                <label>
                  调仓频率
                  <select defaultValue="20">
                    <option value="20">20交易日</option>
                    <option value="5">5交易日</option>
                  </select>
                </label>
                <label>
                  单边成本
                  <select defaultValue="8">
                    <option value="8">8 bps</option>
                    <option value="12">12 bps</option>
                  </select>
                </label>
              </div>
            </div>

            <div className="backtest-grid">
              <article className="performance-card">
                <div className="metric-grid">
                  <div>
                    <span>年化净收益</span>
                    <strong className="positive-text">+{annualReturn}%</strong>
                    <small>已扣费用与冲击成本</small>
                  </div>
                  <div>
                    <span>基准年化</span>
                    <strong>+{benchmarkReturn}%</strong>
                    <small>中证800模拟基准</small>
                  </div>
                  <div>
                    <span>最大回撤</span>
                    <strong className="negative-text">-{drawdown}%</strong>
                    <small>风险预算上限 -12%</small>
                  </div>
                  <div>
                    <span>夏普比率</span>
                    <strong>{sharpe}</strong>
                    <small>无风险利率 2.0%</small>
                  </div>
                </div>

                <div className="chart-header">
                  <div>
                    <button className="active">累计净值</button>
                    <button>回撤</button>
                    <button>超额收益</button>
                  </div>
                  <div className="legend">
                    <span><i className="strategy-line" />情景策略</span>
                    <span><i className="benchmark-line" />中证800</span>
                  </div>
                </div>
                <div className="performance-chart" aria-label="累计净值示意图">
                  <div className="grid-line g1"><span>1.40</span></div>
                  <div className="grid-line g2"><span>1.20</span></div>
                  <div className="grid-line g3"><span>1.00</span></div>
                  <div
                    className="area strategy-area"
                    style={{
                      clipPath: `polygon(0% 88%, 8% 82%, 16% 84%, 24% 70%, 32% 74%, 40% 61%, 48% 65%, 56% ${Math.max(34, 62 - oilShock * 0.3)}%, 64% 47%, 72% 52%, 80% 34%, 88% 39%, 96% 16%, 100% 18%, 100% 100%, 0 100%)`,
                    }}
                  />
                  <div
                    className="area benchmark-area"
                    style={{
                      clipPath:
                        "polygon(0% 88%, 8% 86%, 16% 78%, 24% 80%, 32% 70%, 40% 73%, 48% 62%, 56% 67%, 64% 59%, 72% 55%, 80% 60%, 88% 49%, 96% 46%, 100% 43%, 100% 100%, 0 100%)",
                    }}
                  />
                  <div className="event-marker">
                    <i />
                    <span>美伊冲突</span>
                  </div>
                  <div className="x-axis">
                    <span>2023</span><span>2024</span><span>2025</span><span>2026</span>
                  </div>
                </div>
              </article>

              <aside className="diagnostics-card">
                <span className="eyebrow">回测诊断</span>
                <h3>结果可信度 <strong>74</strong><small>/100</small></h3>
                <div className="confidence-track"><i style={{ width: "74%" }} /></div>
                <div className="diagnostic-list">
                  <div className="pass">
                    <span>✓</span>
                    <p><b>样本外验证</b><small>滚动窗口，无未来数据</small></p>
                  </div>
                  <div className="pass">
                    <span>✓</span>
                    <p><b>交易成本</b><small>费率与冲击成本已计入</small></p>
                  </div>
                  <div className="warn">
                    <span>!</span>
                    <p><b>同类事件偏少</b><small>地缘冲突样本仅 7 组</small></p>
                  </div>
                  <div className="warn">
                    <span>!</span>
                    <p><b>参数敏感</b><small>油价半衰期影响较大</small></p>
                  </div>
                </div>
                <div className="cost-box">
                  <span>收益损耗</span>
                  <strong>-2.3%</strong>
                  <small>换手 1.5% · 费用 0.5% · 滑点 0.3%</small>
                </div>
                <button onClick={updateScenario}>运行稳健性检验 →</button>
              </aside>
            </div>
          </section>

          <section className="autonomy-section" id="autonomy">
            <div className="section-title">
              <div>
                <span className="eyebrow">06 / 自主学习中心</span>
                <h2>模型可以自己竞争，但不能绕过风险门禁。</h2>
              </div>
              <button className="training-button" onClick={runTraining}>
                ↻ 运行第 {trainingCycle + 1} 轮训练
              </button>
            </div>

            <div className="model-arena">
              <article className="champion-card">
                <div className="model-card-head">
                  <span className="model-badge champion">正式冠军</span>
                  <small>已上线 · 仅模拟组合</small>
                </div>
                <h3>多因子稳健模型 <span>v3.2</span></h3>
                <p>质量、估值、动量与行业中性约束，作为当前基准策略。</p>
                <div className="model-metrics">
                  <div><span>样本外夏普</span><b>1.36</b></div>
                  <div><span>最大回撤</span><b>-9.4%</b></div>
                  <div><span>月均换手</span><b>18%</b></div>
                </div>
              </article>

              <article className="challenger-card">
                <div className="model-card-head">
                  <span className="model-badge challenger">挑战者</span>
                  <small>训练轮次 #{trainingCycle}</small>
                </div>
                <h3>宏观 × 事件融合模型 <span>v1.7</span></h3>
                <p>新增中国宏观六维信号，并与黑天鹅事件、行业敏感度联合学习。</p>
                <div className="model-metrics">
                  <div><span>样本外夏普</span><b>1.44</b></div>
                  <div><span>最大回撤</span><b>-10.1%</b></div>
                  <div><span>稳定窗口</span><b>7 / 9</b></div>
                </div>
              </article>

              <article className="shadow-card">
                <div className="model-card-head">
                  <span className="model-badge shadow">影子观察</span>
                  <small>不产生真实指令</small>
                </div>
                <h3>事件文本模型 <span>v0.9</span></h3>
                <p>只负责把政策、财报与突发新闻转成结构化特征，不单独决定买卖。</p>
                <div className="model-metrics">
                  <div><span>事件召回率</span><b>86%</b></div>
                  <div><span>方向准确率</span><b>62%</b></div>
                  <div><span>待观察</span><b>18日</b></div>
                </div>
              </article>
            </div>

            <div className="promotion-gate">
              <div>
                <span className="eyebrow">冠军晋级门槛</span>
                <strong>挑战者尚未晋级</strong>
                <p>收益质量有所改善，但最大回撤仍高于正式模型。</p>
              </div>
              {[
                ["滚动样本外验证", "通过", "pass"],
                ["交易成本与涨跌停", "通过", "pass"],
                ["多市场状态稳定性", "观察", "watch"],
                ["20日影子组合", "未完成", "pending"],
                ["基金经理人工批准", "必需", "locked"],
              ].map(([name, status, tone]) => (
                <div className={`gate-item ${tone}`} key={name}>
                  <i>{tone === "pass" ? "✓" : tone === "locked" ? "⌁" : "·"}</i>
                  <span>{name}</span>
                  <b>{status}</b>
                </div>
              ))}
            </div>

            <p className="autonomy-note">
              数据按首次可得时间入库；任何修订值都保留版本。模型不会自动下单，也不能自行修改仓位、回撤和流动性上限。
            </p>
          </section>

          <section className="learning-section" id="learn">
            <div className="learning-copy">
              <span className="eyebrow">07 / 投研学习中心</span>
              <h2>每一个结论，都要能讲清楚“为什么”。</h2>
              <p>
                平台把本次推演拆成概念、公式、证据与反例。你可以用它准备晨会，也可以用它训练自己的研究框架。
              </p>
              <div className="lesson-tabs">
                {["传导链", "因子词典", "回测陷阱"].map((item) => (
                  <button
                    key={item}
                    className={lesson === item ? "active" : ""}
                    onClick={() => setLesson(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
            <article className="lesson-card">
              <div className="lesson-number">07</div>
              {lesson === "传导链" && (
                <>
                  <span>今日微课 · 6分钟</span>
                  <h3>为什么油价上涨，不等于黄金一定上涨？</h3>
                  <p>
                    地缘风险推高避险需求，但油价也可能抬升通胀与实际利率。当美元和美债收益率同步走高时，黄金的避险属性会被持有成本抵消。
                  </p>
                  <div className="lesson-formula">
                    黄金方向 ≈ 避险需求 − 实际利率压力 − 美元强度
                  </div>
                </>
              )}
              {lesson === "因子词典" && (
                <>
                  <span>核心概念 · 4分钟</span>
                  <h3>事件β不是相关系数，而是条件敏感度。</h3>
                  <p>
                    它衡量某只股票在特定事件与市场状态下，对冲击变量变化的相对反应。事件改变，β也应该重新估计。
                  </p>
                  <div className="lesson-formula">
                    事件β = 条件超额收益 ÷ 标准化冲击幅度
                  </div>
                </>
              )}
              {lesson === "回测陷阱" && (
                <>
                  <span>研究规范 · 8分钟</span>
                  <h3>漂亮的历史曲线，可能来自未来函数。</h3>
                  <p>
                    财报披露延迟、退市样本缺失、参数反复试验与忽略涨跌停，都可能让回测显著高估真实收益。
                  </p>
                  <div className="lesson-formula">
                    可实现收益 = 毛收益 − 费用 − 滑点 − 冲击 − 偏差
                  </div>
                </>
              )}
              <button>开始学习 <span>→</span></button>
            </article>
            <div className="checklist-card">
              <span className="eyebrow">提交前检查</span>
              <h3>晨会研究清单</h3>
              {[
                "原始事实与主观假设已分开",
                "至少保留一个反方情景",
                "个股盈利传导可以解释",
                "回测已计入交易摩擦",
                "结论注明失效条件",
              ].map((item, index) => (
                <label key={item}>
                  <input type="checkbox" defaultChecked={index < 3} />
                  <span>{item}</span>
                </label>
              ))}
              <div>
                <strong>3 / 5</strong>
                <span>完成后再导出研究简报</span>
              </div>
            </div>
          </section>

          <footer>
            <div>
              <span className="brand-mark small">砺</span>
              <p>
                砺石情景研究终端 · 让假设可检验，让风险被看见。
                <small>本页面使用模拟数据，仅用于研究与学习，不构成投资建议。</small>
              </p>
            </div>
            <span>版本 0.1 · 研究沙盒</span>
          </footer>
        </div>
      </section>
    </main>
  );
}
