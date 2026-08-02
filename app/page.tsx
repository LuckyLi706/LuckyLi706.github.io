"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

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

type Explanation = {
  group: string;
  title: string;
  definition: string;
  method: string;
  reading: string;
  caution: string;
};

const EXPLANATIONS: Record<string, Explanation> = {
  "public-data": {
    group: "数据口径",
    title: "免费公开数据",
    definition: "无需付费授权即可访问的市场与宏观数据。本平台读取的是公开最新价和日线，不是交易所逐笔行情。",
    method: "页面端行情约每 20 秒重新请求；宏观快照由部署任务定时检查，但数值只在官方发布后变化。",
    reading: "先看页面顶部的行情时间，再判断数据是否足够新。休市时显示最近一个交易时点。",
    caution: "公开接口可能延迟、中断或更改口径，不能直接替代交易终端。",
  },
  "observation-pool": {
    group: "组合设置",
    title: "观察组合",
    definition: "你勾选后用于比较和回测的一组股票，不代表已经买入，也不会产生交易指令。",
    method: "当前回测把所有已勾选股票等权归一化，并按共同交易日计算组合净值。",
    reading: "加入或移除股票后，回测会自动重算；观察它对收益、回撤和夏普的影响。",
    caution: "先看风险暴露与集中度，不能只因为历史收益高就加入。",
  },
  conflict: {
    group: "情景参数",
    title: "冲突强度",
    definition: "研究员对军事行动范围、频率和升级风险的主观分级，范围为 1–100。",
    method: "它与海峡受阻比例、持续时间共同生成情景压力值，只用于梳理传导链。",
    reading: "数值越高，代表你假设的升级程度越高，不代表事件发生概率。",
    caution: "这是主观假设，不是新闻事实，也不是模型预测概率。",
  },
  hormuz: {
    group: "情景参数",
    title: "海峡受阻比例",
    definition: "假设霍尔木兹海峡正常通航能力受影响的比例。",
    method: "用 0–100% 表示，平台据此提高油价与运输成本的情景压力。",
    reading: "47% 表示研究情景假定约四成至五成的通航能力受影响。",
    caution: "真实影响要结合油轮 AIS、保险费率、运价和库存数据验证。",
  },
  duration: {
    group: "情景参数",
    title: "冲击持续时间",
    definition: "假设外生事件对供应链和风险偏好持续产生影响的周数。",
    method: "时间越长，企业库存、采购合同和资金成本受到影响的可能性越大。",
    reading: "短期冲击侧重情绪和价格，长期冲击更需要检查盈利预测。",
    caution: "持续时间不是事件结束日期，只是压力测试窗口。",
  },
  "event-pressure": {
    group: "情景结果",
    title: "组合压力值",
    definition: "把三个主观情景参数压缩为 0–100 的相对压力刻度。",
    method: "冲突强度、受阻比例与持续时间按固定权重合成，便于比较不同情景。",
    reading: "只适合比较同一套参数下的情景，不应解释为亏损百分比。",
    caution: "它不是 VaR、回撤预测或事件发生概率。",
  },
  "oil-pressure": {
    group: "情景结果",
    title: "油价压力",
    definition: "表示当前假设对油价上行压力的相对强弱，而不是 Brent 目标价。",
    method: "根据冲突强度、海峡受阻和持续时间计算 0–100 的情景刻度。",
    reading: "数值上升时，应进一步核验原油期货曲线、库存和航运数据。",
    caution: "不能把 50/100 解读为油价上涨 50%。",
  },
  "manufacturing-pmi": {
    group: "中国宏观",
    title: "制造业 PMI",
    definition: "采购经理对生产、新订单、库存和就业等经营状况的扩散指数。",
    method: "高于 50 通常表示环比扩张，低于 50 通常表示环比收缩。",
    reading: "连续变化比单月数值更重要，同时观察新订单与生产分项。",
    caution: "PMI 是环比景气度调查，不等同于 GDP 同比增速。",
  },
  "non-manufacturing-pmi": {
    group: "中国宏观",
    title: "非制造业 PMI",
    definition: "反映服务业和建筑业商务活动的扩散指数。",
    method: "以 50 为常用荣枯分界，按月公布。",
    reading: "结合服务业、建筑业分项判断内需与基建景气。",
    caution: "行业权重不同，不能直接与制造业 PMI 简单平均。",
  },
  "cpi-yoy": {
    group: "中国宏观",
    title: "CPI 同比",
    definition: "居民消费价格相对上年同月的变化幅度。",
    method: "由食品、居住、交通通信等消费类别价格按权重计算。",
    reading: "用于观察居民端通胀，但应区分食品、能源与核心 CPI。",
    caution: "同比受基数影响，单月回升不一定意味着需求全面走强。",
  },
  "ppi-yoy": {
    group: "中国宏观",
    title: "PPI 同比",
    definition: "工业生产者出厂价格相对上年同月的变化幅度。",
    method: "覆盖采掘、原材料和加工工业等生产环节。",
    reading: "上游价格变化可能影响周期行业收入与中下游成本。",
    caution: "PPI 上升既可能来自需求改善，也可能来自供给冲击。",
  },
  "gdp-yoy": {
    group: "中国宏观",
    title: "GDP 累计同比",
    definition: "本年累计国内生产总值相对上年同期的实际增速。",
    method: "按季度发布，综合生产、收入和支出活动。",
    reading: "结合消费、投资、出口和行业增加值判断增长来源。",
    caution: "季度数据频率低，且市场往往已提前交易高频信息。",
  },
  "m2-yoy": {
    group: "中国宏观",
    title: "广义货币 M2 同比",
    definition: "流通中货币、企业和居民存款等广义货币余额的同比增速。",
    method: "按月比较 M2 余额与上年同月余额。",
    reading: "结合社融、信贷结构和 M1 判断资金是否流向实体活动。",
    caution: "M2 增速高不等于股票一定上涨，也可能反映存款增加。",
  },
  "event-beta": {
    group: "情景研究",
    title: "假设事件 β",
    definition: "股票或行业对特定事件冲击的条件敏感度假设。",
    method: "正式研究应使用同类历史事件的条件超额收益估计，并做显著性和样本外检验。",
    reading: "正值表示假设受益，负值表示假设承压；绝对值越大表示敏感度越高。",
    caution: "当前页面的 β 是研究假设，不是实时统计估计，也不是收益预测。",
  },
  price: {
    group: "行情指标",
    title: "最新价",
    definition: "免费公开接口返回的最近成交价格或最近收盘价格。",
    method: "交易时段内随接口刷新；休市后保持最近交易时点。",
    reading: "必须与页面顶部时间一起看，确认它代表盘中还是收盘。",
    caution: "不是交易所逐笔行情，可能延迟，不能用于高频下单。",
  },
  change: {
    group: "行情指标",
    title: "涨跌幅",
    definition: "最新价相对上一交易日收盘价的百分比变化。",
    method: "（最新价 ÷ 前收盘价 − 1）× 100%。",
    reading: "用于观察当日强弱，最好结合成交额和行业表现。",
    caution: "单日涨跌不能代表中期趋势。",
  },
  turnover: {
    group: "行情指标",
    title: "换手率",
    definition: "一定时间内成交股份占可流通股份的比例。",
    method: "成交股数 ÷ 流通股本 × 100%。",
    reading: "高换手说明交易活跃，但要与股票自身历史水平比较。",
    caution: "高换手既可能是资金流入，也可能是分歧或出货。",
  },
  pe: {
    group: "估值指标",
    title: "PE（TTM）",
    definition: "当前总市值相对最近十二个月归母净利润的倍数。",
    method: "总市值 ÷ 最近十二个月净利润。",
    reading: "适合与同业、公司历史区间和盈利增速一起比较。",
    caution: "亏损企业的 PE 可能无意义；周期股盈利高点常出现低 PE。",
  },
  pb: {
    group: "估值指标",
    title: "PB",
    definition: "当前总市值相对归母净资产的倍数。",
    method: "总市值 ÷ 归母股东权益。",
    reading: "常用于银行、资源和重资产行业，并结合 ROE 判断。",
    caution: "低 PB 可能反映资产质量、盈利能力或减值风险。",
  },
  momentum20: {
    group: "价格指标",
    title: "20 日动量",
    definition: "最新前复权收盘价相对 20 个交易日前的涨跌幅。",
    method: "（最新收盘价 ÷ 20 个交易日前收盘价 − 1）× 100%。",
    reading: "正值表示近一个月趋势向上，负值表示趋势偏弱。",
    caution: "动量会反转，不能单独作为买卖依据。",
  },
  open: {
    group: "行情指标",
    title: "今开、最高与最低",
    definition: "当日第一笔成交价、截至当前的最高成交价和最低成交价。",
    method: "由当日成交记录汇总形成。",
    reading: "可用于观察跳空、振幅与价格所处的日内位置。",
    caution: "盘中数值会继续变化，且公开接口可能延迟。",
  },
  annualized: {
    group: "回测指标",
    title: "组合年化收益",
    definition: "把整个回测区间的复合收益换算为平均每年的复合增长率。",
    method: "（期末净值 ÷ 期初净值）^(1/年数) − 1。",
    reading: "用于比较不同长度区间，但必须同时看最大回撤和样本期。",
    caution: "年化不是每年都能取得的固定收益。",
  },
  benchmark: {
    group: "回测指标",
    title: "中证 800 基准",
    definition: "由沪深 300 与中证 500 成分共同构成的宽基指数，用来代表大中盘 A 股市场。",
    method: "本页使用指数前复权日线，在相同起止日期计算年化收益。",
    reading: "组合收益高于基准只说明历史区间内相对更强，不证明选股能力稳定。",
    caution: "组合行业集中时，中证 800 未必是唯一合适基准。",
  },
  drawdown: {
    group: "风险指标",
    title: "最大回撤",
    definition: "净值从历史高点下跌到随后低点的最大幅度。",
    method: "逐日计算净值 ÷ 此前峰值 − 1，取最负值的绝对值。",
    reading: "它近似回答历史上最难熬的一段亏损有多深。",
    caution: "未来回撤可能超过历史记录，且回撤未体现恢复时间。",
  },
  sharpe: {
    group: "风险调整收益",
    title: "夏普比率",
    definition: "单位波动风险获得的超额收益。",
    method: "（日均收益 − 日无风险收益）÷ 日收益标准差 × √252；本页假设无风险利率 2%。",
    reading: "同口径下数值越高，历史风险收益效率越好。",
    caution: "收益分布非正态、回测区间较短或策略有尾部风险时会失真。",
  },
  "real-quote": {
    group: "数据管线",
    title: "公开最新行情管线",
    definition: "浏览器直接读取公开报价接口并更新股票表格。",
    method: "约每 20 秒请求一次，失败时保留空值或显示异常状态。",
    reading: "关注状态、标的数量和顶部行情时间。",
    caution: "没有服务等级保证，不应用作自动交易数据源。",
  },
  history: {
    group: "数据管线",
    title: "历史价格与回测管线",
    definition: "读取前复权日线，计算动量和等权买入持有基线。",
    method: "对勾选股票取共同交易日并归一化，再与中证 800 比较。",
    reading: "选择股票变化后重新计算，数据异常时不生成替代数字。",
    caution: "当前未处理退市样本、交易费用、滑点和涨跌停。",
  },
  training: {
    group: "模型治理",
    title: "模型训练与自动换模",
    definition: "用历史特征训练模型、验证并决定是否替换现有模型的完整流程。",
    method: "需要后端特征库、训练任务、模型注册表、样本外验证和影子组合。",
    reading: "当前显示“未启用”，意味着平台没有虚构训练结果或自动选股结论。",
    caution: "即使未来启用，也必须经过人工复核，不能直接自动下单。",
  },
  lesson: {
    group: "学习中心",
    title: "研究微课",
    definition: "把传导链、因子定义与回测误区拆成短知识卡。",
    method: "点击不同标签切换内容，不影响行情、观察组合或回测。",
    reading: "建议用微课中的公式和反例检查自己的研究结论。",
    caution: "教学框架不能替代对公司公告、财报与市场数据的核验。",
  },
};

const ExplainContext = createContext<(topic: string) => void>(() => undefined);

function InfoButton({
  topic,
  label,
}: {
  topic: string;
  label?: string;
}) {
  const onExplain = useContext(ExplainContext);
  const item = EXPLANATIONS[topic];
  if (!item) return null;
  return (
    <button
      type="button"
      className={label ? "explain-link" : "info-button"}
      aria-label={`了解${item.title}的含义`}
      onClick={(event) => {
        event.stopPropagation();
        onExplain(topic);
      }}
    >
      {label ?? "i"}
    </button>
  );
}

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
  const [explanationKey, setExplanationKey] = useState<string | null>(null);

  useEffect(() => {
    if (!explanationKey) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExplanationKey(null);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [explanationKey]);

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
    setExplanationKey("conflict");
  };

  const activeExplanation = explanationKey
    ? EXPLANATIONS[explanationKey]
    : null;

  return (
    <ExplainContext.Provider value={setExplanationKey}>
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
            <InfoButton topic="public-data" />
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
                <span>观察池 <InfoButton topic="observation-pool" /></span>
                <strong>{selected.length} 只</strong>
              </div>
              <div>
                <span>历史日线</span>
                <strong>{historyStatus === "live" ? "已加载" : historyStatus === "error" ? "失败" : "加载中"}</strong>
              </div>
            </div>
          </section>

          <button
            type="button"
            className="explain-guide"
            onClick={() => setExplanationKey("public-data")}
          >
            <span>i</span>
            <div>
              <strong>投研解释模式已开启</strong>
              <small>页面中带有 i 的指标可以点击；会告诉你定义、计算方法、怎么看和常见误区。</small>
            </div>
            <b>先了解数据口径 →</b>
          </button>

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
                    <div>
                      <strong>{riskScore}</strong>
                      <span>假设压力 <InfoButton topic="event-pressure" /></span>
                    </div>
                  </div>
                  <p>当前假设：<strong>{presetLabel}</strong></p>
                </div>
                <div className="transmission">
                  <span className="eyebrow">假设传导链</span>
                  <div className="chain-row">
                    <div><b>海峡通航</b><span>{100 - hormuz}%</span></div>
                    <i>→</i>
                    <div><b>油价压力 <InfoButton topic="oil-pressure" /></b><span>{oilPressure}/100</span></div>
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
                <button onClick={() => setExplanationKey("event-pressure")}>这部分不是预测 · i</button>
                <button onClick={() => setExplanationKey("public-data")}>不会改写真实行情 · i</button>
                <button onClick={() => setExplanationKey("oil-pressure")}>需用新闻与原油数据复核 · i</button>
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
                  <span>
                    {label as string}
                    <InfoButton
                      topic={
                        label === "冲突强度"
                          ? "conflict"
                          : label === "海峡受阻比例"
                            ? "hormuz"
                            : "duration"
                      }
                    />
                    <b>{value as number}{suffix as string}</b>
                  </span>
                  <input
                    type="range"
                    min="1"
                    max={max as number}
                    value={value as number}
                    onChange={(event) => {
                      (setter as (value: number) => void)(Number(event.target.value));
                      setActivePreset("");
                    }}
                    onPointerDown={() =>
                      setExplanationKey(
                        label === "冲突强度"
                          ? "conflict"
                          : label === "海峡受阻比例"
                            ? "hormuz"
                            : "duration",
                      )
                    }
                  />
                  <i style={{ width: `${((value as number) / (max as number)) * 100}%` }} />
                </label>
              ))}
              <div className="derived-impact">
                <span>仅为假设输出</span>
                <div><strong>{oilPressure}/100</strong><small>油价压力 <InfoButton topic="oil-pressure" /></small></div>
                <div><strong>{riskScore}/100</strong><small>组合压力 <InfoButton topic="event-pressure" /></small></div>
              </div>
              <button
                className="primary-button"
                onClick={() => {
                  setNotice("情景假设已更新；行情与历史回测仍使用真实市场数据。");
                  setExplanationKey("event-pressure");
                }}
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
                  <article
                    className="macro-factor positive explainable-card"
                    key={metric.key}
                    role="button"
                    tabIndex={0}
                    aria-label={`了解${metric.name}的含义`}
                    onClick={() => setExplanationKey(metric.key)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setExplanationKey(metric.key);
                      }
                    }}
                  >
                    <div>
                      <span>{metric.name} <InfoButton topic={metric.key} /></span>
                      <strong>{metric.value == null ? "--" : metric.value.toFixed(1)}{metric.unit}</strong>
                    </div>
                    <p>报告期：{metric.period}</p>
                    <small>{metric.description}</small>
                    <a
                      href={metric.source}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(event) => event.stopPropagation()}
                    >
                      查看数据源 ↗
                    </a>
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
                  <button
                    type="button"
                    className={`heat-cell explainable-card ${value > 0.08 ? "positive" : value < -0.08 ? "negative" : "neutral"}`}
                    key={String(name)}
                    onClick={() => setExplanationKey("event-beta")}
                  >
                    <span>{name}</span>
                    <strong>{value > 0 ? "+" : ""}{value.toFixed(2)}</strong>
                    <small>假设事件 β · 点击解释</small>
                  </button>
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
                    onClick={() => {
                      setChain(key as Chain);
                      setExplanationKey(key === "all" ? "public-data" : "event-beta");
                    }}
                  >
                    {label}
                  </button>
                ))}
                <span>默认按当日涨跌幅排序 · 20 秒刷新公开最新价</span>
              </div>
              <div className="stock-table" role="table" aria-label="候选股票">
                <div className="stock-row live-stock-row table-head" role="row">
                  <span><InfoButton topic="observation-pool" label="加入 i" /></span>
                  <span>公司 / 行业</span>
                  <span><InfoButton topic="price" label="最新价 i" /></span>
                  <span><InfoButton topic="change" label="涨跌幅 i" /></span>
                  <span><InfoButton topic="turnover" label="换手率 i" /></span>
                  <span><InfoButton topic="pe" label="PE(TTM) i" /></span>
                  <span><InfoButton topic="pb" label="PB i" /></span>
                  <span><InfoButton topic="momentum20" label="20日动量 i" /></span>
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
                          setExplanationKey("observation-pool");
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
                <div><span>涨跌幅 <InfoButton topic="change" /></span><b className={(focusedQuote?.changePct ?? 0) >= 0 ? "positive-text" : "negative-text"}>{percent(focusedQuote?.changePct)}</b></div>
                <div><span>今开 <InfoButton topic="open" /></span><b>{numberText(focusedQuote?.open)}</b></div>
                <div><span>最高 <InfoButton topic="open" /></span><b>{numberText(focusedQuote?.high)}</b></div>
                <div><span>最低 <InfoButton topic="open" /></span><b>{numberText(focusedQuote?.low)}</b></div>
                <div><span>PE(TTM) <InfoButton topic="pe" /></span><b>{numberText(focusedQuote?.pe)}</b></div>
                <div><span>PB <InfoButton topic="pb" /></span><b>{numberText(focusedQuote?.pb)}</b></div>
                <div><span>换手率 <InfoButton topic="turnover" /></span><b>{percent(focusedQuote?.turnover)}</b></div>
                <div><span>20日动量 <InfoButton topic="momentum20" /></span><b>{percent(focusedMomentum)}</b></div>
              </div>
              <div className="evidence-block">
                <span className="eyebrow">研究假设</span>
                <p>{focusedStock.thesis}</p>
              </div>
              <div className="risk-box">
                <span>反方条件</span><p>{focusedStock.risk}</p>
              </div>
              <button
                className="detail-button"
                onClick={() => {
                  toggleStock(focusedStock.ticker);
                  setExplanationKey("observation-pool");
                }}
              >
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
                  <div className="explainable-metric" role="button" tabIndex={0} onClick={() => setExplanationKey("annualized")} onKeyDown={(event) => event.key === "Enter" && setExplanationKey("annualized")}><span>组合年化 <i>i</i></span><strong className={(backtest?.annualized ?? 0) >= 0 ? "positive-text" : "negative-text"}>{percent(backtest?.annualized)}</strong><small>观察池等权买入持有 · 点击解释</small></div>
                  <div className="explainable-metric" role="button" tabIndex={0} onClick={() => setExplanationKey("benchmark")} onKeyDown={(event) => event.key === "Enter" && setExplanationKey("benchmark")}><span>中证800年化 <i>i</i></span><strong>{percent(backtest?.benchmarkAnnualized)}</strong><small>指数前复权日线 · 点击解释</small></div>
                  <div className="explainable-metric" role="button" tabIndex={0} onClick={() => setExplanationKey("drawdown")} onKeyDown={(event) => event.key === "Enter" && setExplanationKey("drawdown")}><span>最大回撤 <i>i</i></span><strong className="negative-text">{backtest ? `-${backtest.maxDrawdown.toFixed(2)}%` : "--"}</strong><small>组合净值峰谷跌幅 · 点击解释</small></div>
                  <div className="explainable-metric" role="button" tabIndex={0} onClick={() => setExplanationKey("sharpe")} onKeyDown={(event) => event.key === "Enter" && setExplanationKey("sharpe")}><span>夏普比率 <i>i</i></span><strong>{backtest ? backtest.sharpe.toFixed(2) : "--"}</strong><small>无风险利率假设 2.0% · 点击解释</small></div>
                </div>
                <div className="chart-header">
                  <div><button className="active" onClick={() => setExplanationKey("annualized")}>累计净值 · i</button></div>
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
                  <span>数据范围 <InfoButton topic="observation-pool" /></span>
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
              <article className="explainable-card" role="button" tabIndex={0} onClick={() => setExplanationKey("real-quote")} onKeyDown={(event) => event.key === "Enter" && setExplanationKey("real-quote")}>
                <div className="model-card-head"><span className="model-badge champion">已启用</span><small>浏览器直连</small></div>
                <h3>公开最新行情 <InfoButton topic="real-quote" /></h3>
                <p>最新价、涨跌幅、换手率、PE 与 PB。接口失败时显示空值，不回退到模拟数。</p>
                <div className="model-metrics"><div><span>状态</span><b>{quoteStatus === "live" ? "正常" : quoteStatus === "error" ? "异常" : "连接中"}</b></div><div><span>标的</span><b>{Object.keys(quotes).length}</b></div><div><span>刷新</span><b>20秒</b></div></div>
              </article>
              <article className="explainable-card" role="button" tabIndex={0} onClick={() => setExplanationKey("history")} onKeyDown={(event) => event.key === "Enter" && setExplanationKey("history")}>
                <div className="model-card-head"><span className="model-badge champion">已启用</span><small>前复权日线</small></div>
                <h3>历史价格与回测 <InfoButton topic="history" /></h3>
                <p>免费公开日线用于价格动量与等权基线回测，结果随观察池实时重算。</p>
                <div className="model-metrics"><div><span>状态</span><b>{historyStatus === "live" ? "正常" : historyStatus === "error" ? "异常" : "加载中"}</b></div><div><span>股票</span><b>{Object.keys(histories).length}</b></div><div><span>基准</span><b>中证800</b></div></div>
              </article>
              <article className="explainable-card" role="button" tabIndex={0} onClick={() => setExplanationKey("training")} onKeyDown={(event) => event.key === "Enter" && setExplanationKey("training")}>
                <div className="model-card-head"><span className="model-badge shadow">未启用</span><small>需要后端</small></div>
                <h3>模型训练与自动换模 <InfoButton topic="training" /></h3>
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
                  <button
                    key={item}
                    className={lesson === item ? "active" : ""}
                    onClick={() => {
                      setLesson(item);
                      setExplanationKey("lesson");
                    }}
                  >
                    {item} · i
                  </button>
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
                <label key={item} onClick={() => setExplanationKey("lesson")}><input type="checkbox" /><span>{item}</span><i>i</i></label>
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

      {activeExplanation && (
        <div
          className="explain-overlay"
          role="presentation"
          onMouseDown={() => setExplanationKey(null)}
        >
          <aside
            className="explain-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="explain-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="explain-head">
              <div>
                <span>{activeExplanation.group}</span>
                <h2 id="explain-title">{activeExplanation.title}</h2>
              </div>
              <button
                type="button"
                className="explain-close"
                aria-label="关闭解释"
                onClick={() => setExplanationKey(null)}
              >
                ×
              </button>
            </div>
            <div className="explain-body">
              <section className="definition-card">
                <span>01 / 它是什么</span>
                <p>{activeExplanation.definition}</p>
              </section>
              <section>
                <span>02 / 怎么计算或形成</span>
                <p>{activeExplanation.method}</p>
              </section>
              <section>
                <span>03 / 投研时怎么看</span>
                <p>{activeExplanation.reading}</p>
              </section>
              <section className="caution-card">
                <span>04 / 常见误区</span>
                <p>{activeExplanation.caution}</p>
              </section>
            </div>
            <div className="explain-foot">
              <span>按 Esc 或点击空白处关闭</span>
              <button type="button" onClick={() => setExplanationKey(null)}>
                我明白了
              </button>
            </div>
          </aside>
        </div>
      )}
    </main>
    </ExplainContext.Provider>
  );
}
