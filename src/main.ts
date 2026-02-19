import {
  App,
  Modal,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  TFile,
  TFolder,
  normalizePath,
  requestUrl,
} from "obsidian";

interface FeedSource {
  id: string;
  topic: string;
  name: string;
  url: string;
  enabled: boolean;
  source: "manual" | "rss-dashboard";
}

interface ParsedFeedItem {
  id: string;
  title: string;
  link: string;
  published: Date | null;
  publishedRaw: string;
  description: string;
}

interface WindowItem {
  feed: FeedSource;
  item: ParsedFeedItem;
  translatedTitle?: string;
  translatedDescription?: string;
}

type TranslationProvider = "none" | "web" | "ollama";
type UiLanguage = "ko" | "en";
type CanonicalTopicKey =
  | "ai"
  | "education"
  | "korea-real-estate"
  | "stocks"
  | "bitcoin"
  | "politics"
  | "other";

interface TopicRelevanceProfile {
  aliases: string[];
  highSignalKeywords: string[];
  normalKeywords: string[];
  negativeKeywords: string[];
}

interface ParsedTopicPriorityOrder {
  ordered: Exclude<CanonicalTopicKey, "other">[];
  unknownTokens: string[];
}

interface TranslationStats {
  provider: TranslationProvider;
  model: string;
  titlesTranslated: number;
  descriptionsTranslated: number;
  errors: string[];
}

interface ScoredWindowRow {
  row: WindowItem;
  qualityScore: number;
  relevanceScore: number;
  priorityBoost: number;
  preferenceScore: number;
  totalScore: number;
}

interface CaptureOutcome {
  notePath: string | null;
  totalItems: number;
  effectiveMaxItemsPerWindow: number;
  feedErrors: string[];
  feedsChecked: number;
  itemsWithoutDate: number;
  itemsFilteredByKeyword: number;
  itemsFilteredByTopicMismatch: number;
  itemsFilteredByTopicRelevance: number;
  itemsDeduped: number;
  itemsFilteredByQuality: number;
  itemLimitHit: boolean;
}

interface RssDashboardFeedRecord {
  title?: unknown;
  url?: unknown;
  folder?: unknown;
}

interface RssDashboardDataFile {
  feeds?: RssDashboardFeedRecord[];
}

interface RecommendedFeedTemplate {
  topicKey: Exclude<CanonicalTopicKey, "other">;
  name: string;
  url: string;
  trustNote: string;
}

interface RssWindowCaptureSettings {
  uiLanguage: UiLanguage;
  simpleSettingsMode: boolean;
  autoFetchEnabled: boolean;
  scheduleTimes: string;
  outputFolder: string;
  filePrefix: string;
  includeDescription: boolean;
  descriptionMaxLength: number;
  writeEmptyNote: boolean;
  lastWindowEndIso: string;
  rssDashboardSyncEnabled: boolean;
  rssDashboardDataPath: string;
  rssDashboardLastSyncAtIso: string;
  rssDashboardLastMtime: number;
  keywordFilterEnabled: boolean;
  includeKeywords: string;
  excludeKeywords: string;
  enhancedDedupeEnabled: boolean;
  scoreTemplateEnabled: boolean;
  scoreDefaultValue: number;
  scoreActionThreshold: number;
  startupCatchupEnabled: boolean;
  maxCatchupWindowsPerRun: number;
  maxItemsPerWindow: number;
  adaptiveItemCapEnabled: boolean;
  adaptiveItemCapMax: number;
  topicRelevanceFilterEnabled: boolean;
  topicRelevanceMinScore: number;
  topicPriorityEnabled: boolean;
  topicPriorityOrder: string;
  topicPriorityMaxBoost: number;
  topicMaxItemsPerTopic: number;
  preferenceLearningEnabled: boolean;
  preferenceFeedbackTemplateEnabled: boolean;
  preferenceScoreWeight: number;
  preferenceTokenWeights: Record<string, number>;
  preferenceLastLearnedAtIso: string;
  topicDiversityMinPerTopic: number;
  topicDiversityPenaltyPerSelected: number;
  translationEnabled: boolean;
  translationProvider: TranslationProvider;
  translationTargetLanguage: string;
  translationOnlyNonKorean: boolean;
  translationKeepOriginal: boolean;
  translationTranslateTitle: boolean;
  translationTranslateDescription: boolean;
  translationWebEndpoint: string;
  ollamaBaseUrl: string;
  ollamaDetectedModels: string[];
  ollamaModel: string;
  ollamaLastModelRefreshIso: string;
  feeds: FeedSource[];
}

const DEFAULT_SETTINGS: RssWindowCaptureSettings = {
  uiLanguage: "ko",
  simpleSettingsMode: true,
  autoFetchEnabled: true,
  scheduleTimes: "08:00,17:00",
  outputFolder: "000-Inbox/RSS",
  filePrefix: "rss-capture",
  includeDescription: true,
  descriptionMaxLength: 500,
  writeEmptyNote: true,
  lastWindowEndIso: "",
  rssDashboardSyncEnabled: false,
  rssDashboardDataPath: ".obsidian/plugins/rss-dashboard/data.json",
  rssDashboardLastSyncAtIso: "",
  rssDashboardLastMtime: 0,
  keywordFilterEnabled: false,
  includeKeywords: "",
  excludeKeywords: "",
  enhancedDedupeEnabled: true,
  scoreTemplateEnabled: true,
  scoreDefaultValue: 3,
  scoreActionThreshold: 14,
  startupCatchupEnabled: true,
  maxCatchupWindowsPerRun: 10,
  maxItemsPerWindow: 20,
  adaptiveItemCapEnabled: true,
  adaptiveItemCapMax: 50,
  topicRelevanceFilterEnabled: true,
  topicRelevanceMinScore: 2,
  topicPriorityEnabled: true,
  topicPriorityOrder: "인공지능,교육,대한민국 부동산,주식,비트코인,정치",
  topicPriorityMaxBoost: 6,
  topicMaxItemsPerTopic: 3,
  preferenceLearningEnabled: false,
  preferenceFeedbackTemplateEnabled: true,
  preferenceScoreWeight: 2,
  preferenceTokenWeights: {},
  preferenceLastLearnedAtIso: "",
  topicDiversityMinPerTopic: 2,
  topicDiversityPenaltyPerSelected: 1.25,
  translationEnabled: false,
  translationProvider: "web",
  translationTargetLanguage: "ko",
  translationOnlyNonKorean: true,
  translationKeepOriginal: true,
  translationTranslateTitle: true,
  translationTranslateDescription: true,
  translationWebEndpoint: "https://translate.googleapis.com/translate_a/single",
  ollamaBaseUrl: "http://127.0.0.1:11434",
  ollamaDetectedModels: [],
  ollamaModel: "",
  ollamaLastModelRefreshIso: "",
  feeds: [],
};

const SCHEDULER_TICK_MS = 60 * 1000;
const MAX_TRANSLATION_INPUT_LENGTH = 2000;
const TRANSLATED_DESCRIPTION_MAX_LENGTH = 300;
const MAX_DESCRIPTION_ENRICH_ITEMS_PER_WINDOW = 40;
const MIN_BASE_ITEMS_PER_WINDOW = 10;
const MAX_BASE_ITEMS_PER_WINDOW = 250;
const TOPIC_RELEVANCE_WEIGHT = 3;
const MAX_KEYWORD_MATCHES_PER_BUCKET = 4;
const MIN_TOPIC_RELEVANCE_MIN_SCORE = -2;
const MAX_TOPIC_RELEVANCE_MIN_SCORE = 10;
const MIN_TOPIC_PRIORITY_MAX_BOOST = 0;
const MAX_TOPIC_PRIORITY_MAX_BOOST = 12;
const MIN_TOPIC_MAX_ITEMS_PER_TOPIC = 1;
const MAX_TOPIC_MAX_ITEMS_PER_TOPIC = 3;
const TOPIC_MISMATCH_MIN_BEST_SCORE = 4;
const TOPIC_MISMATCH_MIN_GAP = 2;
const MIN_PREFERENCE_SCORE_WEIGHT = 0;
const MAX_PREFERENCE_SCORE_WEIGHT = 8;
const MAX_PREFERENCE_TOKEN_COUNT = 400;
const PREFERENCE_TOKEN_MIN_ABS_WEIGHT = 2;
const PREFERENCE_MARKER_PREFER = "rss-insight:prefer";
const PREFERENCE_MARKER_AVOID = "rss-insight:avoid";
const PREFERENCE_STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "this",
  "that",
  "from",
  "into",
  "have",
  "has",
  "will",
  "were",
  "been",
  "are",
  "is",
  "to",
  "of",
  "in",
  "on",
  "at",
  "a",
  "an",
  "이",
  "그",
  "저",
  "및",
  "등",
  "수",
  "것",
  "하다",
  "했다",
  "있는",
  "위한",
  "대한",
  "에서",
  "으로",
  "하고",
  "관련",
]);
const MIN_TOPIC_DIVERSITY_PER_TOPIC = 0;
const MAX_TOPIC_DIVERSITY_PER_TOPIC = 3;
const MIN_TOPIC_DIVERSITY_PENALTY = 0;
const MAX_TOPIC_DIVERSITY_PENALTY = 5;
const RECOMMENDED_MIN_FEEDS_PER_TOPIC = 2;
const RECOMMENDED_MAX_FEEDS_PER_TOPIC = 3;
const GOOGLE_NEWS_RSS_BASE_URL = "https://news.google.com/rss/search";
const DEFAULT_TOPIC_PRIORITY_KEYS: Exclude<CanonicalTopicKey, "other">[] = [
  "ai",
  "education",
  "korea-real-estate",
  "stocks",
  "bitcoin",
  "politics",
];
const GOOGLE_NEWS_QUERY_BY_TOPIC: Record<Exclude<CanonicalTopicKey, "other">, string> = {
  ai: "인공지능 OR LLM OR OpenAI",
  education: "교육 정책 OR edtech OR 학교",
  "korea-real-estate": "대한민국 부동산 OR 아파트 OR 전세 OR 청약",
  stocks: "주식 OR 증시 OR 코스피 OR 코스닥",
  bitcoin: "비트코인 OR 암호화폐 OR BTC",
  politics: "한국 정치 OR 국회 OR 정부 정책",
};
const RECOMMENDED_FEED_TEMPLATES: RecommendedFeedTemplate[] = [
  {
    topicKey: "ai",
    name: "OpenAI News",
    url: "https://openai.com/news/rss.xml",
    trustNote: "Official",
  },
  {
    topicKey: "ai",
    name: "Google AI Blog",
    url: "https://blog.google/technology/ai/rss/",
    trustNote: "Official",
  },
  {
    topicKey: "ai",
    name: "arXiv cs.AI",
    url: "https://arxiv.org/rss/cs.AI",
    trustNote: "Research",
  },
  {
    topicKey: "education",
    name: "The Hechinger Report",
    url: "https://hechingerreport.org/feed/",
    trustNote: "Education newsroom",
  },
  {
    topicKey: "education",
    name: "Education Next",
    url: "https://www.educationnext.org/feed/",
    trustNote: "Education policy journal",
  },
  {
    topicKey: "education",
    name: "The 74",
    url: "https://www.the74million.org/feed/",
    trustNote: "Education newsroom",
  },
  {
    topicKey: "korea-real-estate",
    name: "한국경제 | 부동산",
    url: "https://www.hankyung.com/feed/realestate",
    trustNote: "Major media (KR)",
  },
  {
    topicKey: "korea-real-estate",
    name: "매일경제 | 부동산",
    url: "https://www.mk.co.kr/rss/50300009/",
    trustNote: "Major media (KR)",
  },
  {
    topicKey: "korea-real-estate",
    name: "대한민국 정책브리핑 | 보도자료",
    url: "https://www.korea.kr/rss/pressrelease.xml",
    trustNote: "Official (KR gov)",
  },
  {
    topicKey: "stocks",
    name: "한국경제 | 금융·증권",
    url: "https://www.hankyung.com/feed/finance",
    trustNote: "Major media (KR)",
  },
  {
    topicKey: "stocks",
    name: "매일경제 | 증권",
    url: "https://www.mk.co.kr/rss/50200011/",
    trustNote: "Major media (KR)",
  },
  {
    topicKey: "stocks",
    name: "연합뉴스TV | 경제",
    url: "http://www.yonhapnewstv.co.kr/category/news/economy/feed/",
    trustNote: "Major media (KR)",
  },
  {
    topicKey: "bitcoin",
    name: "CoinDesk",
    url: "https://www.coindesk.com/arc/outboundfeeds/rss/",
    trustNote: "Major media",
  },
  {
    topicKey: "bitcoin",
    name: "Cointelegraph",
    url: "https://cointelegraph.com/rss",
    trustNote: "Major media",
  },
  {
    topicKey: "bitcoin",
    name: "Decrypt",
    url: "https://decrypt.co/feed",
    trustNote: "Crypto newsroom",
  },
  {
    topicKey: "politics",
    name: "한국경제 | 정치",
    url: "https://www.hankyung.com/feed/politics",
    trustNote: "Major media (KR)",
  },
  {
    topicKey: "politics",
    name: "연합뉴스TV | 정치",
    url: "http://www.yonhapnewstv.co.kr/category/news/politics/feed/",
    trustNote: "Major media (KR)",
  },
  {
    topicKey: "politics",
    name: "대한민국 정책브리핑 | 정책",
    url: "https://www.korea.kr/rss/policy.xml",
    trustNote: "Official (KR gov)",
  },
];
const KOREA_INDICATOR_KEYWORDS = [
  "대한민국",
  "한국",
  "국내",
  "서울",
  "경기",
  "인천",
  "부산",
  "대구",
  "광주",
  "대전",
  "울산",
  "세종",
  "제주",
];
const TOPIC_RELEVANCE_PROFILES: Record<Exclude<CanonicalTopicKey, "other">, TopicRelevanceProfile> = {
  ai: {
    aliases: ["인공지능", "ai", "a.i", "llm", "머신러닝", "딥러닝", "생성형", "artificial intelligence"],
    highSignalKeywords: [
      "인공지능",
      "ai",
      "llm",
      "gpt",
      "chatgpt",
      "openai",
      "anthropic",
      "deepmind",
      "생성형",
      "머신러닝",
      "딥러닝",
      "foundation model",
      "large language model",
      "멀티모달",
      "추론 모델",
      "에이전트",
      "agentic",
      "gpu",
      "tpu",
      "npu",
    ],
    normalKeywords: [
      "model",
      "모델",
      "fine-tuning",
      "rag",
      "vector",
      "prompt",
      "alignment",
      "inference",
      "training",
      "ai safety",
    ],
    negativeKeywords: ["광고", "프로모션", "협찬"],
  },
  education: {
    aliases: ["교육", "edtech", "school", "student", "education"],
    highSignalKeywords: [
      "교육",
      "교사",
      "학생",
      "학교",
      "대학",
      "수능",
      "입시",
      "교육부",
      "교과",
      "edtech",
      "curriculum",
      "tuition",
      "scholarship",
    ],
    normalKeywords: [
      "학습",
      "학부모",
      "유아교육",
      "초등",
      "중등",
      "고등",
      "평생교육",
      "온라인 강의",
    ],
    negativeKeywords: ["광고", "홍보", "연예"],
  },
  "korea-real-estate": {
    aliases: [
      "대한민국 부동산",
      "한국 부동산",
      "국내 부동산",
      "부동산",
      "real estate",
      "korea real estate",
      "kr real estate",
    ],
    highSignalKeywords: [
      "부동산",
      "아파트",
      "주택",
      "분양",
      "청약",
      "전세",
      "월세",
      "매매",
      "재건축",
      "재개발",
      "pf",
      "국토교통부",
      "국토부",
      "lh",
      "공시지가",
      "보금자리론",
      "dti",
      "dsr",
      "ltv",
    ],
    normalKeywords: [
      "임대",
      "오피스텔",
      "주담대",
      "미분양",
      "입주",
      "용적률",
      "gtx",
      "토지거래허가",
      "housing",
      "property market",
    ],
    negativeKeywords: ["해외 부동산", "미국 주택", "중국 부동산", "commercial real estate only"],
  },
  stocks: {
    aliases: ["주식", "증권", "stock", "stocks", "equity", "equities", "국내주식", "해외주식"],
    highSignalKeywords: [
      "주식",
      "증시",
      "코스피",
      "코스닥",
      "코스피200",
      "나스닥",
      "s&p",
      "dow",
      "stock",
      "equity",
      "earnings",
      "실적",
      "ipo",
      "공모주",
      "배당",
      "per",
      "pbr",
      "eps",
      "매수",
      "매도",
    ],
    normalKeywords: [
      "리서치",
      "target price",
      "투자의견",
      "밸류에이션",
      "fund flow",
      "etf",
      "시장 마감",
    ],
    negativeKeywords: ["암호화폐", "비트코인", "연예", "스포츠"],
  },
  bitcoin: {
    aliases: ["비트코인", "bitcoin", "btc", "암호화폐", "코인", "crypto", "cryptocurrency"],
    highSignalKeywords: [
      "비트코인",
      "bitcoin",
      "btc",
      "암호화폐",
      "crypto",
      "블록체인",
      "stablecoin",
      "스테이블코인",
      "ethereum",
      "eth",
      "on-chain",
      "hashrate",
      "채굴",
      "digital asset",
      "token",
      "defi",
      "etf",
      "sec",
    ],
    normalKeywords: ["거래소", "wallet", "custody", "web3", "layer 2", "지갑", "토큰화"],
    negativeKeywords: ["주택", "아파트", "야구", "연예"],
  },
  politics: {
    aliases: ["정치", "정부", "국회", "policy", "policies", "election", "politics"],
    highSignalKeywords: [
      "정치",
      "정부",
      "국회",
      "대통령",
      "총리",
      "장관",
      "여당",
      "야당",
      "선거",
      "공약",
      "외교",
      "안보",
      "법안",
      "정책",
      "ministr",
      "parliament",
      "cabinet",
    ],
    normalKeywords: ["행정", "규제", "국정", "청문회", "공청회", "정무위", "위원회"],
    negativeKeywords: ["스포츠", "연예", "광고"],
  },
};
const TRACKING_QUERY_KEYS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
  "gclid",
  "fbclid",
  "igshid",
  "mc_cid",
  "mc_eid",
  "mkt_tok",
  "ref",
  "ref_src",
  "s",
  "spm",
]);
const OLLAMA_MODEL_RECOMMENDATION_PATTERNS = [
  /qwen2\.5/i,
  /qwen3/i,
  /llama3(\.1)?/i,
  /exaone/i,
  /gemma/i,
  /mistral/i,
  /phi/i,
];
const SITE_SPECIFIC_DESCRIPTION_RULES: Array<{ hosts: RegExp[]; selectors: string[] }> = [
  {
    hosts: [/(^|\.)hankyung\.com$/i],
    selectors: [
      'meta[property="og:description"]',
      'meta[name="description"]',
      ".article-body p",
      ".article_txt p",
      "article p",
    ],
  },
  {
    hosts: [/(^|\.)donga\.com$/i],
    selectors: [
      'meta[property="og:description"]',
      'meta[name="description"]',
      "#article_txt p",
      ".article_txt p",
      "article p",
    ],
  },
  {
    hosts: [/(^|\.)yonhapnewstv\.co\.kr$/i],
    selectors: [
      'meta[property="og:description"]',
      'meta[name="description"]',
      ".article_txt p",
      ".news-article p",
      "article p",
    ],
  },
  {
    hosts: [/(^|\.)coindesk\.com$/i, /(^|\.)cointelegraph\.com$/i],
    selectors: [
      'meta[property="og:description"]',
      'meta[name="description"]',
      "article p",
      "main p",
    ],
  },
];

function createFeedId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildDeterministicFeedId(url: string): string {
  let hash = 5381;
  for (let i = 0; i < url.length; i += 1) {
    hash = ((hash << 5) + hash) ^ url.charCodeAt(i);
  }
  const unsigned = hash >>> 0;
  return `rssd-${unsigned.toString(36)}`;
}

function normalizeTopic(raw: string): string {
  const cleaned = raw.trim();
  if (!cleaned) {
    return "Uncategorized";
  }
  return cleaned;
}

function normalizeKeywordHaystack(raw: string): string {
  return raw.toLowerCase();
}

function parseKeywordList(raw: string): string[] {
  const out = new Set<string>();
  for (const token of raw.split(/[\n,]/)) {
    const trimmed = token.trim().toLowerCase();
    if (trimmed) {
      out.add(trimmed);
    }
  }
  return Array.from(out.values());
}

function matchesKeywordFilter(
  haystack: string,
  includeKeywords: string[],
  excludeKeywords: string[],
): boolean {
  if (excludeKeywords.some((keyword) => haystack.includes(keyword))) {
    return false;
  }
  if (includeKeywords.length === 0) {
    return true;
  }
  return includeKeywords.some((keyword) => haystack.includes(keyword));
}

function isPrioritizedTopicKey(
  topicKey: CanonicalTopicKey,
): topicKey is Exclude<CanonicalTopicKey, "other"> {
  return topicKey !== "other";
}

function countKeywordHits(haystack: string, keywords: string[]): number {
  let hits = 0;
  for (const keyword of keywords) {
    if (keyword && matchesRelevanceKeyword(haystack, keyword)) {
      hits += 1;
    }
  }
  return hits;
}

function escapeRegexPattern(raw: string): string {
  return raw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchesRelevanceKeyword(haystack: string, keyword: string): boolean {
  const normalizedKeyword = keyword.trim().toLowerCase();
  if (!normalizedKeyword) {
    return false;
  }

  if (/[가-힣]/.test(normalizedKeyword)) {
    return haystack.includes(normalizedKeyword);
  }

  if (/^[a-z0-9]+$/.test(normalizedKeyword)) {
    const pattern = new RegExp(
      `(^|[^a-z0-9])${escapeRegexPattern(normalizedKeyword)}([^a-z0-9]|$)`,
      "i",
    );
    return pattern.test(haystack);
  }

  return haystack.includes(normalizedKeyword);
}

function resolveCanonicalTopicKey(rawTopic: string): CanonicalTopicKey {
  const normalizedTopic = normalizeKeywordHaystack(rawTopic.trim());
  if (!normalizedTopic) {
    return "other";
  }

  const entries = Object.entries(TOPIC_RELEVANCE_PROFILES) as Array<
    [Exclude<CanonicalTopicKey, "other">, TopicRelevanceProfile]
  >;
  for (const [topicKey, profile] of entries) {
    if (profile.aliases.some((alias) => normalizedTopic.includes(alias))) {
      return topicKey;
    }
  }

  let bestTopic: CanonicalTopicKey = "other";
  let bestScore = 0;
  for (const [topicKey, profile] of entries) {
    const keywordPool = [...profile.aliases, ...profile.highSignalKeywords];
    const score = keywordPool.reduce((acc, keyword) => (
      keyword && normalizedTopic.includes(keyword) ? acc + 1 : acc
    ), 0);
    if (score > bestScore) {
      bestScore = score;
      bestTopic = topicKey;
    }
  }
  if (bestScore > 0) {
    return bestTopic;
  }

  return "other";
}

function splitTopicPriorityTokens(raw: string): string[] {
  return raw
    .split(/[\n,>|;/]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}

function parseTopicPriorityOrderWithDiagnostics(raw: string): ParsedTopicPriorityOrder {
  const source = raw.trim() || DEFAULT_SETTINGS.topicPriorityOrder;
  const out: Exclude<CanonicalTopicKey, "other">[] = [];
  const seen = new Set<Exclude<CanonicalTopicKey, "other">>();
  const unknownTokens: string[] = [];

  for (const token of splitTopicPriorityTokens(source)) {
    const topicKey = resolveCanonicalTopicKey(token);
    if (!isPrioritizedTopicKey(topicKey)) {
      unknownTokens.push(token);
      continue;
    }
    if (seen.has(topicKey)) {
      continue;
    }
    seen.add(topicKey);
    out.push(topicKey);
  }

  return {
    ordered: out.length > 0 ? out : [...DEFAULT_TOPIC_PRIORITY_KEYS],
    unknownTokens,
  };
}

function parseTopicPriorityOrder(raw: string): Exclude<CanonicalTopicKey, "other">[] {
  return parseTopicPriorityOrderWithDiagnostics(raw).ordered;
}

function buildTopicRelevanceHaystack(feed: FeedSource, item: ParsedFeedItem): string {
  return normalizeKeywordHaystack(
    `${item.title}\n${item.description}\n${item.link}\n${feed.name}\n${feed.topic}`,
  );
}

function buildPreferenceFeatureText(feed: FeedSource, item: ParsedFeedItem): string {
  const host = getHostnameFromUrl(item.link);
  return normalizePlainText(
    `${feed.topic}\n${feed.name}\n${item.title}\n${item.description}\n${host}`,
  );
}

function tokenizePreferenceText(raw: string): string[] {
  const normalized = normalizeKeywordHaystack(normalizePlainText(raw))
    .replace(/https?:\/\/\S+/g, " ");

  const tokens = normalized
    .split(/[^\p{L}\p{N}]+/u)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && token.length <= 40)
    .filter((token) => !/^\d+$/.test(token))
    .filter((token) => !PREFERENCE_STOPWORDS.has(token));

  return Array.from(new Set(tokens));
}

function scoreTopicRelevance(topicKey: CanonicalTopicKey, haystack: string): number {
  if (!isPrioritizedTopicKey(topicKey)) {
    return 0;
  }

  const profile = TOPIC_RELEVANCE_PROFILES[topicKey];
  const highHits = Math.min(
    MAX_KEYWORD_MATCHES_PER_BUCKET,
    countKeywordHits(haystack, profile.highSignalKeywords),
  );
  const normalHits = Math.min(
    MAX_KEYWORD_MATCHES_PER_BUCKET,
    countKeywordHits(haystack, profile.normalKeywords),
  );
  const negativeHits = Math.min(
    MAX_KEYWORD_MATCHES_PER_BUCKET,
    countKeywordHits(haystack, profile.negativeKeywords),
  );

  let score = (highHits * 2) + normalHits - (negativeHits * 2);

  if (topicKey === "korea-real-estate") {
    const koreaHits = Math.min(
      MAX_KEYWORD_MATCHES_PER_BUCKET,
      countKeywordHits(haystack, KOREA_INDICATOR_KEYWORDS),
    );
    const realEstateHits = highHits + normalHits;
    if (realEstateHits > 0 && koreaHits > 0) {
      score += 2;
    } else if (realEstateHits > 0 && koreaHits === 0) {
      score -= 1;
    } else if (realEstateHits === 0 && koreaHits > 0) {
      score -= 2;
    }
  }

  return score;
}

function buildTopicScoreMap(haystack: string): Map<Exclude<CanonicalTopicKey, "other">, number> {
  const out = new Map<Exclude<CanonicalTopicKey, "other">, number>();
  for (const topicKey of DEFAULT_TOPIC_PRIORITY_KEYS) {
    out.set(topicKey, scoreTopicRelevance(topicKey, haystack));
  }
  return out;
}

function inferPrimaryTopicFromHaystack(
  haystack: string,
): { key: Exclude<CanonicalTopicKey, "other">; score: number; scores: Map<Exclude<CanonicalTopicKey, "other">, number> } {
  const scores = buildTopicScoreMap(haystack);
  let bestKey: Exclude<CanonicalTopicKey, "other"> = DEFAULT_TOPIC_PRIORITY_KEYS[0];
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const [topicKey, score] of scores.entries()) {
    if (score > bestScore) {
      bestKey = topicKey;
      bestScore = score;
    }
  }

  return { key: bestKey, score: bestScore, scores };
}

function getTopicPriorityBoost(
  topicKey: CanonicalTopicKey,
  orderedKeys: Exclude<CanonicalTopicKey, "other">[],
  maxBoost: number,
): number {
  if (!isPrioritizedTopicKey(topicKey) || maxBoost <= 0) {
    return 0;
  }

  const index = orderedKeys.indexOf(topicKey);
  if (index < 0) {
    return 0;
  }

  if (orderedKeys.length <= 1) {
    return maxBoost;
  }

  const step = maxBoost / (orderedKeys.length - 1);
  return Math.max(0, Math.round((maxBoost - (index * step)) * 100) / 100);
}

function formatTopicPriorityPreview(
  orderedKeys: Exclude<CanonicalTopicKey, "other">[],
  lang: UiLanguage,
): string {
  return orderedKeys.map((key) => getTopicLabel(key, lang)).join(" > ");
}

function formatTopicPriorityDiagnostic(raw: string, lang: UiLanguage): string {
  const parsed = parseTopicPriorityOrderWithDiagnostics(raw);
  const applied = formatTopicPriorityPreview(parsed.ordered, lang);

  if (parsed.unknownTokens.length === 0) {
    return lang === "ko"
      ? `적용 순서: ${applied}`
      : `Applied order: ${applied}`;
  }

  const unknown = parsed.unknownTokens.join(", ");
  return lang === "ko"
    ? `적용 순서: ${applied} / 인식 불가: ${unknown}`
    : `Applied order: ${applied} / Unrecognized: ${unknown}`;
}

function getTopicLabel(topicKey: Exclude<CanonicalTopicKey, "other">, lang: UiLanguage): string {
  const labelsKo: Record<Exclude<CanonicalTopicKey, "other">, string> = {
    ai: "인공지능",
    education: "교육",
    "korea-real-estate": "대한민국 부동산",
    stocks: "주식",
    bitcoin: "비트코인",
    politics: "정치",
  };
  const labelsEn: Record<Exclude<CanonicalTopicKey, "other">, string> = {
    ai: "AI",
    education: "Education",
    "korea-real-estate": "Korea Real Estate",
    stocks: "Stocks",
    bitcoin: "Bitcoin",
    politics: "Politics",
  };
  return (lang === "ko" ? labelsKo : labelsEn)[topicKey];
}

function formatTopicFeedCoverageDiagnostic(feeds: FeedSource[], lang: UiLanguage): string {
  const counts = new Map<Exclude<CanonicalTopicKey, "other">, number>();
  for (const key of DEFAULT_TOPIC_PRIORITY_KEYS) {
    counts.set(key, 0);
  }

  for (const feed of feeds) {
    if (!feed.enabled || !feed.url.trim()) {
      continue;
    }
    const key = resolveCanonicalTopicKey(feed.topic);
    if (!isPrioritizedTopicKey(key)) {
      continue;
    }
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const parts = DEFAULT_TOPIC_PRIORITY_KEYS.map((key) => {
    const count = counts.get(key) ?? 0;
    const label = getTopicLabel(key, lang);
    let mark: string;
    if (count < RECOMMENDED_MIN_FEEDS_PER_TOPIC) {
      mark = lang === "ko" ? "부족" : "Low";
    } else if (count > RECOMMENDED_MAX_FEEDS_PER_TOPIC) {
      mark = lang === "ko" ? "초과" : "High";
    } else {
      mark = lang === "ko" ? "적정" : "OK";
    }
    return `${label} ${count} (${mark})`;
  });

  const targetLabel = lang === "ko"
    ? `${RECOMMENDED_MIN_FEEDS_PER_TOPIC}~${RECOMMENDED_MAX_FEEDS_PER_TOPIC}개 권장`
    : `Recommended ${RECOMMENDED_MIN_FEEDS_PER_TOPIC}-${RECOMMENDED_MAX_FEEDS_PER_TOPIC}`;
  return `${targetLabel}: ${parts.join(" | ")}`;
}

function normalizeFeedUrlForCompare(raw: string): string {
  return raw.trim().toLowerCase().replace(/\/+$/, "");
}

function buildGoogleNewsSearchFeedUrl(query: string): string {
  return `${GOOGLE_NEWS_RSS_BASE_URL}?q=${encodeURIComponent(query)}&hl=ko&gl=KR&ceid=KR:ko`;
}

function buildPriorityOrderFromFeedTopics(feeds: FeedSource[], lang: UiLanguage): string {
  const seen = new Set<Exclude<CanonicalTopicKey, "other">>();
  const ordered: Exclude<CanonicalTopicKey, "other">[] = [];

  for (const feed of feeds) {
    const normalizedTopic = normalizeTopic(feed.topic || "");
    if (!feed.enabled || !feed.url.trim() || !normalizedTopic) {
      continue;
    }
    const key = resolveCanonicalTopicKey(normalizedTopic);
    if (!isPrioritizedTopicKey(key) || seen.has(key)) {
      continue;
    }
    seen.add(key);
    ordered.push(key);
  }

  for (const key of DEFAULT_TOPIC_PRIORITY_KEYS) {
    if (!seen.has(key)) {
      ordered.push(key);
    }
  }

  return ordered.map((key) => getTopicLabel(key, lang)).join(", ");
}

function formatPriorityFeedAlignmentDiagnostic(
  rawPriority: string,
  feeds: FeedSource[],
  lang: UiLanguage,
): string {
  const parsed = parseTopicPriorityOrderWithDiagnostics(rawPriority);
  const counts = new Map<Exclude<CanonicalTopicKey, "other">, number>();
  const unknownFeedTopics = new Set<string>();
  for (const key of DEFAULT_TOPIC_PRIORITY_KEYS) {
    counts.set(key, 0);
  }

  for (const feed of feeds) {
    if (!feed.enabled || !feed.url.trim()) {
      continue;
    }
    const topicText = normalizeTopic(feed.topic || "");
    if (!topicText) {
      continue;
    }
    const key = resolveCanonicalTopicKey(topicText);
    if (isPrioritizedTopicKey(key)) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    } else {
      unknownFeedTopics.add(topicText);
    }
  }

  const coverageParts = parsed.ordered.map((key) => `${getTopicLabel(key, lang)} ${counts.get(key) ?? 0}`);
  const missingFromFeeds = parsed.ordered
    .filter((key) => (counts.get(key) ?? 0) === 0)
    .map((key) => getTopicLabel(key, lang));
  const missingFromPriority = DEFAULT_TOPIC_PRIORITY_KEYS
    .filter((key) => (counts.get(key) ?? 0) > 0 && !parsed.ordered.includes(key))
    .map((key) => getTopicLabel(key, lang));

  const pieces: string[] = [];
  pieces.push(
    lang === "ko"
      ? `활성 피드 반영: ${coverageParts.join(" | ")}`
      : `Enabled feed alignment: ${coverageParts.join(" | ")}`,
  );

  if (missingFromFeeds.length > 0) {
    pieces.push(
      lang === "ko"
        ? `피드 없음: ${missingFromFeeds.join(", ")}`
        : `No feed yet: ${missingFromFeeds.join(", ")}`,
    );
  }
  if (missingFromPriority.length > 0) {
    pieces.push(
      lang === "ko"
        ? `우선순위에 미포함: ${missingFromPriority.join(", ")}`
        : `Not in priority: ${missingFromPriority.join(", ")}`,
    );
  }
  if (unknownFeedTopics.size > 0) {
    pieces.push(
      lang === "ko"
        ? `인식 불가 피드 토픽: ${Array.from(unknownFeedTopics).join(", ")}`
        : `Unrecognized feed topics: ${Array.from(unknownFeedTopics).join(", ")}`,
    );
  }
  return pieces.join(" / ");
}

function formatRecommendedFeedCoverageDiagnostic(
  feeds: FeedSource[],
  priorityOrderRaw: string,
  lang: UiLanguage,
): string {
  const parsedOrder = parseTopicPriorityOrder(priorityOrderRaw);
  const ordered = parsedOrder.length > 0 ? parsedOrder : [...DEFAULT_TOPIC_PRIORITY_KEYS];
  const existingUrlSet = new Set(
    feeds.map((feed) => normalizeFeedUrlForCompare(feed.url)).filter((url) => url.length > 0),
  );

  const parts = ordered.map((topicKey) => {
    const totalCandidates = RECOMMENDED_FEED_TEMPLATES.filter((feed) => feed.topicKey === topicKey).length;
    const alreadyAdded = RECOMMENDED_FEED_TEMPLATES.filter(
      (feed) => feed.topicKey === topicKey && existingUrlSet.has(normalizeFeedUrlForCompare(feed.url)),
    ).length;
    return `${getTopicLabel(topicKey, lang)} ${alreadyAdded}/${totalCandidates}`;
  });

  return lang === "ko"
    ? `추천 피드 적용 현황: ${parts.join(" | ")}`
    : `Recommended feed coverage: ${parts.join(" | ")}`;
}

function containsHangul(raw: string): boolean {
  return /[가-힣]/.test(raw);
}

function hasAnyLetters(raw: string): boolean {
  return /\p{L}/u.test(raw);
}

function normalizeHttpBaseUrl(raw: string): string {
  return raw.trim().replace(/\/+$/, "");
}

function truncateForModelInput(raw: string): string {
  if (raw.length <= MAX_TRANSLATION_INPUT_LENGTH) {
    return raw;
  }
  return `${raw.slice(0, MAX_TRANSLATION_INPUT_LENGTH).trimEnd()}...`;
}

function formatYmd(date: Date | null): string {
  if (!date) {
    return "";
  }
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function normalizeTitleForDedupe(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .trim();
}

function canonicalizeLinkForDedupe(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    return "";
  }

  try {
    const parsed = new URL(trimmed);
    parsed.hash = "";

    const keepPairs: Array<[string, string]> = [];
    for (const [key, value] of parsed.searchParams.entries()) {
      if (!TRACKING_QUERY_KEYS.has(key.toLowerCase())) {
        keepPairs.push([key, value]);
      }
    }

    parsed.search = "";
    for (const [key, value] of keepPairs) {
      parsed.searchParams.append(key, value);
    }

    return parsed.toString();
  } catch {
    return trimmed.split("#")[0];
  }
}

function looksLikeLowSignalTitle(raw: string): boolean {
  const normalized = raw.toLowerCase();
  return /(광고|협찬|이벤트|promo|promoted|sponsored|advertisement|newsletter)/i.test(normalized);
}

function looksLikeArticleLink(raw: string): boolean {
  const link = raw.trim();
  if (!link) {
    return false;
  }

  try {
    const parsed = new URL(link);
    const pathname = parsed.pathname.toLowerCase();
    if (/(\/news\/|\/article\/|\/story\/)/.test(pathname)) {
      return true;
    }
    if (/\d{4}\/\d{2}\/\d{2}/.test(pathname)) {
      return true;
    }
    if (/\d{6,}/.test(pathname)) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

function scoreWindowItemQuality(item: ParsedFeedItem, windowEnd: Date): number {
  let score = 0;

  if (item.published) {
    const ageMinutes = Math.max(0, (windowEnd.getTime() - item.published.getTime()) / 60000);
    score += Math.max(0, 8 - ageMinutes / 90);
  }

  const title = normalizePlainText(item.title);
  const titleLength = title.length;
  if (titleLength >= 18 && titleLength <= 120) {
    score += 2;
  } else if (titleLength >= 8) {
    score += 1;
  }

  const descriptionLength = normalizePlainText(item.description).length;
  if (descriptionLength >= 320) {
    score += 8;
  } else if (descriptionLength >= 180) {
    score += 6;
  } else if (descriptionLength >= 100) {
    score += 4;
  } else if (descriptionLength >= 50) {
    score += 2;
  } else if (descriptionLength > 0) {
    score += 1;
  }

  const link = item.link.trim();
  if (link.startsWith("https://")) {
    score += 1;
  }
  if (looksLikeArticleLink(link)) {
    score += 2;
  }
  if (looksLikeLowSignalTitle(title)) {
    score -= 4;
  }

  return score;
}

function getRowTopic(row: WindowItem): string {
  return row.feed.topic.trim() || "Uncategorized";
}

function selectRowsWithTopicDiversity(
  rankedRows: ScoredWindowRow[],
  limit: number,
  minPerTopic: number,
  maxPerTopic: number,
  penaltyPerSelected: number,
): WindowItem[] {
  if (limit <= 0 || rankedRows.length === 0) {
    return [];
  }

  const perTopic = new Map<string, ScoredWindowRow[]>();
  for (const entry of rankedRows) {
    const topic = getRowTopic(entry.row);
    if (!perTopic.has(topic)) {
      perTopic.set(topic, []);
    }
    perTopic.get(topic)?.push(entry);
  }

  const selected: WindowItem[] = [];
  const selectedByTopic = new Map<string, number>();
  const effectiveMaxPerTopic = Math.max(1, maxPerTopic);
  const effectiveMinPerTopic = Math.max(0, Math.min(minPerTopic, effectiveMaxPerTopic));

  const sortedTopicsByTopScore = (): string[] =>
    Array.from(perTopic.entries())
      .filter(([, queue]) => queue.length > 0)
      .sort((a, b) => {
        const aTop = a[1][0]?.totalScore ?? Number.NEGATIVE_INFINITY;
        const bTop = b[1][0]?.totalScore ?? Number.NEGATIVE_INFINITY;
        if (aTop !== bTop) {
          return bTop - aTop;
        }
        const aQuality = a[1][0]?.qualityScore ?? Number.NEGATIVE_INFINITY;
        const bQuality = b[1][0]?.qualityScore ?? Number.NEGATIVE_INFINITY;
        if (aQuality !== bQuality) {
          return bQuality - aQuality;
        }
        return a[0].localeCompare(b[0]);
      })
      .map(([topic]) => topic);

  const takeTopFromTopic = (topic: string): boolean => {
    const queue = perTopic.get(topic);
    if (!queue || queue.length === 0) {
      return false;
    }
    if ((selectedByTopic.get(topic) ?? 0) >= effectiveMaxPerTopic) {
      return false;
    }
    const entry = queue.shift();
    if (!entry) {
      return false;
    }
    selected.push(entry.row);
    selectedByTopic.set(topic, (selectedByTopic.get(topic) ?? 0) + 1);
    return true;
  };

  for (let pass = 0; pass < effectiveMinPerTopic; pass += 1) {
    const topicsInPass = sortedTopicsByTopScore();
    if (topicsInPass.length === 0) {
      break;
    }
    for (const topic of topicsInPass) {
      if (!takeTopFromTopic(topic)) {
        continue;
      }
      if (selected.length >= limit) {
        return selected;
      }
    }
  }

  while (selected.length < limit) {
    let bestTopic = "";
    let bestAdjustedScore = Number.NEGATIVE_INFINITY;
    let bestRawScore = Number.NEGATIVE_INFINITY;
    let bestRawQuality = Number.NEGATIVE_INFINITY;

    for (const [topic, queue] of perTopic.entries()) {
      if (queue.length === 0) {
        continue;
      }
      const selectedCount = selectedByTopic.get(topic) ?? 0;
      if (selectedCount >= effectiveMaxPerTopic) {
        continue;
      }
      const rawScore = queue[0]?.totalScore ?? Number.NEGATIVE_INFINITY;
      const rawQuality = queue[0]?.qualityScore ?? Number.NEGATIVE_INFINITY;
      const adjustedScore = rawScore - (selectedCount * penaltyPerSelected);
      if (
        adjustedScore > bestAdjustedScore
        || (adjustedScore === bestAdjustedScore && rawScore > bestRawScore)
        || (adjustedScore === bestAdjustedScore && rawScore === bestRawScore && rawQuality > bestRawQuality)
        || (
          adjustedScore === bestAdjustedScore
          && rawScore === bestRawScore
          && rawQuality === bestRawQuality
          && topic < bestTopic
        )
      ) {
        bestTopic = topic;
        bestAdjustedScore = adjustedScore;
        bestRawScore = rawScore;
        bestRawQuality = rawQuality;
      }
    }

    if (!bestTopic) {
      break;
    }

    if (!takeTopFromTopic(bestTopic)) {
      break;
    }
  }

  return selected;
}
function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function parseScheduleToken(token: string): number | null {
  const trimmed = token.trim();
  const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(trimmed);
  if (!match) {
    return null;
  }
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour * 60 + minute;
}

function parseScheduleMinutes(raw: string): number[] {
  const out = new Set<number>();
  for (const token of raw.split(",")) {
    const parsed = parseScheduleToken(token);
    if (parsed !== null) {
      out.add(parsed);
    }
  }
  return Array.from(out.values()).sort((a, b) => a - b);
}

function minutesToToken(minutes: number): string {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${pad2(hour)}:${pad2(minute)}`;
}

function dateAtMinutes(baseDate: Date, minutes: number): Date {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return new Date(
    baseDate.getFullYear(),
    baseDate.getMonth(),
    baseDate.getDate(),
    hour,
    minute,
    0,
    0,
  );
}

function formatLocalDateTime(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function formatFileStamp(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}-${pad2(date.getHours())}${pad2(date.getMinutes())}`;
}

function parseDateMaybe(raw: string): Date | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  const ms = Date.parse(trimmed);
  if (!Number.isFinite(ms)) {
    return null;
  }
  return new Date(ms);
}

function sanitizeFilePart(raw: string): string {
  const replaced = raw
    .trim()
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
  return replaced || "rss-capture";
}

function normalizePlainText(raw: string): string {
  if (!raw) {
    return "";
  }
  return raw.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim();
}

function stripHtml(raw: string): string {
  if (!raw) {
    return "";
  }
  const parser = new DOMParser();
  const doc = parser.parseFromString(raw, "text/html");
  const text = doc.body?.textContent ?? doc.documentElement?.textContent ?? "";
  return normalizePlainText(text);
}

function getHostnameFromUrl(raw: string): string {
  try {
    return new URL(raw).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function readDescriptionBySelectors(doc: Document, selectors: string[]): string {
  for (const selector of selectors) {
    const elements = Array.from(doc.querySelectorAll(selector));
    for (const element of elements) {
      const value = normalizePlainText(
        (element.getAttribute("content") || element.textContent || "").trim(),
      );
      if (value.length >= 20) {
        return value;
      }
    }
  }

  return "";
}

function readSiteSpecificDescription(url: string, doc: Document): string {
  const host = getHostnameFromUrl(url);
  if (!host) {
    return "";
  }

  for (const rule of SITE_SPECIFIC_DESCRIPTION_RULES) {
    if (!rule.hosts.some((pattern) => pattern.test(host))) {
      continue;
    }

    const extracted = readDescriptionBySelectors(doc, rule.selectors);
    if (extracted) {
      return extracted;
    }
  }

  return "";
}

function readMetaDescription(doc: Document): string {
  const selectors = [
    'meta[property="og:description"]',
    'meta[name="twitter:description"]',
    'meta[name="description"]',
  ];

  for (const selector of selectors) {
    const element = doc.querySelector(selector);
    const content = (element?.getAttribute("content") || "").trim();
    if (content) {
      return normalizePlainText(content);
    }
  }

  return "";
}

function collectJsonLdTextCandidates(node: unknown, out: string[]): void {
  if (node === null || node === undefined) {
    return;
  }

  if (typeof node === "string") {
    const normalized = normalizePlainText(node);
    if (normalized.length >= 20) {
      out.push(normalized);
    }
    return;
  }

  if (Array.isArray(node)) {
    for (const item of node) {
      collectJsonLdTextCandidates(item, out);
    }
    return;
  }

  if (typeof node !== "object") {
    return;
  }

  const obj = node as Record<string, unknown>;
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    if (
      lowerKey === "description"
      || lowerKey === "articlebody"
      || lowerKey === "headline"
      || lowerKey === "abstract"
      || lowerKey === "summary"
    ) {
      collectJsonLdTextCandidates(value, out);
      continue;
    }

    if (typeof value === "object" || Array.isArray(value)) {
      collectJsonLdTextCandidates(value, out);
    }
  }
}

function readJsonLdDescription(doc: Document): string {
  const scripts = Array.from(
    doc.querySelectorAll('script[type="application/ld+json"]'),
  );
  const candidates: string[] = [];

  for (const script of scripts) {
    const raw = (script.textContent || "").trim();
    if (!raw) {
      continue;
    }

    try {
      const parsed = JSON.parse(raw) as unknown;
      collectJsonLdTextCandidates(parsed, candidates);
    } catch {
      continue;
    }
  }

  const filtered = candidates
    .map((text) => normalizePlainText(text))
    .filter((text) => text.length >= 40);

  if (filtered.length === 0) {
    return "";
  }

  filtered.sort((a, b) => b.length - a.length);
  return filtered[0];
}

function readBestParagraph(doc: Document): string {
  const selectorPriority = [
    ".article-body p",
    ".article_txt p",
    "#article_txt p",
    "article p",
    "main p",
    "p",
  ];

  for (const selector of selectorPriority) {
    const paragraphs = Array.from(doc.querySelectorAll(selector))
      .map((element) => normalizePlainText(element.textContent || ""))
      .filter((text) => text.length >= 40);

    if (paragraphs.length === 0) {
      continue;
    }

    return paragraphs.slice(0, 2).join("\n\n");
  }

  return "";
}

function truncateText(raw: string, maxLength: number): string {
  if (raw.length <= maxLength) {
    return raw;
  }
  return `${raw.slice(0, maxLength).trimEnd()}...`;
}

function escapeYamlString(raw: string): string {
  return raw.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function readChildText(parent: Element, tagNames: string[]): string {
  for (const tag of tagNames) {
    const lowerTag = tag.toLowerCase();
    for (const child of Array.from(parent.children)) {
      if (child.tagName.toLowerCase() === lowerTag) {
        return normalizePlainText(child.textContent ?? "");
      }
    }
  }
  return "";
}

function readAtomLink(entry: Element): string {
  const links = Array.from(entry.getElementsByTagName("link"));
  if (links.length === 0) {
    return "";
  }

  for (const linkEl of links) {
    const rel = (linkEl.getAttribute("rel") || "").trim().toLowerCase();
    const href = (linkEl.getAttribute("href") || "").trim();
    if (href && (!rel || rel === "alternate")) {
      return href;
    }
  }

  return (links[0].getAttribute("href") || "").trim();
}

function toItemKey(feed: FeedSource, item: ParsedFeedItem): string {
  const base = item.id || item.link || `${item.title}::${item.publishedRaw}`;
  return `${feed.url}::${base}`;
}

export default class RssWindowCapturePlugin extends Plugin {
  settings!: RssWindowCaptureSettings;
  private runInProgress = false;
  private translationCache = new Map<string, string>();

  async onload(): Promise<void> {
    await this.loadSettings();

    this.addSettingTab(new RssWindowCaptureSettingTab(this.app, this));

    this.addCommand({
      id: "run-due-rss-insight",
      name: "Run due RSS window captures now",
      callback: () => {
        void this.runDueWindows("manual");
      },
    });

    this.addCommand({
      id: "capture-latest-completed-rss-window",
      name: "Capture latest completed RSS window now",
      callback: () => {
        void this.captureLatestCompletedWindow();
      },
    });

    this.addCommand({
      id: "sync-feeds-from-rss-dashboard",
      name: "Sync feeds from RSS Dashboard now",
      callback: () => {
        void this.syncFeedsFromRssDashboard(true, true);
      },
    });

    this.addCommand({
      id: "refresh-ollama-models",
      name: "Refresh Ollama translation models",
      callback: () => {
        void this.refreshOllamaModels(true);
      },
    });

    this.addCommand({
      id: "refresh-preference-learning-profile",
      name: "Refresh preference learning profile",
      callback: () => {
        void this.refreshPreferenceLearningProfile(true);
      },
    });

    this.addCommand({
      id: "preview-rss-note-template",
      name: "Preview RSS note template",
      callback: () => {
        this.openNotePreviewModal();
      },
    });

    this.addCommand({
      id: "preview-recommended-rss-feeds",
      name: "Preview recommended RSS feeds",
      callback: () => {
        this.openRecommendedFeedsModal();
      },
    });

    this.addCommand({
      id: "add-recommended-rss-feeds-minimum",
      name: "Add recommended RSS feeds (target 2 per topic)",
      callback: () => {
        void this.addRecommendedFeedsByTarget(RECOMMENDED_MIN_FEEDS_PER_TOPIC, true);
      },
    });

    this.addCommand({
      id: "add-google-news-search-feeds",
      name: "Add Google News search feeds by topic",
      callback: () => {
        void this.addGoogleNewsSearchFeedsForPriority(true);
      },
    });

    this.addRibbonIcon("rss", "Run due RSS window captures now", () => {
      void this.runDueWindows("manual");
    });

    this.registerInterval(
      window.setInterval(() => {
        if (!this.settings.autoFetchEnabled) {
          return;
        }
        void this.runDueWindows("scheduler");
      }, SCHEDULER_TICK_MS),
    );

    const startupTimer = window.setTimeout(() => {
      if (this.settings.rssDashboardSyncEnabled) {
        void this.syncFeedsFromRssDashboard(false, false);
      }
      if (!this.settings.autoFetchEnabled || !this.settings.startupCatchupEnabled) {
        return;
      }
      void this.runDueWindows("startup");
    }, 4000);

    this.register(() => window.clearTimeout(startupTimer));
  }

  async loadSettings(): Promise<void> {
    const loaded = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, loaded);
    this.settings.uiLanguage = this.settings.uiLanguage === "en" ? "en" : "ko";
    this.settings.simpleSettingsMode = this.settings.simpleSettingsMode !== false;
    this.settings.feeds = (this.settings.feeds || []).map((feed) => ({
      id: feed.id || createFeedId(),
      topic: normalizeTopic(feed.topic || "Uncategorized"),
      name: (feed.name || "").trim(),
      url: (feed.url || "").trim(),
      enabled: feed.enabled !== false,
      source: feed.source === "rss-dashboard" ? "rss-dashboard" : "manual",
    }));
    this.settings.rssDashboardDataPath =
      (this.settings.rssDashboardDataPath || DEFAULT_SETTINGS.rssDashboardDataPath).trim()
      || DEFAULT_SETTINGS.rssDashboardDataPath;
    this.settings.includeKeywords = (this.settings.includeKeywords || "").trim();
    this.settings.excludeKeywords = (this.settings.excludeKeywords || "").trim();
    this.settings.scoreDefaultValue = Math.max(
      1,
      Math.min(5, Math.floor(Number(this.settings.scoreDefaultValue) || 3)),
    );
    this.settings.scoreActionThreshold = Math.max(
      1,
      Math.floor(Number(this.settings.scoreActionThreshold) || 14),
    );
    this.settings.maxCatchupWindowsPerRun = Math.max(
      1,
      Math.min(100, Math.floor(Number(this.settings.maxCatchupWindowsPerRun) || 10)),
    );
    this.settings.maxItemsPerWindow = Math.max(
      MIN_BASE_ITEMS_PER_WINDOW,
      Math.min(MAX_BASE_ITEMS_PER_WINDOW, Math.floor(Number(this.settings.maxItemsPerWindow) || 20)),
    );
    this.settings.adaptiveItemCapEnabled = this.settings.adaptiveItemCapEnabled !== false;
    this.settings.adaptiveItemCapMax = Math.max(
      this.settings.maxItemsPerWindow,
      Math.min(MAX_BASE_ITEMS_PER_WINDOW, Math.floor(Number(this.settings.adaptiveItemCapMax) || 50)),
    );
    this.settings.topicRelevanceFilterEnabled = this.settings.topicRelevanceFilterEnabled !== false;
    const parsedTopicRelevanceMinScore = Number(this.settings.topicRelevanceMinScore);
    const safeTopicRelevanceMinScore = Number.isFinite(parsedTopicRelevanceMinScore)
      ? parsedTopicRelevanceMinScore
      : DEFAULT_SETTINGS.topicRelevanceMinScore;
    this.settings.topicRelevanceMinScore = Math.max(
      MIN_TOPIC_RELEVANCE_MIN_SCORE,
      Math.min(MAX_TOPIC_RELEVANCE_MIN_SCORE, Math.floor(safeTopicRelevanceMinScore)),
    );
    this.settings.topicPriorityEnabled = this.settings.topicPriorityEnabled !== false;
    this.settings.topicPriorityOrder =
      (this.settings.topicPriorityOrder || DEFAULT_SETTINGS.topicPriorityOrder).trim()
      || DEFAULT_SETTINGS.topicPriorityOrder;
    const parsedTopicPriorityMaxBoost = Number(this.settings.topicPriorityMaxBoost);
    const safeTopicPriorityMaxBoost = Number.isFinite(parsedTopicPriorityMaxBoost)
      ? parsedTopicPriorityMaxBoost
      : DEFAULT_SETTINGS.topicPriorityMaxBoost;
    this.settings.topicPriorityMaxBoost = Math.max(
      MIN_TOPIC_PRIORITY_MAX_BOOST,
      Math.min(
        MAX_TOPIC_PRIORITY_MAX_BOOST,
        Math.round(safeTopicPriorityMaxBoost * 100) / 100,
      ),
    );
    const parsedTopicMaxItems = Number(this.settings.topicMaxItemsPerTopic);
    const safeTopicMaxItems = Number.isFinite(parsedTopicMaxItems)
      ? parsedTopicMaxItems
      : DEFAULT_SETTINGS.topicMaxItemsPerTopic;
    this.settings.topicMaxItemsPerTopic = Math.max(
      MIN_TOPIC_MAX_ITEMS_PER_TOPIC,
      Math.min(MAX_TOPIC_MAX_ITEMS_PER_TOPIC, Math.floor(safeTopicMaxItems)),
    );
    this.settings.preferenceLearningEnabled = this.settings.preferenceLearningEnabled === true;
    this.settings.preferenceFeedbackTemplateEnabled = this.settings.preferenceFeedbackTemplateEnabled !== false;
    const parsedPreferenceScoreWeight = Number(this.settings.preferenceScoreWeight);
    const safePreferenceScoreWeight = Number.isFinite(parsedPreferenceScoreWeight)
      ? parsedPreferenceScoreWeight
      : DEFAULT_SETTINGS.preferenceScoreWeight;
    this.settings.preferenceScoreWeight = Math.max(
      MIN_PREFERENCE_SCORE_WEIGHT,
      Math.min(
        MAX_PREFERENCE_SCORE_WEIGHT,
        Math.round(safePreferenceScoreWeight * 100) / 100,
      ),
    );
    const rawWeights =
      this.settings.preferenceTokenWeights
      && typeof this.settings.preferenceTokenWeights === "object"
        ? this.settings.preferenceTokenWeights
        : {};
    const normalizedWeights = Object.entries(rawWeights as Record<string, unknown>)
      .map(([token, value]) => {
        const normalizedToken = token.trim().toLowerCase();
        const numeric = Number(value);
        if (!normalizedToken || !Number.isFinite(numeric) || numeric === 0) {
          return null;
        }
        const rounded = Math.round(numeric * 100) / 100;
        return [normalizedToken, rounded] as const;
      })
      .filter((entry): entry is readonly [string, number] => entry !== null)
      .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
      .slice(0, MAX_PREFERENCE_TOKEN_COUNT);
    this.settings.preferenceTokenWeights = Object.fromEntries(normalizedWeights);
    this.settings.preferenceLastLearnedAtIso = (this.settings.preferenceLastLearnedAtIso || "").trim();
    const parsedTopicMin = Number(this.settings.topicDiversityMinPerTopic);
    const safeTopicMin = Number.isFinite(parsedTopicMin) ? parsedTopicMin : 1;
    this.settings.topicDiversityMinPerTopic = Math.max(
      MIN_TOPIC_DIVERSITY_PER_TOPIC,
      Math.min(MAX_TOPIC_DIVERSITY_PER_TOPIC, Math.floor(safeTopicMin)),
    );
    if (this.settings.topicDiversityMinPerTopic > this.settings.topicMaxItemsPerTopic) {
      this.settings.topicDiversityMinPerTopic = this.settings.topicMaxItemsPerTopic;
    }
    const parsedDiversityPenalty = Number(this.settings.topicDiversityPenaltyPerSelected);
    const safeDiversityPenalty = Number.isFinite(parsedDiversityPenalty)
      ? parsedDiversityPenalty
      : 1.25;
    this.settings.topicDiversityPenaltyPerSelected = Math.max(
      MIN_TOPIC_DIVERSITY_PENALTY,
      Math.min(
        MAX_TOPIC_DIVERSITY_PENALTY,
        Math.round(safeDiversityPenalty * 100) / 100,
      ),
    );
    this.settings.translationProvider = this.normalizeTranslationProvider(
      this.settings.translationProvider,
    );
    this.settings.translationTargetLanguage =
      (this.settings.translationTargetLanguage || "ko").trim().toLowerCase() || "ko";
    this.settings.translationWebEndpoint =
      normalizeHttpBaseUrl(
        this.settings.translationWebEndpoint || DEFAULT_SETTINGS.translationWebEndpoint,
      ) || DEFAULT_SETTINGS.translationWebEndpoint;
    this.settings.ollamaBaseUrl =
      normalizeHttpBaseUrl(this.settings.ollamaBaseUrl || DEFAULT_SETTINGS.ollamaBaseUrl)
      || DEFAULT_SETTINGS.ollamaBaseUrl;
    this.settings.ollamaDetectedModels = Array.isArray(this.settings.ollamaDetectedModels)
      ? this.settings.ollamaDetectedModels
          .filter((model): model is string => typeof model === "string")
          .map((model) => model.trim())
          .filter((model) => model.length > 0)
      : [];
    this.settings.ollamaModel = (this.settings.ollamaModel || "").trim();
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  private getPreferenceTokenWeightMap(): Map<string, number> {
    return new Map<string, number>(
      Object.entries(this.settings.preferenceTokenWeights || {}).filter(([, value]) =>
        Number.isFinite(value),
      ),
    );
  }

  private scorePreferenceForRow(row: WindowItem): number {
    if (!this.settings.preferenceLearningEnabled) {
      return 0;
    }

    const weights = this.getPreferenceTokenWeightMap();
    if (weights.size === 0) {
      return 0;
    }

    const featureText = buildPreferenceFeatureText(row.feed, row.item);
    const tokens = tokenizePreferenceText(featureText);
    let score = 0;
    for (const token of tokens) {
      score += weights.get(token) ?? 0;
    }

    return Math.max(-10, Math.min(10, Math.round(score * 100) / 100));
  }

  private extractPreferenceFeedbackSamples(content: string): Array<{ text: string; label: "prefer" | "avoid" }> {
    const lines = content.split(/\r?\n/);
    const samples: Array<{ text: string; label: "prefer" | "avoid" }> = [];
    const preferPattern = new RegExp(
      `- \\[x\\] .*\\(${escapeRegexPattern(PREFERENCE_MARKER_PREFER)}\\)`,
      "i",
    );
    const avoidPattern = new RegExp(
      `- \\[x\\] .*\\(${escapeRegexPattern(PREFERENCE_MARKER_AVOID)}\\)`,
      "i",
    );

    let currentTopic = "";
    let currentTitle = "";
    let currentItemLines: string[] = [];

    const flush = (): void => {
      if (!currentTitle) {
        currentItemLines = [];
        return;
      }

      const block = currentItemLines.join("\n");
      const hasPrefer = preferPattern.test(block);
      const hasAvoid = avoidPattern.test(block);
      if (hasPrefer === hasAvoid) {
        currentItemLines = [];
        currentTitle = "";
        return;
      }

      const sourceLine = currentItemLines.find((line) => /^- (Source|소스): /i.test(line)) || "";
      const quoteLines = currentItemLines
        .filter((line) => line.startsWith("> "))
        .map((line) => line.replace(/^>\s?/, ""));
      const sampleText = normalizePlainText(
        [currentTopic, currentTitle, sourceLine, ...quoteLines].filter((part) => part.trim().length > 0).join("\n"),
      );
      if (sampleText) {
        samples.push({ text: sampleText, label: hasPrefer ? "prefer" : "avoid" });
      }

      currentItemLines = [];
      currentTitle = "";
    };

    for (const line of lines) {
      if (line.startsWith("## ")) {
        flush();
        currentTopic = line.slice(3).trim();
        continue;
      }

      if (line.startsWith("### ")) {
        flush();
        currentTitle = line.slice(4).trim();
        continue;
      }

      if (currentTitle) {
        currentItemLines.push(line);
      }
    }

    flush();
    return samples;
  }

  async refreshPreferenceLearningProfile(showNotice: boolean): Promise<number> {
    const folder = this.resolveOutputFolder().replace(/\/+$/, "");
    const isKo = this.settings.uiLanguage !== "en";

    if (!folder) {
      if (showNotice) {
        new Notice(isKo ? "출력 폴더가 비어 있어 선호도 학습을 실행할 수 없습니다." : "Output folder is empty.");
      }
      return 0;
    }

    try {
      const files = this.app.vault
        .getMarkdownFiles()
        .filter((file) => file.path.startsWith(`${folder}/`));
      const tokenScores = new Map<string, number>();
      let sampledItems = 0;
      let scannedNotes = 0;

      for (const file of files) {
        const raw = await this.app.vault.cachedRead(file);
        if (!raw.includes(PREFERENCE_MARKER_PREFER) && !raw.includes(PREFERENCE_MARKER_AVOID)) {
          continue;
        }

        const samples = this.extractPreferenceFeedbackSamples(raw);
        if (samples.length === 0) {
          continue;
        }

        scannedNotes += 1;
        for (const sample of samples) {
          sampledItems += 1;
          const delta = sample.label === "prefer" ? 1 : -1;
          const tokens = tokenizePreferenceText(sample.text);
          for (const token of tokens) {
            tokenScores.set(token, (tokenScores.get(token) ?? 0) + delta);
          }
        }
      }

      const learned = Array.from(tokenScores.entries())
        .filter(([, score]) => Math.abs(score) >= PREFERENCE_TOKEN_MIN_ABS_WEIGHT)
        .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
        .slice(0, MAX_PREFERENCE_TOKEN_COUNT)
        .map(([token, score]) => [token, Math.round(score * 100) / 100] as const);

      this.settings.preferenceTokenWeights = Object.fromEntries(learned);
      this.settings.preferenceLastLearnedAtIso = new Date().toISOString();
      await this.saveSettings();

      if (showNotice) {
        const tokenCount = learned.length;
        const message = isKo
          ? `선호도 학습 완료: 노트 ${scannedNotes}개, 피드백 ${sampledItems}건, 토큰 ${tokenCount}개`
          : `Preference learning updated: notes ${scannedNotes}, feedback ${sampledItems}, tokens ${tokenCount}`;
        new Notice(message, 7000);
      }

      return learned.length;
    } catch (error) {
      console.error("[rss-insight] preference learning failure", error);
      if (showNotice) {
        new Notice(isKo ? "선호도 학습에 실패했습니다. 콘솔 로그를 확인하세요." : "Preference learning failed.");
      }
      return 0;
    }
  }

  openNotePreviewModal(): void {
    const isKo = this.settings.uiLanguage !== "en";
    const modal = new Modal(this.app);
    modal.titleEl.setText(isKo ? "RSS 노트 미리보기" : "RSS Note Preview");
    const pre = modal.contentEl.createEl("pre");
    pre.setText(this.buildNotePreviewSample());
    pre.style.whiteSpace = "pre-wrap";
    pre.style.userSelect = "text";
    pre.style.maxHeight = "70vh";
    pre.style.overflowY = "auto";
    modal.open();
  }

  private buildNotePreviewSample(): string {
    const now = new Date();
    const start = new Date(now.getTime() - (9 * 60 * 60 * 1000));
    const sampleFeed: FeedSource = {
      id: "preview",
      topic: this.settings.uiLanguage === "en" ? "AI" : "인공지능",
      name: "Sample Source",
      url: "https://example.com/rss",
      enabled: true,
      source: "manual",
    };
    const sampleItem: ParsedFeedItem = {
      id: "preview-item",
      title:
        this.settings.uiLanguage === "en"
          ? "Sample AI policy update for preview"
          : "미리보기용 인공지능 정책 업데이트 기사",
      link: "https://example.com/articles/preview-ai",
      published: now,
      publishedRaw: now.toISOString(),
      description:
        this.settings.uiLanguage === "en"
          ? "This is a preview description. The real note will contain collected feed items."
          : "이 문장은 미리보기 설명입니다. 실제 생성 시에는 수집된 기사 내용이 들어갑니다.",
    };
    const grouped = new Map<string, WindowItem[]>([
      [sampleFeed.topic, [{ feed: sampleFeed, item: sampleItem }]],
    ]);
    const translationStats: TranslationStats = {
      provider: "none",
      model: "",
      titlesTranslated: 0,
      descriptionsTranslated: 0,
      errors: [],
    };

    return this.buildNoteContent(
      start,
      now,
      grouped,
      1,
      1,
      0,
      0,
      0,
      0,
      0,
      0,
      this.resolveEffectiveMaxItemsPerWindow([sampleFeed]),
      [],
      translationStats,
      false,
    );
  }

  private resolveEffectiveMaxItemsPerWindow(feeds: FeedSource[]): number {
    const baseMax = Math.max(
      MIN_BASE_ITEMS_PER_WINDOW,
      Math.min(MAX_BASE_ITEMS_PER_WINDOW, Math.floor(Number(this.settings.maxItemsPerWindow) || 20)),
    );

    if (!this.settings.adaptiveItemCapEnabled) {
      return baseMax;
    }

    const enabledFeeds = feeds.filter((feed) => feed.enabled && feed.url.trim().length > 0);
    const topicCount = new Set(
      enabledFeeds.map((feed) => normalizeTopic(feed.topic || "Uncategorized")),
    ).size;
    const feedBonus = Math.floor(enabledFeeds.length / 3);
    const topicBonus = Math.floor(topicCount / 2);
    const adaptiveMax = Math.max(
      baseMax,
      Math.min(MAX_BASE_ITEMS_PER_WINDOW, Math.floor(Number(this.settings.adaptiveItemCapMax) || 50)),
    );

    return Math.max(baseMax, Math.min(adaptiveMax, baseMax + feedBonus + topicBonus));
  }

  getEffectiveMaxItemsPreview(): number {
    const enabledFeeds = this.settings.feeds.filter((feed) => feed.enabled && feed.url.trim().length > 0);
    return this.resolveEffectiveMaxItemsPerWindow(enabledFeeds);
  }

  openRecommendedFeedsModal(): void {
    const isKo = this.settings.uiLanguage !== "en";
    const modal = new Modal(this.app);
    modal.titleEl.setText(isKo ? "추천 RSS 피드 목록" : "Recommended RSS Feeds");
    const pre = modal.contentEl.createEl("pre");
    pre.setText(this.buildRecommendedFeedPreviewText());
    pre.style.whiteSpace = "pre-wrap";
    pre.style.userSelect = "text";
    pre.style.maxHeight = "70vh";
    pre.style.overflowY = "auto";
    modal.open();
  }

  async addRecommendedFeedsByTarget(targetPerTopic: number, showNotice: boolean): Promise<number> {
    const clampedTarget = Math.max(1, Math.min(RECOMMENDED_MAX_FEEDS_PER_TOPIC, Math.floor(targetPerTopic)));
    const orderedTopics = parseTopicPriorityOrder(this.settings.topicPriorityOrder);
    const topicOrder = orderedTopics.length > 0 ? orderedTopics : [...DEFAULT_TOPIC_PRIORITY_KEYS];
    const existingUrlSet = this.getExistingFeedUrlSet();
    let added = 0;

    for (const topicKey of topicOrder) {
      const currentCount = this.settings.feeds.filter((feed) =>
        feed.enabled
        && feed.url.trim().length > 0
        && resolveCanonicalTopicKey(feed.topic) === topicKey,
      ).length;
      const need = Math.max(0, clampedTarget - currentCount);
      if (need <= 0) {
        continue;
      }

      const topicLabel = this.pickTopicLabelForTopicKey(topicKey);
      const candidates = RECOMMENDED_FEED_TEMPLATES.filter((candidate) => candidate.topicKey === topicKey);
      let topicAdded = 0;
      for (const candidate of candidates) {
        if (topicAdded >= need) {
          break;
        }
        const normalizedUrl = normalizeFeedUrlForCompare(candidate.url);
        if (existingUrlSet.has(normalizedUrl)) {
          continue;
        }
        this.settings.feeds.push({
          id: createFeedId(),
          topic: topicLabel,
          name: candidate.name,
          url: candidate.url,
          enabled: true,
          source: "manual",
        });
        existingUrlSet.add(normalizedUrl);
        topicAdded += 1;
        added += 1;
      }
    }

    if (added > 0) {
      await this.saveSettings();
    }
    if (showNotice) {
      const isKo = this.settings.uiLanguage !== "en";
      const msg = isKo
        ? `추천 피드 ${added}개를 자동 추가했습니다.`
        : `Added ${added} recommended feed(s).`;
      new Notice(msg, 5000);
    }
    return added;
  }

  async addGoogleNewsSearchFeedsForPriority(showNotice: boolean): Promise<number> {
    const orderedTopics = parseTopicPriorityOrder(this.settings.topicPriorityOrder);
    const topicOrder = orderedTopics.length > 0 ? orderedTopics : [...DEFAULT_TOPIC_PRIORITY_KEYS];
    const existingUrlSet = this.getExistingFeedUrlSet();
    let added = 0;

    for (const topicKey of topicOrder) {
      const query = GOOGLE_NEWS_QUERY_BY_TOPIC[topicKey];
      const url = buildGoogleNewsSearchFeedUrl(query);
      const normalizedUrl = normalizeFeedUrlForCompare(url);
      if (existingUrlSet.has(normalizedUrl)) {
        continue;
      }
      const topicLabel = this.pickTopicLabelForTopicKey(topicKey);
      const displayLabel = getTopicLabel(topicKey, this.settings.uiLanguage);
      this.settings.feeds.push({
        id: createFeedId(),
        topic: topicLabel,
        name: `Google News 검색 - ${displayLabel}`,
        url,
        enabled: true,
        source: "manual",
      });
      existingUrlSet.add(normalizedUrl);
      added += 1;
    }

    if (added > 0) {
      await this.saveSettings();
    }
    if (showNotice) {
      const isKo = this.settings.uiLanguage !== "en";
      const msg = isKo
        ? `Google News 검색 피드 ${added}개를 추가했습니다.`
        : `Added ${added} Google News search feed(s).`;
      new Notice(msg, 5000);
    }
    return added;
  }

  private buildRecommendedFeedPreviewText(): string {
    const isKo = this.settings.uiLanguage !== "en";
    const lines: string[] = [];
    const existingUrlSet = this.getExistingFeedUrlSet();
    const orderedTopics = parseTopicPriorityOrder(this.settings.topicPriorityOrder);
    const topicOrder = orderedTopics.length > 0 ? orderedTopics : [...DEFAULT_TOPIC_PRIORITY_KEYS];

    lines.push(
      isKo
        ? "우선순위 토픽 기준 추천 RSS 목록 (검증된 URL)"
        : "Recommended RSS list by priority topic (validated URLs)",
    );
    lines.push("");

    for (const topicKey of topicOrder) {
      lines.push(`## ${getTopicLabel(topicKey, this.settings.uiLanguage)}`);
      const candidates = RECOMMENDED_FEED_TEMPLATES.filter((candidate) => candidate.topicKey === topicKey);
      for (const candidate of candidates) {
        const exists = existingUrlSet.has(normalizeFeedUrlForCompare(candidate.url));
        const status = exists
          ? (isKo ? "이미 추가됨" : "already added")
          : (isKo ? "추가 가능" : "available");
        lines.push(`- ${candidate.name} [${status}]`);
        lines.push(`  ${candidate.url}`);
        lines.push(`  ${isKo ? "신뢰도" : "Trust"}: ${candidate.trustNote}`);
      }
      const googleSearchUrl = buildGoogleNewsSearchFeedUrl(GOOGLE_NEWS_QUERY_BY_TOPIC[topicKey]);
      const existsGoogle = existingUrlSet.has(normalizeFeedUrlForCompare(googleSearchUrl));
      lines.push(`- Google News (${isKo ? "검색 피드" : "search feed"}) [${existsGoogle ? (isKo ? "이미 추가됨" : "already added") : (isKo ? "추가 가능" : "available")}]`);
      lines.push(`  ${googleSearchUrl}`);
      lines.push("");
    }

    return lines.join("\n");
  }

  private getExistingFeedUrlSet(): Set<string> {
    return new Set(
      this.settings.feeds
        .map((feed) => normalizeFeedUrlForCompare(feed.url))
        .filter((url) => url.length > 0),
    );
  }

  private pickTopicLabelForTopicKey(topicKey: Exclude<CanonicalTopicKey, "other">): string {
    const counts = new Map<string, number>();
    for (const feed of this.settings.feeds) {
      const topicText = normalizeTopic(feed.topic || "");
      if (!topicText || resolveCanonicalTopicKey(topicText) !== topicKey) {
        continue;
      }
      counts.set(topicText, (counts.get(topicText) ?? 0) + 1);
    }

    if (counts.size === 0) {
      return getTopicLabel(topicKey, this.settings.uiLanguage);
    }

    const sorted = Array.from(counts.entries()).sort((a, b) => {
      if (a[1] !== b[1]) {
        return b[1] - a[1];
      }
      return a[0].localeCompare(b[0]);
    });
    return sorted[0][0];
  }

  async syncFeedsFromRssDashboard(force: boolean, showNotice: boolean): Promise<boolean> {
    if (!this.settings.rssDashboardSyncEnabled) {
      if (showNotice) {
        new Notice("RSS Dashboard sync is disabled.");
      }
      return false;
    }

    const dataPath = normalizePath(
      this.settings.rssDashboardDataPath.trim() || DEFAULT_SETTINGS.rssDashboardDataPath,
    );

    try {
      const adapter = this.app.vault.adapter;
      const exists = await adapter.exists(dataPath);
      if (!exists) {
        if (showNotice) {
          new Notice(`RSS Dashboard data not found: ${dataPath}`);
        }
        return false;
      }

      const stat = await adapter.stat(dataPath);
      const mtime = stat?.mtime ?? 0;
      if (!force && mtime > 0 && mtime <= this.settings.rssDashboardLastMtime) {
        return false;
      }

      const raw = await adapter.read(dataPath);
      const parsed = JSON.parse(raw) as RssDashboardDataFile;
      const dashboardFeeds = Array.isArray(parsed.feeds) ? parsed.feeds : [];

      const manualFeeds = this.settings.feeds.filter((feed) => feed.source !== "rss-dashboard");
      const manualUrlSet = new Set(
        manualFeeds.map((feed) => feed.url.trim()).filter((url) => url.length > 0),
      );
      const existingSyncedByUrl = new Map<string, FeedSource>(
        this.settings.feeds
          .filter((feed) => feed.source === "rss-dashboard")
          .map((feed) => [feed.url.trim(), feed]),
      );

      const nextSyncedByUrl = new Map<string, FeedSource>();
      for (const record of dashboardFeeds) {
        const url = typeof record.url === "string" ? record.url.trim() : "";
        if (!url || manualUrlSet.has(url) || nextSyncedByUrl.has(url)) {
          continue;
        }

        const existing = existingSyncedByUrl.get(url);
        const title = typeof record.title === "string" ? record.title.trim() : "";
        const folder = typeof record.folder === "string" ? record.folder : "";
        const defaultName = title || url;
        const defaultTopic = normalizeTopic(folder || "Uncategorized");

        nextSyncedByUrl.set(url, {
          id: existing?.id || buildDeterministicFeedId(url),
          topic: existing?.topic?.trim() ? existing.topic.trim() : defaultTopic,
          name: existing?.name?.trim() ? existing.name.trim() : defaultName,
          url,
          enabled: existing ? existing.enabled : false,
          source: "rss-dashboard",
        });
      }

      const syncedFeeds = Array.from(nextSyncedByUrl.values());
      const nextFeeds = [...manualFeeds, ...syncedFeeds];

      const changed =
        JSON.stringify(this.settings.feeds) !== JSON.stringify(nextFeeds)
        || this.settings.rssDashboardLastMtime !== mtime;

      this.settings.rssDashboardLastMtime = mtime;
      this.settings.rssDashboardLastSyncAtIso = new Date().toISOString();
      if (changed) {
        this.settings.feeds = nextFeeds;
      }
      await this.saveSettings();

      if (showNotice) {
        const suffix = changed ? "" : " (no feed changes)";
        new Notice(`Synced ${syncedFeeds.length} feed(s) from RSS Dashboard${suffix}.`, 5000);
      }

      return changed;
    } catch (error) {
      console.error("[rss-insight] dashboard sync failure", error);
      if (showNotice) {
        new Notice("Failed to sync from RSS Dashboard. Check console logs.", 8000);
      }
      return false;
    }
  }

  getOllamaModelOptionsForUi(): string[] {
    const out: string[] = [];
    const seen = new Set<string>();

    const current = this.settings.ollamaModel.trim();
    if (current) {
      out.push(current);
      seen.add(current);
    }

    for (const model of this.settings.ollamaDetectedModels) {
      const trimmed = model.trim();
      if (!trimmed || seen.has(trimmed)) {
        continue;
      }
      out.push(trimmed);
      seen.add(trimmed);
    }

    return out;
  }

  getRecommendedOllamaModelForUi(): string {
    const options = this.getOllamaModelOptionsForUi();
    return this.getRecommendedOllamaModel(options);
  }

  async refreshOllamaModels(showNotice: boolean): Promise<string[]> {
    const base = normalizeHttpBaseUrl(this.settings.ollamaBaseUrl || DEFAULT_SETTINGS.ollamaBaseUrl);
    if (!base) {
      if (showNotice) {
        new Notice("Ollama base URL is empty.");
      }
      return [];
    }

    try {
      const response = await requestUrl({
        url: `${base}/api/tags`,
        method: "GET",
        throw: false,
        headers: {
          Accept: "application/json",
        },
      });

      if (response.status >= 400) {
        throw new Error(`HTTP ${response.status}`);
      }

      const parsed = JSON.parse(response.text) as { models?: Array<{ name?: unknown }> };
      const models = Array.isArray(parsed.models)
        ? parsed.models
            .map((model) => (typeof model?.name === "string" ? model.name.trim() : ""))
            .filter((name) => name.length > 0)
        : [];

      this.settings.ollamaDetectedModels = Array.from(new Set(models));
      this.settings.ollamaLastModelRefreshIso = new Date().toISOString();

      if (
        this.settings.ollamaDetectedModels.length > 0
        && !this.settings.ollamaDetectedModels.includes(this.settings.ollamaModel)
      ) {
        this.settings.ollamaModel = this.getRecommendedOllamaModel(
          this.settings.ollamaDetectedModels,
        );
      }

      await this.saveSettings();
      if (showNotice) {
        const recommended = this.getRecommendedOllamaModel(this.settings.ollamaDetectedModels);
        const suffix = recommended ? ` / recommended: ${recommended}` : "";
        new Notice(`Detected ${this.settings.ollamaDetectedModels.length} Ollama model(s)${suffix}.`, 6000);
      }
      return this.settings.ollamaDetectedModels;
    } catch (error) {
      console.error("[rss-insight] ollama model refresh failure", error);
      if (showNotice) {
        new Notice("Failed to fetch Ollama models. Check Ollama server URL.", 8000);
      }
      return [];
    }
  }

  private normalizeTranslationProvider(raw: unknown): TranslationProvider {
    if (raw === "none" || raw === "web" || raw === "ollama") {
      return raw;
    }
    return DEFAULT_SETTINGS.translationProvider;
  }

  private getRecommendedOllamaModel(models: string[]): string {
    if (models.length === 0) {
      return "";
    }

    for (const pattern of OLLAMA_MODEL_RECOMMENDATION_PATTERNS) {
      const match = models.find((model) => pattern.test(model));
      if (match) {
        return match;
      }
    }

    return models[0];
  }

  private getEffectiveTranslationProvider(): TranslationProvider {
    if (!this.settings.translationEnabled) {
      return "none";
    }

    const provider = this.normalizeTranslationProvider(this.settings.translationProvider);
    if (provider === "ollama" && !this.settings.ollamaModel.trim()) {
      return "none";
    }

    return provider;
  }

  private shouldTranslateField(raw: string): boolean {
    const text = normalizePlainText(raw);
    if (!text) {
      return false;
    }

    if (!hasAnyLetters(text)) {
      return false;
    }

    if (!this.settings.translationOnlyNonKorean) {
      return true;
    }

    return !containsHangul(text);
  }

  private async applyTranslations(grouped: Map<string, WindowItem[]>): Promise<TranslationStats> {
    const provider = this.getEffectiveTranslationProvider();
    const model = provider === "ollama" ? this.settings.ollamaModel.trim() : "";
    const stats: TranslationStats = {
      provider,
      model,
      titlesTranslated: 0,
      descriptionsTranslated: 0,
      errors: [],
    };

    if (provider === "none") {
      return stats;
    }

    const rows = Array.from(grouped.values()).flat();
    if (rows.length === 0) {
      return stats;
    }

    for (const row of rows) {
      if (this.settings.translationTranslateTitle && this.shouldTranslateField(row.item.title)) {
        try {
          const translated = await this.translateTextWithProvider(row.item.title, provider, model);
          if (translated && translated !== row.item.title) {
            row.translatedTitle = translated;
            stats.titlesTranslated += 1;
          }
        } catch (error) {
          stats.errors.push(
            `Title translation failed (${row.feed.name || row.feed.url}): ${this.errorToMessage(error)}`,
          );
        }
      }

      if (
        this.settings.translationTranslateDescription
        && this.settings.includeDescription
        && this.shouldTranslateField(row.item.description)
      ) {
        try {
          const translated = await this.translateTextWithProvider(
            row.item.description,
            provider,
            model,
          );
          if (translated && translated !== row.item.description) {
            row.translatedDescription = translated;
            stats.descriptionsTranslated += 1;
          }
        } catch (error) {
          stats.errors.push(
            `Description translation failed (${row.feed.name || row.feed.url}): ${this.errorToMessage(error)}`,
          );
        }
      }
    }

    return stats;
  }

  private async translateTextWithProvider(
    raw: string,
    provider: TranslationProvider,
    model: string,
  ): Promise<string> {
    const normalized = normalizePlainText(raw);
    if (!normalized) {
      return normalized;
    }

    const targetLanguage = (this.settings.translationTargetLanguage || "ko").trim().toLowerCase();
    const cacheKey = `${provider}::${model}::${targetLanguage}::${normalized}`;
    const cached = this.translationCache.get(cacheKey);
    if (cached !== undefined) {
      return cached;
    }

    let translated = normalized;
    if (provider === "web") {
      translated = await this.translateWithWebProvider(normalized, targetLanguage);
    } else if (provider === "ollama") {
      translated = await this.translateWithOllamaProvider(normalized, targetLanguage, model);
    }

    const out = normalizePlainText(translated) || normalized;
    this.translationCache.set(cacheKey, out);
    return out;
  }

  private async translateWithWebProvider(raw: string, targetLanguage: string): Promise<string> {
    const endpoint = normalizeHttpBaseUrl(
      this.settings.translationWebEndpoint || DEFAULT_SETTINGS.translationWebEndpoint,
    );
    const url = `${endpoint}?client=gtx&sl=auto&tl=${encodeURIComponent(targetLanguage)}&dt=t&q=${encodeURIComponent(raw)}`;

    const response = await requestUrl({
      url,
      method: "GET",
      throw: false,
      headers: {
        Accept: "application/json, text/plain, */*",
      },
    });

    if (response.status >= 400) {
      throw new Error(`web translate HTTP ${response.status}`);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(response.text);
    } catch {
      throw new Error("web translate invalid JSON");
    }

    if (!Array.isArray(parsed) || !Array.isArray(parsed[0])) {
      throw new Error("web translate unexpected payload");
    }

    const translated = (parsed[0] as unknown[])
      .map((chunk) => {
        if (!Array.isArray(chunk) || typeof chunk[0] !== "string") {
          return "";
        }
        return chunk[0];
      })
      .join("");

    return normalizePlainText(translated) || raw;
  }

  private async translateWithOllamaProvider(
    raw: string,
    targetLanguage: string,
    model: string,
  ): Promise<string> {
    const base = normalizeHttpBaseUrl(this.settings.ollamaBaseUrl || DEFAULT_SETTINGS.ollamaBaseUrl);
    if (!model) {
      throw new Error("Ollama model is not selected");
    }

    const prompt = [
      "You are a precise translator.",
      `Translate the text into ${targetLanguage}.`,
      "Preserve facts, numbers, names, and URLs.",
      "Return only the translated text.",
      "",
      truncateForModelInput(raw),
    ].join("\n");

    const response = await requestUrl({
      url: `${base}/api/generate`,
      method: "POST",
      throw: false,
      contentType: "application/json",
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        options: {
          temperature: 0.1,
        },
      }),
      headers: {
        Accept: "application/json",
      },
    });

    if (response.status >= 400) {
      throw new Error(`ollama HTTP ${response.status}`);
    }

    const parsed = JSON.parse(response.text) as { response?: unknown };
    if (typeof parsed.response !== "string") {
      throw new Error("ollama invalid response payload");
    }

    return normalizePlainText(parsed.response) || raw;
  }

  private errorToMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }

  private async enrichMissingDescriptions(grouped: Map<string, WindowItem[]>): Promise<void> {
    if (!this.settings.includeDescription) {
      return;
    }

    const candidates = Array.from(grouped.values())
      .flat()
      .filter((row) => !normalizePlainText(row.item.description) && row.item.link.trim().length > 0)
      .slice(0, MAX_DESCRIPTION_ENRICH_ITEMS_PER_WINDOW);

    if (candidates.length === 0) {
      return;
    }

    const results = await Promise.allSettled(
      candidates.map(async (row) => {
        const description = await this.fetchDescriptionFromArticleLink(row.item.link);
        if (description) {
          row.item.description = description;
        }
      }),
    );

    for (const result of results) {
      if (result.status === "rejected") {
        console.debug("[rss-insight] description enrich skipped", result.reason);
      }
    }
  }

  private async fetchDescriptionFromArticleLink(url: string): Promise<string> {
    const response = await requestUrl({
      url,
      method: "GET",
      throw: false,
      headers: {
        Accept: "text/html,application/xhtml+xml",
      },
    });

    if (response.status >= 400 || !response.text) {
      return "";
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(response.text, "text/html");

    const siteSpecific = readSiteSpecificDescription(url, doc);
    if (siteSpecific) {
      return siteSpecific;
    }

    const metaDescription = readMetaDescription(doc);
    if (metaDescription) {
      return metaDescription;
    }

    const jsonLdDescription = readJsonLdDescription(doc);
    if (jsonLdDescription) {
      return jsonLdDescription;
    }

    const paragraph = readBestParagraph(doc);
    return paragraph;
  }

  private buildDedupeKeys(feed: FeedSource, item: ParsedFeedItem): string[] {
    const keys: string[] = [toItemKey(feed, item)];
    if (!this.settings.enhancedDedupeEnabled) {
      return keys;
    }

    const canonicalLink = canonicalizeLinkForDedupe(item.link);
    if (canonicalLink) {
      keys.push(`link::${canonicalLink}`);
    }

    const normalizedTitle = normalizeTitleForDedupe(item.title);
    if (normalizedTitle) {
      keys.push(`title::${normalizedTitle}::${formatYmd(item.published)}`);
    }

    return keys;
  }

  async runDueWindows(reason: "manual" | "scheduler" | "startup" | "settings"): Promise<void> {
    if (this.runInProgress) {
      if (reason === "manual") {
        new Notice("RSS window capture is already running.");
      }
      return;
    }

    await this.syncFeedsFromRssDashboard(false, false);

    const enabledFeeds = this.settings.feeds.filter(
      (feed) => feed.enabled && feed.url.trim().length > 0,
    );
    if (enabledFeeds.length === 0) {
      if (reason === "manual") {
        new Notice("No enabled RSS feeds configured.");
      }
      return;
    }

    const scheduleMinutes = parseScheduleMinutes(this.settings.scheduleTimes);
    if (scheduleMinutes.length === 0) {
      if (reason === "manual") {
        new Notice("Schedule is invalid. Use HH:MM,HH:MM format.");
      }
      return;
    }

    const dueWindowEnds = this.collectDueWindowEnds(new Date(), scheduleMinutes);
    if (dueWindowEnds.length === 0) {
      if (reason === "manual") {
        new Notice("No due RSS windows to capture right now.");
      }
      return;
    }

    this.runInProgress = true;
    let processedCount = 0;
    let totalItems = 0;
    let windowsHitItemLimit = 0;

    try {
      for (const windowEnd of dueWindowEnds) {
        const windowStart = this.findPreviousBoundary(windowEnd, scheduleMinutes);
        const outcome = await this.captureWindow(windowStart, windowEnd, enabledFeeds);

        this.settings.lastWindowEndIso = windowEnd.toISOString();
        await this.saveSettings();

        processedCount += 1;
        totalItems += outcome.totalItems;
        if (outcome.itemLimitHit) {
          windowsHitItemLimit += 1;
        }

        if (outcome.feedErrors.length > 0) {
          new Notice(
            `RSS window ${formatLocalDateTime(windowEnd)} captured with ${outcome.feedErrors.length} feed errors.`,
            8000,
          );
        }
      }
    } catch (error) {
      console.error("[rss-insight] run failure", error);
      new Notice("RSS window capture failed. Check console logs for details.", 8000);
    } finally {
      this.runInProgress = false;
    }

    if (reason === "manual") {
      const limitSuffix = windowsHitItemLimit > 0
        ? ` (item limit hit in ${windowsHitItemLimit} window(s))`
        : "";
      new Notice(`Captured ${processedCount} window(s), ${totalItems} item(s)${limitSuffix}.`, 6000);
    }
  }

  async captureLatestCompletedWindow(): Promise<void> {
    if (this.runInProgress) {
      new Notice("RSS window capture is already running.");
      return;
    }

    await this.syncFeedsFromRssDashboard(false, false);

    const enabledFeeds = this.settings.feeds.filter(
      (feed) => feed.enabled && feed.url.trim().length > 0,
    );
    if (enabledFeeds.length === 0) {
      new Notice("No enabled RSS feeds configured.");
      return;
    }

    const scheduleMinutes = parseScheduleMinutes(this.settings.scheduleTimes);
    if (scheduleMinutes.length === 0) {
      new Notice("Schedule is invalid. Use HH:MM,HH:MM format.");
      return;
    }

    const now = new Date();
    const latestWindowEnd = this.findPreviousBoundary(
      new Date(now.getTime() + 1000),
      scheduleMinutes,
    );
    const latestWindowStart = this.findPreviousBoundary(latestWindowEnd, scheduleMinutes);

    this.runInProgress = true;
    try {
      const outcome = await this.captureWindow(latestWindowStart, latestWindowEnd, enabledFeeds);
      if (
        !this.settings.lastWindowEndIso
        || latestWindowEnd.getTime() > new Date(this.settings.lastWindowEndIso).getTime()
      ) {
        this.settings.lastWindowEndIso = latestWindowEnd.toISOString();
        await this.saveSettings();
      }
      const limitSuffix = outcome.itemLimitHit ? " (item limit hit)" : "";
      new Notice(
        `Captured latest window ${formatLocalDateTime(latestWindowEnd)} with ${outcome.totalItems} item(s)${limitSuffix}.`,
        6000,
      );
    } catch (error) {
      console.error("[rss-insight] latest window failure", error);
      new Notice("Failed to capture latest window.", 8000);
    } finally {
      this.runInProgress = false;
    }
  }

  private collectDueWindowEnds(now: Date, scheduleMinutes: number[]): Date[] {
    let anchor: Date;
    if (this.settings.lastWindowEndIso) {
      const parsed = new Date(this.settings.lastWindowEndIso);
      if (!Number.isNaN(parsed.getTime())) {
        anchor = parsed;
      } else {
        anchor = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      }
    } else {
      anchor = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    }

    if (anchor.getTime() > now.getTime()) {
      anchor = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    }

    const due: Date[] = [];
    let cursor = anchor;
    const maxCatchupWindows = Math.max(1, Math.min(100, this.settings.maxCatchupWindowsPerRun));

    for (let i = 0; i < maxCatchupWindows; i += 1) {
      const next = this.findNextBoundary(cursor, scheduleMinutes);
      if (next.getTime() > now.getTime()) {
        break;
      }
      due.push(next);
      cursor = next;
    }

    return due;
  }

  private findNextBoundary(after: Date, scheduleMinutes: number[]): Date {
    for (let dayOffset = 0; dayOffset <= 7; dayOffset += 1) {
      const day = new Date(
        after.getFullYear(),
        after.getMonth(),
        after.getDate() + dayOffset,
        0,
        0,
        0,
        0,
      );

      const candidates = scheduleMinutes
        .map((minutes) => dateAtMinutes(day, minutes))
        .filter((candidate) => candidate.getTime() > after.getTime())
        .sort((a, b) => a.getTime() - b.getTime());

      if (candidates.length > 0) {
        return candidates[0];
      }
    }

    return new Date(after.getTime() + 24 * 60 * 60 * 1000);
  }

  private findPreviousBoundary(before: Date, scheduleMinutes: number[]): Date {
    for (let dayOffset = 0; dayOffset <= 7; dayOffset += 1) {
      const day = new Date(
        before.getFullYear(),
        before.getMonth(),
        before.getDate() - dayOffset,
        0,
        0,
        0,
        0,
      );

      const candidates = scheduleMinutes
        .map((minutes) => dateAtMinutes(day, minutes))
        .filter((candidate) => candidate.getTime() < before.getTime())
        .sort((a, b) => b.getTime() - a.getTime());

      if (candidates.length > 0) {
        return candidates[0];
      }
    }

    return new Date(before.getTime() - 24 * 60 * 60 * 1000);
  }

  private async captureWindow(
    windowStart: Date,
    windowEnd: Date,
    feeds: FeedSource[],
  ): Promise<CaptureOutcome> {
    const grouped = new Map<string, WindowItem[]>();
    const windowCandidates: WindowItem[] = [];
    const itemKeys = new Set<string>();
    const feedErrors: string[] = [];
    let totalItems = 0;
    let itemsWithoutDate = 0;
    let itemsFilteredByKeyword = 0;
    let itemsFilteredByTopicMismatch = 0;
    let itemsFilteredByTopicRelevance = 0;
    let itemsDeduped = 0;
    let itemsFilteredByQuality = 0;
    const maxItemsPerWindow = this.resolveEffectiveMaxItemsPerWindow(feeds);
    let itemLimitHit = false;
    const includeKeywords = parseKeywordList(this.settings.includeKeywords);
    const excludeKeywords = parseKeywordList(this.settings.excludeKeywords);
    const topicPriorityOrder = parseTopicPriorityOrder(this.settings.topicPriorityOrder);

    const fetchResults = await Promise.allSettled(
      feeds.map(async (feed) => ({
        feed,
        items: await this.fetchFeedItems(feed),
      })),
    );

    for (const result of fetchResults) {
      if (result.status === "rejected") {
        const reason =
          result.reason instanceof Error ? result.reason.message : String(result.reason);
        feedErrors.push(reason);
        continue;
      }

      const { feed, items } = result.value;

      for (const item of items) {
        if (!item.published) {
          itemsWithoutDate += 1;
          continue;
        }

        const publishedMs = item.published.getTime();
        if (publishedMs <= windowStart.getTime() || publishedMs > windowEnd.getTime()) {
          continue;
        }

        const relevanceHaystack = buildTopicRelevanceHaystack(feed, item);

        if (this.settings.keywordFilterEnabled) {
          const haystack = relevanceHaystack;
          if (!matchesKeywordFilter(haystack, includeKeywords, excludeKeywords)) {
            itemsFilteredByKeyword += 1;
            continue;
          }
        }

        const feedTopicKey = resolveCanonicalTopicKey(feed.topic);
        if (isPrioritizedTopicKey(feedTopicKey)) {
          const inferred = inferPrimaryTopicFromHaystack(relevanceHaystack);
          const feedTopicScore = inferred.scores.get(feedTopicKey) ?? 0;
          if (
            inferred.key !== feedTopicKey
            && inferred.score >= TOPIC_MISMATCH_MIN_BEST_SCORE
            && (inferred.score - feedTopicScore) >= TOPIC_MISMATCH_MIN_GAP
          ) {
            itemsFilteredByTopicMismatch += 1;
            continue;
          }
        }

        if (this.settings.topicRelevanceFilterEnabled) {
          const topicKey = feedTopicKey;
          if (topicKey !== "other") {
            const relevanceScore = scoreTopicRelevance(
              topicKey,
              relevanceHaystack,
            );
            if (relevanceScore < this.settings.topicRelevanceMinScore) {
              itemsFilteredByTopicRelevance += 1;
              continue;
            }
          }
        }

        const dedupeKeys = this.buildDedupeKeys(feed, item);
        if (dedupeKeys.some((key) => itemKeys.has(key))) {
          itemsDeduped += 1;
          continue;
        }
        dedupeKeys.forEach((key) => itemKeys.add(key));

        windowCandidates.push({ feed, item });
      }
    }

    const rankedRows: ScoredWindowRow[] = windowCandidates
      .map((row) => {
        const qualityScore = scoreWindowItemQuality(row.item, windowEnd);
        const topicKey = resolveCanonicalTopicKey(row.feed.topic);
        const relevanceScore = scoreTopicRelevance(
          topicKey,
          buildTopicRelevanceHaystack(row.feed, row.item),
        );
        const priorityBoost = this.settings.topicPriorityEnabled
          ? getTopicPriorityBoost(topicKey, topicPriorityOrder, this.settings.topicPriorityMaxBoost)
          : 0;
        const preferenceScore = this.scorePreferenceForRow(row);
        const totalScore =
          qualityScore
          + (relevanceScore * TOPIC_RELEVANCE_WEIGHT)
          + priorityBoost
          + (preferenceScore * this.settings.preferenceScoreWeight);

        return {
          row,
          qualityScore,
          relevanceScore,
          priorityBoost,
          preferenceScore,
          totalScore,
        };
      })
      .sort((a, b) => {
        if (a.totalScore !== b.totalScore) {
          return b.totalScore - a.totalScore;
        }
        if (a.qualityScore !== b.qualityScore) {
          return b.qualityScore - a.qualityScore;
        }
        if (a.relevanceScore !== b.relevanceScore) {
          return b.relevanceScore - a.relevanceScore;
        }
        if (a.priorityBoost !== b.priorityBoost) {
          return b.priorityBoost - a.priorityBoost;
        }
        if (a.preferenceScore !== b.preferenceScore) {
          return b.preferenceScore - a.preferenceScore;
        }
        const aTime = a.row.item.published ? a.row.item.published.getTime() : 0;
        const bTime = b.row.item.published ? b.row.item.published.getTime() : 0;
        if (aTime !== bTime) {
          return bTime - aTime;
        }
        return a.row.item.title.localeCompare(b.row.item.title);
      });

    const selectedRows = selectRowsWithTopicDiversity(
      rankedRows,
      maxItemsPerWindow,
      this.settings.topicDiversityMinPerTopic,
      this.settings.topicMaxItemsPerTopic,
      this.settings.topicDiversityPenaltyPerSelected,
    );
    itemLimitHit = rankedRows.length > selectedRows.length;
    itemsFilteredByQuality = Math.max(0, rankedRows.length - selectedRows.length);
    totalItems = selectedRows.length;

    for (const row of selectedRows) {
      const topic = getRowTopic(row);
      if (!grouped.has(topic)) {
        grouped.set(topic, []);
      }
      grouped.get(topic)?.push(row);
    }

    if (totalItems === 0 && !this.settings.writeEmptyNote && feedErrors.length === 0) {
      return {
        notePath: null,
        totalItems,
        effectiveMaxItemsPerWindow: maxItemsPerWindow,
        feedErrors,
        feedsChecked: feeds.length,
        itemsWithoutDate,
        itemsFilteredByKeyword,
        itemsFilteredByTopicMismatch,
        itemsFilteredByTopicRelevance,
        itemsDeduped,
        itemsFilteredByQuality,
        itemLimitHit,
      };
    }

    await this.enrichMissingDescriptions(grouped);
    const translationStats = await this.applyTranslations(grouped);

    const notePath = this.buildOutputPath(windowEnd);
    const content = this.buildNoteContent(
      windowStart,
      windowEnd,
      grouped,
      feeds.length,
      totalItems,
      itemsWithoutDate,
      itemsFilteredByKeyword,
      itemsFilteredByTopicMismatch,
      itemsFilteredByTopicRelevance,
      itemsDeduped,
      itemsFilteredByQuality,
      maxItemsPerWindow,
      feedErrors,
      translationStats,
      itemLimitHit,
    );

    await this.ensureFolderExists(this.resolveOutputFolder());
    await this.writeOrOverwriteNote(notePath, content);

    return {
      notePath,
      totalItems,
      effectiveMaxItemsPerWindow: maxItemsPerWindow,
      feedErrors,
      feedsChecked: feeds.length,
      itemsWithoutDate,
      itemsFilteredByKeyword,
      itemsFilteredByTopicMismatch,
      itemsFilteredByTopicRelevance,
      itemsDeduped,
      itemsFilteredByQuality,
      itemLimitHit,
    };
  }

  private buildOutputPath(windowEnd: Date): string {
    const folder = this.resolveOutputFolder();
    const prefix = sanitizeFilePart(this.settings.filePrefix || DEFAULT_SETTINGS.filePrefix);
    const fileName = `${prefix}-${formatFileStamp(windowEnd)}.md`;
    return normalizePath(`${folder}/${fileName}`);
  }

  private resolveOutputFolder(): string {
    return normalizePath(this.settings.outputFolder.trim() || DEFAULT_SETTINGS.outputFolder);
  }

  private buildNoteContent(
    windowStart: Date,
    windowEnd: Date,
    grouped: Map<string, WindowItem[]>,
    feedsChecked: number,
    totalItems: number,
    itemsWithoutDate: number,
    itemsFilteredByKeyword: number,
    itemsFilteredByTopicMismatch: number,
    itemsFilteredByTopicRelevance: number,
    itemsDeduped: number,
    itemsFilteredByQuality: number,
    effectiveMaxItemsPerWindow: number,
    feedErrors: string[],
    translationStats: TranslationStats,
    itemLimitHit: boolean,
  ): string {
    const lines: string[] = [];
    const defaultScore = this.settings.scoreDefaultValue;
    const defaultTotalScore = defaultScore * 4;
    const isKo = this.settings.uiLanguage !== "en";
    const t = (ko: string, en: string): string => (isKo ? ko : en);
    const translationProviderLabel =
      translationStats.provider === "none"
        ? t("사용 안 함", "Disabled")
        : translationStats.provider === "web"
          ? t("웹 번역", "Web")
          : "Ollama";

    lines.push("---");
    lines.push('plugin: "rss-insight"');
    lines.push(`생성시각: "${escapeYamlString(new Date().toISOString())}"`);
    lines.push(`윈도우_시작: "${escapeYamlString(windowStart.toISOString())}"`);
    lines.push(`윈도우_종료: "${escapeYamlString(windowEnd.toISOString())}"`);
    lines.push(`확인피드수: ${feedsChecked}`);
    lines.push(`수집기사수: ${totalItems}`);
    lines.push(`토픽불일치제외수: ${itemsFilteredByTopicMismatch}`);
    lines.push(`토픽관련성제외수: ${itemsFilteredByTopicRelevance}`);
    lines.push(`피드오류수: ${feedErrors.length}`);
    lines.push(`상한도달: ${itemLimitHit ? "true" : "false"}`);
    lines.push("---");
    lines.push("");

    lines.push(`# ${t("RSS 수집 리포트", "RSS Capture")} ${formatLocalDateTime(windowEnd)}`);
    lines.push("");
    lines.push(`- ${t("윈도우 시작", "Window start")}: ${formatLocalDateTime(windowStart)}`);
    lines.push(`- ${t("윈도우 종료", "Window end")}: ${formatLocalDateTime(windowEnd)}`);
    lines.push(`- ${t("확인한 피드 수", "Feeds checked")}: ${feedsChecked}`);
    lines.push(`- ${t("수집 기사 수", "Items captured")}: ${totalItems}`);
    if (itemsFilteredByKeyword > 0) {
      lines.push(`- ${t("키워드 필터 제외", "Filtered by keywords")}: ${itemsFilteredByKeyword}`);
    }
    if (itemsFilteredByTopicMismatch > 0) {
      lines.push(`- ${t("토픽 불일치 제외", "Filtered by topic mismatch")}: ${itemsFilteredByTopicMismatch}`);
    }
    lines.push(`- ${t("토픽 관련성 제외", "Filtered by topic relevance")}: ${itemsFilteredByTopicRelevance}`);
    if (itemsDeduped > 0) {
      lines.push(`- ${t("중복 제거", "Deduped")}: ${itemsDeduped}`);
    }
    if (itemsFilteredByQuality > 0) {
      lines.push(`- ${t("품질 선별 제외", "Filtered by quality")}: ${itemsFilteredByQuality}`);
    }
    lines.push(`- ${t("윈도우 최대 기사 수", "Max items per window")}: ${effectiveMaxItemsPerWindow}`);
    lines.push(`- ${t("상한 도달", "Item limit hit")}: ${itemLimitHit ? t("예", "yes") : t("아니오", "no")}`);
    if (feedErrors.length > 0) {
      lines.push(`- ${t("피드 오류", "Feed errors")}: ${feedErrors.length}`);
    }
    if (translationStats.provider !== "none") {
      lines.push(`- ${t("번역 방식", "Translation provider")}: ${translationProviderLabel}`);
    }
    if (this.settings.preferenceLearningEnabled) {
      lines.push(
        `- ${t("선호도 학습", "Preference learning")}: ${
          Object.keys(this.settings.preferenceTokenWeights || {}).length
        } ${t("개 토큰 적용", "tokens applied")}`,
      );
    }
    if (this.settings.scoreTemplateEnabled) {
      lines.push(`- ${t("액션 후보 기준", "Action threshold")}: ${this.settings.scoreActionThreshold}+`);
    }
    lines.push("");

    const topics = Array.from(grouped.keys()).sort((a, b) => a.localeCompare(b));

    if (topics.length === 0) {
      lines.push(`## ${t("기사 목록", "Items")}`);
      lines.push("");
      lines.push(t("이 윈도우에서 수집된 기사가 없습니다.", "No items were found in this window."));
      lines.push("");
    }

    for (const topic of topics) {
      lines.push(`## ${topic}`);
      lines.push("");

      const rows = grouped.get(topic) ?? [];
      rows.sort((a, b) => {
        const aTime = a.item.published ? a.item.published.getTime() : 0;
        const bTime = b.item.published ? b.item.published.getTime() : 0;
        return bTime - aTime;
      });

      for (const row of rows) {
        const title = row.item.title || "(untitled)";
        const displayTitle = row.translatedTitle || title;
        const link = row.item.link || "";
        const published = row.item.published
          ? formatLocalDateTime(row.item.published)
          : row.item.publishedRaw || t("알 수 없음", "unknown");

        lines.push(`### ${displayTitle}`);
        lines.push(`- ${t("소스", "Source")}: ${row.feed.name || row.feed.url}`);
        lines.push(`- ${t("발행 시각", "Published")}: ${published}`);
        if (link) {
          lines.push(`- ${t("링크", "URL")}: ${link}`);
        }
        if (displayTitle !== title) {
          lines.push(`- ${t("원문 제목", "Original title")}: ${title}`);
        }

        if (this.settings.scoreTemplateEnabled) {
          lines.push(
            `- ${t("점수", "Score")}: ${
              t("영향도", "Impact")
            } ${defaultScore} / ${
              t("실행가능성", "Actionability")
            } ${defaultScore} / ${
              t("시의성", "Timing")
            } ${defaultScore} / ${
              t("신뢰도", "Confidence")
            } ${defaultScore} = ${defaultTotalScore}`,
          );
        }

        if (this.settings.preferenceFeedbackTemplateEnabled) {
          lines.push(`- [ ] ${t("선호", "Prefer")} (${PREFERENCE_MARKER_PREFER})`);
          lines.push(`- [ ] ${t("비선호", "Avoid")} (${PREFERENCE_MARKER_AVOID})`);
        }

        if (this.settings.includeDescription && row.item.description) {
          const hasTranslatedDescription =
            !!row.translatedDescription
            && normalizePlainText(row.translatedDescription) !== normalizePlainText(row.item.description);
          const maxLength = hasTranslatedDescription
            ? TRANSLATED_DESCRIPTION_MAX_LENGTH
            : Math.max(80, this.settings.descriptionMaxLength);
          const descriptionBody = row.translatedDescription || row.item.description;
          const description = truncateText(normalizePlainText(descriptionBody), maxLength);
          if (description) {
            lines.push("");
            for (const descLine of description.split("\n")) {
              lines.push(`> ${descLine}`);
            }
          }

          if (
            hasTranslatedDescription
            && this.settings.translationKeepOriginal
          ) {
            const originalDescription = normalizePlainText(row.item.description);
            if (originalDescription) {
              lines.push("");
              lines.push("<details>");
              lines.push(`<summary>${t("원문 설명", "Original description")}</summary>`);
              lines.push("");
              lines.push(originalDescription);
              lines.push("");
              lines.push("</details>");
            }
          }
        }

        lines.push("");
      }
    }

    if (feedErrors.length > 0) {
      lines.push(`## ${t("피드 오류", "Feed Errors")}`);
      lines.push("");
      for (const error of feedErrors) {
        lines.push(`- ${error}`);
      }
      lines.push("");
    }

    if (translationStats.errors.length > 0) {
      lines.push(`## ${t("번역 오류", "Translation Errors")}`);
      lines.push("");
      for (const error of translationStats.errors) {
        lines.push(`- ${error}`);
      }
      lines.push("");
    }

    return lines.join("\n");
  }

  private async ensureFolderExists(folderPath: string): Promise<void> {
    const normalized = normalizePath(folderPath).replace(/\/+$/, "");
    if (!normalized) {
      return;
    }

    const parts = normalized.split("/").filter((part) => part.length > 0);
    let currentPath = "";

    for (const part of parts) {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const existing = this.app.vault.getAbstractFileByPath(currentPath);
      if (!existing) {
        await this.app.vault.createFolder(currentPath);
        continue;
      }
      if (!(existing instanceof TFolder)) {
        throw new Error(`Path exists and is not a folder: ${currentPath}`);
      }
    }
  }

  private async writeOrOverwriteNote(path: string, content: string): Promise<void> {
    const existing = this.app.vault.getAbstractFileByPath(path);
    if (!existing) {
      await this.app.vault.create(path, content);
      return;
    }
    if (existing instanceof TFile) {
      await this.app.vault.modify(existing, content);
      return;
    }
    throw new Error(`Cannot write note. Path exists as folder: ${path}`);
  }

  private async fetchFeedItems(feed: FeedSource): Promise<ParsedFeedItem[]> {
    const response = await requestUrl({
      url: feed.url,
      method: "GET",
      throw: false,
      headers: {
        Accept: "application/rss+xml, application/atom+xml, text/xml, application/xml, text/plain",
      },
    });

    if (response.status >= 400) {
      throw new Error(`${feed.name || feed.url}: HTTP ${response.status}`);
    }

    const xml = response.text;
    if (!xml || xml.trim().length === 0) {
      throw new Error(`${feed.name || feed.url}: empty response`);
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, "text/xml");
    if (doc.getElementsByTagName("parsererror").length > 0) {
      throw new Error(`${feed.name || feed.url}: invalid XML`);
    }

    const rootName = doc.documentElement.tagName.toLowerCase();
    return rootName === "feed" ? this.parseAtom(doc) : this.parseRss(doc);
  }

  private parseRss(doc: XMLDocument): ParsedFeedItem[] {
    const items = Array.from(doc.getElementsByTagName("item"));
    return items.map((itemEl) => {
      const title = readChildText(itemEl, ["title"]);
      const link = readChildText(itemEl, ["link"]);
      const guid = readChildText(itemEl, ["guid"]);
      const publishedRaw = readChildText(itemEl, ["pubDate", "dc:date", "published", "updated"]);
      const descriptionRaw = readChildText(itemEl, ["description", "content:encoded"]);

      return {
        id: guid || link || title,
        title,
        link,
        published: parseDateMaybe(publishedRaw),
        publishedRaw,
        description: stripHtml(descriptionRaw),
      };
    });
  }

  private parseAtom(doc: XMLDocument): ParsedFeedItem[] {
    const entries = Array.from(doc.getElementsByTagName("entry"));
    return entries.map((entryEl) => {
      const title = readChildText(entryEl, ["title"]);
      const link = readAtomLink(entryEl);
      const id = readChildText(entryEl, ["id"]) || link || title;
      const publishedRaw = readChildText(entryEl, ["published", "updated"]);
      const descriptionRaw = readChildText(entryEl, ["summary", "content"]);

      return {
        id,
        title,
        link,
        published: parseDateMaybe(publishedRaw),
        publishedRaw,
        description: stripHtml(descriptionRaw),
      };
    });
  }
}

class RssWindowCaptureSettingTab extends PluginSettingTab {
  plugin: RssWindowCapturePlugin;

  constructor(app: App, plugin: RssWindowCapturePlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    const lang: UiLanguage = this.plugin.settings.uiLanguage === "en" ? "en" : "ko";
    const t = (ko: string, en: string): string => (lang === "ko" ? ko : en);
    const simpleMode = this.plugin.settings.simpleSettingsMode !== false;

    containerEl.createEl("h2", { text: t("RSS 인사이트", "RSS Insight") });

    new Setting(containerEl)
      .setName(t("설정 언어", "Settings language"))
      .setDesc(
        t(
          "설정창 언어를 선택합니다. 한 번에 한 언어만 표시됩니다.",
          "Choose the settings UI language. Only one language is shown at a time.",
        ),
      )
      .addDropdown((dropdown) =>
        dropdown
          .addOption("ko", "한국어")
          .addOption("en", "English")
          .setValue(this.plugin.settings.uiLanguage)
          .onChange(async (value) => {
            this.plugin.settings.uiLanguage = value === "en" ? "en" : "ko";
              await this.plugin.saveSettings();
              this.display();
            }),
      );

    new Setting(containerEl)
      .setName(t("고급 옵션 표시", "Show advanced options"))
      .setDesc(
        t(
          "끄면 핵심 설정만 보입니다. (추천: 끔)",
          "Turn off to show only essential settings. (Recommended: off)",
        ),
      )
      .addToggle((toggle) =>
        toggle.setValue(!simpleMode).onChange(async (value) => {
          this.plugin.settings.simpleSettingsMode = !value;
          await this.plugin.saveSettings();
          this.display();
        }),
      );

    containerEl.createEl("h3", { text: t("빠른 시작", "Quick Start") });

    const applyQuickPreset = async (mode: "balanced" | "strict"): Promise<void> => {
      this.plugin.settings.topicRelevanceFilterEnabled = true;
      this.plugin.settings.topicPriorityEnabled = true;
      this.plugin.settings.topicPriorityOrder = DEFAULT_SETTINGS.topicPriorityOrder;
      this.plugin.settings.topicPriorityMaxBoost = mode === "strict" ? 7 : 5;
      this.plugin.settings.topicRelevanceMinScore = mode === "strict" ? 4 : 2;
      this.plugin.settings.topicDiversityMinPerTopic = 2;
      this.plugin.settings.topicMaxItemsPerTopic = 3;
      this.plugin.settings.topicDiversityPenaltyPerSelected = mode === "strict" ? 1.5 : 1.2;
      this.plugin.settings.maxItemsPerWindow = mode === "strict" ? 16 : 22;
      if (this.plugin.settings.adaptiveItemCapMax < this.plugin.settings.maxItemsPerWindow) {
        this.plugin.settings.adaptiveItemCapMax = this.plugin.settings.maxItemsPerWindow;
      }

      await this.plugin.saveSettings();
      const message = mode === "strict"
        ? t("엄격 필터 프리셋을 적용했습니다.", "Applied strict filtering preset.")
        : t("균형형 프리셋을 적용했습니다.", "Applied balanced preset.");
      new Notice(message, 4000);
      this.display();
    };

    new Setting(containerEl)
      .setName(t("초보자 추천 프리셋", "Beginner preset"))
      .setDesc(
        t(
          "버튼 한 번으로 관련성/우선순위 기본값을 맞춥니다.",
          "Apply relevance/priority defaults in one click.",
        ),
      )
      .addButton((button) =>
        button.setButtonText(t("균형형", "Balanced")).onClick(async () => {
          await applyQuickPreset("balanced");
        }),
      )
      .addButton((button) =>
        button.setButtonText(t("엄격형", "Strict")).onClick(async () => {
          await applyQuickPreset("strict");
        }),
      );

    new Setting(containerEl)
      .setName(t("생성 노트 미리보기", "Note preview"))
      .setDesc(
        t(
          "현재 설정 기준으로 생성될 노트 형식을 미리 확인합니다.",
          "Preview the generated note format with current settings.",
        ),
      )
      .addButton((button) =>
        button.setButtonText(t("미리보기 열기", "Open preview")).onClick(() => {
          this.plugin.openNotePreviewModal();
        }),
      );

    const topicCoverageSetting = new Setting(containerEl)
      .setName(t("토픽별 피드 개수 점검", "Topic feed count check"))
      .setDesc(formatTopicFeedCoverageDiagnostic(this.plugin.settings.feeds, lang));
    let recommendedCoverageSetting: Setting | null = null;

    new Setting(containerEl)
      .setName(t("자동 수집", "Auto fetch"))
      .setDesc(
        t(
          "Obsidian이 열려 있는 동안 매분 수집 대상 윈도우를 확인하고 실행합니다.",
          "Check and run due windows every minute while Obsidian is open.",
        ),
      )
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.autoFetchEnabled).onChange(async (value) => {
          this.plugin.settings.autoFetchEnabled = value;
          await this.plugin.saveSettings();
          if (value) {
            void this.plugin.runDueWindows("settings");
          }
        }),
      );

    new Setting(containerEl)
      .setName(t("수집 시간", "Schedule times"))
      .setDesc(t("쉼표로 구분한 HH:MM 형식. 예: 08:00,17:00", "Comma-separated HH:MM values. Example: 08:00,17:00"))
      .addText((text) =>
        text
          .setPlaceholder("08:00,17:00")
          .setValue(this.plugin.settings.scheduleTimes)
          .onChange(async (value) => {
            this.plugin.settings.scheduleTimes = value;
            await this.plugin.saveSettings();
          }),
      );

    const parsedTimes = parseScheduleMinutes(this.plugin.settings.scheduleTimes);
    new Setting(containerEl)
      .setName(t("해석된 시간", "Parsed times"))
      .setDesc(
        parsedTimes.length > 0
          ? parsedTimes.map((minutes) => minutesToToken(minutes)).join(", ")
          : t("유효한 수집 시간이 없습니다", "No valid schedule times"),
      );

    if (!simpleMode) {
      new Setting(containerEl)
        .setName(t("시작 시 누락 보충", "Catch up on startup"))
        .setDesc(
          t(
            "Obsidian 시작 시 마지막 포인터 이후 놓친 윈도우를 보충 수집합니다.",
            "When Obsidian starts, capture missed windows since the last pointer.",
          ),
        )
        .addToggle((toggle) =>
          toggle.setValue(this.plugin.settings.startupCatchupEnabled).onChange(async (value) => {
            this.plugin.settings.startupCatchupEnabled = value;
            await this.plugin.saveSettings();
          }),
        );

      new Setting(containerEl)
        .setName(t("1회 실행당 최대 보충 윈도우", "Max catch-up windows per run"))
        .setDesc(
          t(
            "한 번 실행에서 처리할 보충 윈도우 상한입니다. 누락이 더 많으면 다음 틱에서 계속 처리합니다.",
            "Safety cap for one run. If missed windows are larger, the next tick keeps catching up.",
          ),
        )
        .addText((text) =>
          text
            .setPlaceholder("10")
            .setValue(String(this.plugin.settings.maxCatchupWindowsPerRun))
            .onChange(async (value) => {
              const parsed = Number(value);
              if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 100) {
                this.plugin.settings.maxCatchupWindowsPerRun = Math.floor(parsed);
                await this.plugin.saveSettings();
              }
            }),
        );
    }

    new Setting(containerEl)
      .setName(t("기본 최대 항목 수(윈도우당)", "Base max items per window"))
      .setDesc(
        t(
          "자동 확장 적용 전, 품질 선별의 기본 상한입니다.",
          "Base target for quality-selected items before adaptive expansion.",
        ),
      )
      .addText((text) =>
        text
          .setPlaceholder("20")
          .setValue(String(this.plugin.settings.maxItemsPerWindow))
          .onChange(async (value) => {
            const parsed = Number(value);
            if (Number.isFinite(parsed) && parsed >= MIN_BASE_ITEMS_PER_WINDOW && parsed <= MAX_BASE_ITEMS_PER_WINDOW) {
              this.plugin.settings.maxItemsPerWindow = Math.floor(parsed);
              if (this.plugin.settings.adaptiveItemCapMax < this.plugin.settings.maxItemsPerWindow) {
                this.plugin.settings.adaptiveItemCapMax = this.plugin.settings.maxItemsPerWindow;
              }
              await this.plugin.saveSettings();
              this.display();
            }
          }),
      );

    if (!simpleMode) {
      new Setting(containerEl)
        .setName(t("최대 항목 자동 확장", "Adaptive max items"))
        .setDesc(
          t(
            "활성 피드/토픽 수에 따라 유효 상한을 자동으로 늘립니다.",
            "Auto-expand effective cap based on enabled feed/topic count.",
          ),
        )
        .addToggle((toggle) =>
          toggle.setValue(this.plugin.settings.adaptiveItemCapEnabled).onChange(async (value) => {
            this.plugin.settings.adaptiveItemCapEnabled = value;
            await this.plugin.saveSettings();
            this.display();
          }),
        );

      new Setting(containerEl)
        .setName(t("자동 확장 최대치", "Adaptive cap upper bound"))
        .setDesc(
          t(
            "자동 확장을 켰을 때 올라갈 수 있는 최대 상한입니다.",
            "Maximum effective cap when adaptive mode is enabled.",
          ),
        )
        .addText((text) =>
          text
            .setPlaceholder("50")
            .setValue(String(this.plugin.settings.adaptiveItemCapMax))
            .onChange(async (value) => {
              const parsed = Number(value);
              if (Number.isFinite(parsed) && parsed >= this.plugin.settings.maxItemsPerWindow && parsed <= MAX_BASE_ITEMS_PER_WINDOW) {
                this.plugin.settings.adaptiveItemCapMax = Math.floor(parsed);
                await this.plugin.saveSettings();
                this.display();
              }
            }),
        );

      const enabledFeedsForPreview = this.plugin.settings.feeds.filter(
        (feed) => feed.enabled && feed.url.trim().length > 0,
      );
      const topicCountForPreview = new Set(
        enabledFeedsForPreview.map((feed) => normalizeTopic(feed.topic || "Uncategorized")),
      ).size;
      new Setting(containerEl)
        .setName(t("유효 상한 미리보기", "Effective cap preview"))
        .setDesc(
          t(
            `현재: ${this.plugin.getEffectiveMaxItemsPreview()}개 (활성 피드: ${enabledFeedsForPreview.length}, 토픽: ${topicCountForPreview})`,
            `Now: ${this.plugin.getEffectiveMaxItemsPreview()} items (enabled feeds: ${enabledFeedsForPreview.length}, topics: ${topicCountForPreview})`,
          ),
        );
    }

    new Setting(containerEl)
      .setName(t("토픽별 최소 확보 개수", "Topic diversity minimum per topic"))
      .setDesc(
        t(
          "가중치 채우기 전에 토픽별로 최소 이 개수만큼 먼저 확보합니다. 권장: 2",
          "Try to keep at least this many items per topic before weighted fill.",
        ),
      )
      .addText((text) =>
        text
          .setPlaceholder("2")
          .setValue(String(this.plugin.settings.topicDiversityMinPerTopic))
          .onChange(async (value) => {
            const parsed = Number(value);
            if (
              Number.isFinite(parsed)
              && parsed >= MIN_TOPIC_DIVERSITY_PER_TOPIC
              && parsed <= MAX_TOPIC_DIVERSITY_PER_TOPIC
            ) {
              const next = Math.floor(parsed);
              this.plugin.settings.topicDiversityMinPerTopic = Math.min(
                next,
                this.plugin.settings.topicMaxItemsPerTopic,
              );
              await this.plugin.saveSettings();
              this.display();
            }
          }),
      );

    new Setting(containerEl)
      .setName(t("토픽별 최대 허용 개수", "Topic max items per topic"))
      .setDesc(
        t(
          "한 토픽에서 너무 많이 뽑히지 않도록 상한을 둡니다. 권장: 3 (4개 미만)",
          "Upper cap per topic to avoid over-concentration. Recommended: 3 (under 4).",
        ),
      )
      .addText((text) =>
        text
          .setPlaceholder("3")
          .setValue(String(this.plugin.settings.topicMaxItemsPerTopic))
          .onChange(async (value) => {
            const parsed = Number(value);
            if (
              Number.isFinite(parsed)
              && parsed >= MIN_TOPIC_MAX_ITEMS_PER_TOPIC
              && parsed <= MAX_TOPIC_MAX_ITEMS_PER_TOPIC
            ) {
              this.plugin.settings.topicMaxItemsPerTopic = Math.floor(parsed);
              if (this.plugin.settings.topicDiversityMinPerTopic > this.plugin.settings.topicMaxItemsPerTopic) {
                this.plugin.settings.topicDiversityMinPerTopic = this.plugin.settings.topicMaxItemsPerTopic;
              }
              await this.plugin.saveSettings();
              this.display();
            }
          }),
      );

    new Setting(containerEl)
      .setName(t("토픽 분산 페널티", "Topic diversity penalty"))
      .setDesc(
        t(
          "값이 높을수록 토픽 분산이 강해집니다. 0이면 순수 품질 순서입니다.",
          "Higher value spreads topics more aggressively. 0 = pure quality order.",
        ),
      )
      .addText((text) =>
        text
          .setPlaceholder("1.25")
          .setValue(String(this.plugin.settings.topicDiversityPenaltyPerSelected))
          .onChange(async (value) => {
            const parsed = Number(value);
            if (
              Number.isFinite(parsed)
              && parsed >= MIN_TOPIC_DIVERSITY_PENALTY
              && parsed <= MAX_TOPIC_DIVERSITY_PENALTY
            ) {
              this.plugin.settings.topicDiversityPenaltyPerSelected = Math.round(parsed * 100) / 100;
              await this.plugin.saveSettings();
            }
          }),
      );

    new Setting(containerEl)
      .setName(t("출력 폴더", "Output folder"))
      .setDesc(t("수집 노트를 저장할 Vault 기준 폴더입니다.", "Vault-relative folder where capture notes are written."))
      .addText((text) =>
        text
          .setPlaceholder("000-Inbox/RSS")
          .setValue(this.plugin.settings.outputFolder)
          .onChange(async (value) => {
            this.plugin.settings.outputFolder = value.trim();
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName(t("파일명 접두어", "Filename prefix"))
      .setDesc(t("생성되는 노트 파일명 앞부분입니다.", "Prefix used for generated note filenames."))
      .addText((text) =>
        text
          .setPlaceholder("rss-capture")
          .setValue(this.plugin.settings.filePrefix)
          .onChange(async (value) => {
            this.plugin.settings.filePrefix = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName(t("설명 포함", "Include description"))
      .setDesc(t("각 기사 아래에 feed description/summary를 함께 기록합니다.", "Add feed description/summary text under each item."))
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.includeDescription).onChange(async (value) => {
          this.plugin.settings.includeDescription = value;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName(t("설명 최대 길이", "Description max length"))
      .setDesc(t("각 설명 블록의 최대 글자 수입니다.", "Maximum characters for each description block."))
      .addText((text) =>
        text
          .setPlaceholder("500")
          .setValue(String(this.plugin.settings.descriptionMaxLength))
          .onChange(async (value) => {
            const parsed = Number(value);
            if (Number.isFinite(parsed) && parsed > 0) {
              this.plugin.settings.descriptionMaxLength = Math.floor(parsed);
              await this.plugin.saveSettings();
            }
          }),
      );

    new Setting(containerEl)
      .setName(t("빈 노트도 생성", "Write empty notes"))
      .setDesc(t("결과가 없어도 리포트 노트를 생성합니다.", "If enabled, create a note even when no items are found."))
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.writeEmptyNote).onChange(async (value) => {
          this.plugin.settings.writeEmptyNote = value;
          await this.plugin.saveSettings();
        }),
      );

    if (!simpleMode) {
      containerEl.createEl("h3", { text: t("번역", "Translation") });

      new Setting(containerEl)
        .setName(t("번역 사용", "Enable translation"))
        .setDesc(t("노트 작성 시 비한글 항목을 자동 번역합니다.", "Translate non-Korean items while writing notes."))
        .addToggle((toggle) =>
          toggle.setValue(this.plugin.settings.translationEnabled).onChange(async (value) => {
            this.plugin.settings.translationEnabled = value;
            await this.plugin.saveSettings();
            this.display();
          }),
        );

      new Setting(containerEl)
        .setName(t("번역 제공자", "Translation provider"))
        .setDesc(
          t(
            "웹 번역은 로컬 AI 없이 동작합니다. Ollama는 선택한 로컬 모델을 사용합니다.",
            "Web mode works without local AI. Ollama mode uses local model you choose.",
          ),
        )
        .addDropdown((dropdown) =>
          dropdown
            .addOption("web", t("웹 번역(로컬 AI 없음)", "Web translate (no local AI)"))
            .addOption("ollama", t("로컬 Ollama", "Local Ollama"))
            .addOption("none", t("사용 안 함", "Disabled"))
            .setValue(this.plugin.settings.translationProvider)
            .onChange(async (value) => {
              this.plugin.settings.translationProvider =
                value === "web" || value === "ollama" || value === "none" ? value : "web";
              await this.plugin.saveSettings();
              this.display();
            }),
        );

      new Setting(containerEl)
        .setName(t("대상 언어", "Target language"))
        .setDesc(t("ko, en, ja 같은 ISO 코드.", "ISO code like ko, en, ja."))
        .addText((text) =>
          text
            .setPlaceholder("ko")
            .setValue(this.plugin.settings.translationTargetLanguage)
            .onChange(async (value) => {
              const normalized = value.trim().toLowerCase();
              if (normalized) {
                this.plugin.settings.translationTargetLanguage = normalized;
                await this.plugin.saveSettings();
              }
            }),
        );

      new Setting(containerEl)
        .setName(t("비한글만 번역", "Translate only non-Korean"))
        .setDesc(t("한글이 포함된 텍스트는 번역하지 않습니다.", "If enabled, text already containing Hangul is skipped."))
        .addToggle((toggle) =>
          toggle
            .setValue(this.plugin.settings.translationOnlyNonKorean)
            .onChange(async (value) => {
              this.plugin.settings.translationOnlyNonKorean = value;
              await this.plugin.saveSettings();
            }),
        );

      new Setting(containerEl)
        .setName(t("원문 유지", "Keep original text"))
        .setDesc(t("번역을 추가할 때 원문 설명을 아래에 함께 유지합니다.", "When translation is added, keep original description below it."))
        .addToggle((toggle) =>
          toggle.setValue(this.plugin.settings.translationKeepOriginal).onChange(async (value) => {
            this.plugin.settings.translationKeepOriginal = value;
            await this.plugin.saveSettings();
          }),
        );

      new Setting(containerEl)
        .setName(t("제목 번역", "Translate title"))
        .setDesc(t("기사 제목을 번역합니다.", "Translate item titles."))
        .addToggle((toggle) =>
          toggle.setValue(this.plugin.settings.translationTranslateTitle).onChange(async (value) => {
            this.plugin.settings.translationTranslateTitle = value;
            await this.plugin.saveSettings();
          }),
        );

      new Setting(containerEl)
        .setName(t("설명 번역", "Translate description"))
        .setDesc(t("description/summary 블록을 번역합니다.", "Translate description/summary blocks."))
        .addToggle((toggle) =>
          toggle
            .setValue(this.plugin.settings.translationTranslateDescription)
            .onChange(async (value) => {
              this.plugin.settings.translationTranslateDescription = value;
              await this.plugin.saveSettings();
            }),
        );

      if (this.plugin.settings.translationProvider === "web") {
        new Setting(containerEl)
          .setName(t("웹 번역 엔드포인트", "Web translation endpoint"))
          .setDesc(t("기본 엔드포인트는 보통 API 키 없이 동작합니다.", "Default endpoint usually works without API key."))
          .addText((text) =>
            text
              .setPlaceholder("https://translate.googleapis.com/translate_a/single")
              .setValue(this.plugin.settings.translationWebEndpoint)
              .onChange(async (value) => {
                const normalized = normalizeHttpBaseUrl(value);
                if (normalized) {
                  this.plugin.settings.translationWebEndpoint = normalized;
                  await this.plugin.saveSettings();
                }
              }),
          );
      }

      if (this.plugin.settings.translationProvider === "ollama") {
        new Setting(containerEl)
          .setName(t("Ollama 기본 URL", "Ollama base URL"))
          .setDesc(t("예시: http://127.0.0.1:11434", "Example: http://127.0.0.1:11434"))
          .addText((text) =>
            text
              .setPlaceholder("http://127.0.0.1:11434")
              .setValue(this.plugin.settings.ollamaBaseUrl)
              .onChange(async (value) => {
                const normalized = normalizeHttpBaseUrl(value);
                if (normalized) {
                  this.plugin.settings.ollamaBaseUrl = normalized;
                  await this.plugin.saveSettings();
                }
              }),
          );

        const modelOptions = this.plugin.getOllamaModelOptionsForUi();
        const recommendedModel = this.plugin.getRecommendedOllamaModelForUi();
        const modelDescription = recommendedModel
          ? t(
              `탐지됨: ${modelOptions.length} / 추천: ${recommendedModel}`,
              `Detected: ${modelOptions.length} / Recommended: ${recommendedModel}`,
            )
          : t("탐지된 모델이 없습니다. 먼저 새로고침하세요.", "No detected models yet. Click refresh first.");

        new Setting(containerEl)
          .setName(t("Ollama 모델", "Ollama model"))
          .setDesc(modelDescription)
          .addDropdown((dropdown) => {
            if (modelOptions.length === 0) {
              dropdown.addOption("", t("(먼저 모델 새로고침)", "(refresh models first)"));
            } else {
              for (const model of modelOptions) {
                dropdown.addOption(model, model);
              }
            }

            const defaultValue = this.plugin.settings.ollamaModel || modelOptions[0] || "";
            dropdown.setValue(defaultValue).onChange(async (value) => {
              this.plugin.settings.ollamaModel = value;
              await this.plugin.saveSettings();
            });

            return dropdown;
          })
          .addButton((button) =>
            button.setButtonText(t("모델 새로고침", "Refresh models")).onClick(async () => {
              await this.plugin.refreshOllamaModels(true);
              this.display();
            }),
          );

        new Setting(containerEl)
          .setName(t("마지막 모델 새로고침", "Last model refresh"))
          .setDesc(this.plugin.settings.ollamaLastModelRefreshIso || t("아직 새로고침 안 됨", "Not refreshed yet"));
      }
    }

    containerEl.createEl("h3", { text: t("필터링 · 중복제거 · 점수", "Filtering, Dedupe, Scoring") });

    if (!simpleMode) {
      new Setting(containerEl)
        .setName(t("고급 중복 제거", "Enhanced dedupe"))
        .setDesc(t("정규화된 링크/제목을 사용해 피드 간 중복을 제거합니다.", "Deduplicate across feeds using normalized link/title."))
        .addToggle((toggle) =>
          toggle.setValue(this.plugin.settings.enhancedDedupeEnabled).onChange(async (value) => {
            this.plugin.settings.enhancedDedupeEnabled = value;
            await this.plugin.saveSettings();
          }),
        );

      new Setting(containerEl)
        .setName(t("키워드 필터", "Keyword filter"))
        .setDesc(t("수집 항목에 포함/제외 키워드 필터를 적용합니다.", "Apply include/exclude keyword filter to collected items."))
        .addToggle((toggle) =>
          toggle.setValue(this.plugin.settings.keywordFilterEnabled).onChange(async (value) => {
            this.plugin.settings.keywordFilterEnabled = value;
            await this.plugin.saveSettings();
          }),
        );

      new Setting(containerEl)
        .setName(t("포함 키워드", "Include keywords"))
        .setDesc(t("쉼표 또는 줄바꿈으로 구분. 하나라도 매칭되면 통과.", "Comma or newline separated. Match any keyword."))
        .addTextArea((text) =>
          text.setPlaceholder("ai, bitcoin, fed")
            .setValue(this.plugin.settings.includeKeywords)
            .onChange(async (value) => {
              this.plugin.settings.includeKeywords = value;
              await this.plugin.saveSettings();
            }),
        );

      new Setting(containerEl)
        .setName(t("제외 키워드", "Exclude keywords"))
        .setDesc(t("쉼표 또는 줄바꿈으로 구분. 매칭되면 제외.", "Comma or newline separated. Exclude if matched."))
        .addTextArea((text) =>
          text.setPlaceholder("sponsored, advertisement")
            .setValue(this.plugin.settings.excludeKeywords)
            .onChange(async (value) => {
              this.plugin.settings.excludeKeywords = value;
              await this.plugin.saveSettings();
            }),
        );
    }

    new Setting(containerEl)
      .setName(t("토픽 관련성 필터", "Topic relevance filter"))
      .setDesc(
        t(
          "피드 토픽(인공지능/교육/부동산/주식/비트코인/정치)에 맞는 기사만 통과시킵니다.",
          "Keep only items that match the feed topic (AI/Education/Real Estate/Stocks/Bitcoin/Politics).",
        ),
      )
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.topicRelevanceFilterEnabled).onChange(async (value) => {
          this.plugin.settings.topicRelevanceFilterEnabled = value;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName(t("토픽 관련성 최소 점수", "Minimum topic relevance score"))
      .setDesc(
        t(
          "높일수록 무관 기사 제거가 강해집니다. 권장: 2~4",
          "Higher value removes off-topic items more aggressively. Recommended: 2-4",
        ),
      )
      .addText((text) =>
        text
          .setPlaceholder("2")
          .setValue(String(this.plugin.settings.topicRelevanceMinScore))
          .onChange(async (value) => {
            const parsed = Number(value);
            if (
              Number.isFinite(parsed)
              && parsed >= MIN_TOPIC_RELEVANCE_MIN_SCORE
              && parsed <= MAX_TOPIC_RELEVANCE_MIN_SCORE
            ) {
              this.plugin.settings.topicRelevanceMinScore = Math.floor(parsed);
              await this.plugin.saveSettings();
            }
          }),
      );

    new Setting(containerEl)
      .setName(t("토픽 우선순위 가중치", "Topic priority weighting"))
      .setDesc(
        t(
          "우선순위 기반으로 기사 점수에 가중치를 줍니다.",
          "Apply ranking boost by topic priority.",
        ),
      )
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.topicPriorityEnabled).onChange(async (value) => {
          this.plugin.settings.topicPriorityEnabled = value;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName(t("토픽 우선순위 순서", "Topic priority order"))
      .setDesc(
        t(
          "쉼표/줄바꿈으로 입력. 예: 인공지능, 교육, 대한민국 부동산, 주식, 비트코인, 정치",
          "Comma/newline list. Example: AI, Education, Korea Real Estate, Stocks, Bitcoin, Politics",
        ),
      )
      .addTextArea((text) =>
        text
          .setPlaceholder(DEFAULT_SETTINGS.topicPriorityOrder)
          .setValue(this.plugin.settings.topicPriorityOrder)
          .onChange(async (value) => {
            this.plugin.settings.topicPriorityOrder = value;
            refreshPriorityDiagnostics();
            await this.plugin.saveSettings();
          }),
      );

    const priorityPreviewSetting = new Setting(containerEl)
      .setName(t("적용 우선순위 미리보기", "Applied priority preview"))
      .setDesc(formatTopicPriorityDiagnostic(this.plugin.settings.topicPriorityOrder, lang));

    const priorityFeedAlignmentSetting = new Setting(containerEl)
      .setName(t("실시간 피드 반영 상태", "Live feed alignment"))
      .setDesc(
        formatPriorityFeedAlignmentDiagnostic(
          this.plugin.settings.topicPriorityOrder,
          this.plugin.settings.feeds,
          lang,
        ),
      );

    new Setting(containerEl)
      .setName(t("피드 토픽에서 우선순위 동기화", "Sync priority from feed topics"))
      .setDesc(
        t(
          "현재 피드 목록의 토픽 분포를 기준으로 우선순위 입력값을 자동 채웁니다.",
          "Auto-fill priority order from current feed topic distribution.",
        ),
      )
      .addButton((button) =>
        button.setButtonText(t("지금 반영", "Sync now")).onClick(async () => {
          this.plugin.settings.topicPriorityOrder = buildPriorityOrderFromFeedTopics(
            this.plugin.settings.feeds,
            lang,
          );
          await this.plugin.saveSettings();
          refreshPriorityDiagnostics();
          new Notice(
            t("피드 토픽 기준으로 우선순위를 동기화했습니다.", "Priority order synced from feed topics."),
            4000,
          );
        }),
      );

    const refreshPriorityDiagnostics = (): void => {
      priorityPreviewSetting.setDesc(
        formatTopicPriorityDiagnostic(this.plugin.settings.topicPriorityOrder, lang),
      );
      priorityFeedAlignmentSetting.setDesc(
        formatPriorityFeedAlignmentDiagnostic(
          this.plugin.settings.topicPriorityOrder,
          this.plugin.settings.feeds,
          lang,
        ),
      );
      topicCoverageSetting.setDesc(formatTopicFeedCoverageDiagnostic(this.plugin.settings.feeds, lang));
      if (recommendedCoverageSetting) {
        recommendedCoverageSetting.setDesc(
          formatRecommendedFeedCoverageDiagnostic(
            this.plugin.settings.feeds,
            this.plugin.settings.topicPriorityOrder,
            lang,
          ),
        );
      }
    };

    new Setting(containerEl)
      .setName(t("우선순위 최대 가중치", "Priority max boost"))
      .setDesc(
        t(
          "첫 번째 우선순위 토픽에 부여할 최대 점수입니다. 0이면 비활성.",
          "Maximum score boost for the top-priority topic. 0 disables boost.",
        ),
      )
      .addText((text) =>
        text
          .setPlaceholder("6")
          .setValue(String(this.plugin.settings.topicPriorityMaxBoost))
          .onChange(async (value) => {
            const parsed = Number(value);
            if (
              Number.isFinite(parsed)
              && parsed >= MIN_TOPIC_PRIORITY_MAX_BOOST
              && parsed <= MAX_TOPIC_PRIORITY_MAX_BOOST
            ) {
              this.plugin.settings.topicPriorityMaxBoost = Math.round(parsed * 100) / 100;
              await this.plugin.saveSettings();
              refreshPriorityDiagnostics();
            }
          }),
      );

    new Setting(containerEl)
      .setName(t("선호도 학습 적용", "Apply preference learning"))
      .setDesc(
        t(
          "직접 표시한 선호/비선호 피드백을 기사 선별 점수에 반영합니다.",
          "Use your like/dislike feedback to adjust ranking.",
        ),
      )
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.preferenceLearningEnabled).onChange(async (value) => {
          this.plugin.settings.preferenceLearningEnabled = value;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName(t("피드백 체크박스 출력", "Write feedback checkboxes"))
      .setDesc(
        t(
          "각 기사 아래에 선호/비선호 체크박스를 넣어 학습 데이터를 쉽게 남깁니다.",
          "Write like/dislike checkboxes under each item for easy feedback.",
        ),
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.preferenceFeedbackTemplateEnabled)
          .onChange(async (value) => {
            this.plugin.settings.preferenceFeedbackTemplateEnabled = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName(t("선호도 점수 가중치", "Preference score weight"))
      .setDesc(
        t(
          "학습 점수가 최종 순위에 미치는 영향도입니다. 권장: 1~3",
          "How strongly learned preference affects final ranking. Recommended: 1-3",
        ),
      )
      .addText((text) =>
        text
          .setPlaceholder("2")
          .setValue(String(this.plugin.settings.preferenceScoreWeight))
          .onChange(async (value) => {
            const parsed = Number(value);
            if (
              Number.isFinite(parsed)
              && parsed >= MIN_PREFERENCE_SCORE_WEIGHT
              && parsed <= MAX_PREFERENCE_SCORE_WEIGHT
            ) {
              this.plugin.settings.preferenceScoreWeight = Math.round(parsed * 100) / 100;
              await this.plugin.saveSettings();
            }
          }),
      );

    const learnedTokenCount = Object.keys(this.plugin.settings.preferenceTokenWeights || {}).length;
    const learnedStatus = this.plugin.settings.preferenceLastLearnedAtIso
      ? t(
          `마지막 학습: ${this.plugin.settings.preferenceLastLearnedAtIso} / 토큰 ${learnedTokenCount}개`,
          `Last learned: ${this.plugin.settings.preferenceLastLearnedAtIso} / tokens ${learnedTokenCount}`,
        )
      : t(`아직 학습 안 됨 / 토큰 ${learnedTokenCount}개`, `Not learned yet / tokens ${learnedTokenCount}`);

    new Setting(containerEl)
      .setName(t("선호도 학습 상태", "Preference learning status"))
      .setDesc(learnedStatus)
      .addButton((button) =>
        button.setButtonText(t("지금 학습", "Learn now")).onClick(async () => {
          await this.plugin.refreshPreferenceLearningProfile(true);
          this.display();
        }),
      );

    if (!simpleMode) {
      new Setting(containerEl)
        .setName(t("점수 템플릿", "Score template"))
        .setDesc(t("각 기사 아래에 기본 4요소 점수 라인을 추가합니다.", "Add default 4-factor score lines under each item."))
        .addToggle((toggle) =>
          toggle.setValue(this.plugin.settings.scoreTemplateEnabled).onChange(async (value) => {
            this.plugin.settings.scoreTemplateEnabled = value;
            await this.plugin.saveSettings();
          }),
        );

      new Setting(containerEl)
        .setName(t("기본 점수값", "Default score value"))
        .setDesc(t("Impact/Actionability/Timing/Confidence의 기본값(1-5).", "Default value for Impact/Actionability/Timing/Confidence (1-5)."))
        .addText((text) =>
          text
            .setPlaceholder("3")
            .setValue(String(this.plugin.settings.scoreDefaultValue))
            .onChange(async (value) => {
              const parsed = Number(value);
              if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 5) {
                this.plugin.settings.scoreDefaultValue = Math.floor(parsed);
                await this.plugin.saveSettings();
              }
            }),
        );

      new Setting(containerEl)
        .setName(t("액션 임계값", "Action threshold"))
        .setDesc(t("액션 후보 판단용 총점 기준값입니다.", "Score total threshold reference for action candidates."))
        .addText((text) =>
          text
            .setPlaceholder("14")
            .setValue(String(this.plugin.settings.scoreActionThreshold))
            .onChange(async (value) => {
              const parsed = Number(value);
              if (Number.isFinite(parsed) && parsed > 0) {
                this.plugin.settings.scoreActionThreshold = Math.floor(parsed);
                await this.plugin.saveSettings();
              }
            }),
        );

      new Setting(containerEl)
        .setName(t("마지막 윈도우 포인터", "Last window pointer"))
        .setDesc(this.plugin.settings.lastWindowEndIso || t("아직 설정되지 않음", "Not set yet"))
        .addButton((button) =>
          button.setButtonText(t("초기화", "Reset")).onClick(async () => {
            this.plugin.settings.lastWindowEndIso = "";
            await this.plugin.saveSettings();
            this.display();
          }),
        );

      containerEl.createEl("h3", { text: t("RSS Dashboard 동기화", "RSS Dashboard Sync") });

      new Setting(containerEl)
        .setName(t("RSS Dashboard 동기화 사용", "Enable RSS Dashboard sync"))
        .setDesc(t("RSS Dashboard data.json의 피드 목록을 자동 가져옵니다.", "Auto-import feed list from RSS Dashboard data.json."))
        .addToggle((toggle) =>
          toggle.setValue(this.plugin.settings.rssDashboardSyncEnabled).onChange(async (value) => {
            this.plugin.settings.rssDashboardSyncEnabled = value;
            await this.plugin.saveSettings();
          }),
        );

      new Setting(containerEl)
        .setName(t("RSS Dashboard 데이터 경로", "RSS Dashboard data path"))
        .setDesc(t("RSS Dashboard 설정 파일의 Vault 기준 경로입니다.", "Vault-relative path to RSS Dashboard settings file."))
        .addText((text) =>
          text
            .setPlaceholder(".obsidian/plugins/rss-dashboard/data.json")
            .setValue(this.plugin.settings.rssDashboardDataPath)
            .onChange(async (value) => {
              this.plugin.settings.rssDashboardDataPath =
                value.trim() || DEFAULT_SETTINGS.rssDashboardDataPath;
              await this.plugin.saveSettings();
            }),
        );

      const syncedFeedCount = this.plugin.settings.feeds.filter(
        (feed) => feed.source === "rss-dashboard",
      ).length;
      const syncStatus = this.plugin.settings.rssDashboardLastSyncAtIso
        ? t(
            `마지막 동기화: ${this.plugin.settings.rssDashboardLastSyncAtIso} / 동기화 피드: ${syncedFeedCount}`,
            `Last sync: ${this.plugin.settings.rssDashboardLastSyncAtIso} / synced feeds: ${syncedFeedCount}`,
          )
        : t(`아직 동기화 안 됨 / 동기화 피드: ${syncedFeedCount}`, `No sync yet / synced feeds: ${syncedFeedCount}`);

      new Setting(containerEl)
        .setName(t("동기화 상태", "Dashboard sync status"))
        .setDesc(syncStatus)
        .addButton((button) =>
          button.setButtonText(t("지금 동기화", "Sync now")).onClick(async () => {
            await this.plugin.syncFeedsFromRssDashboard(true, true);
            this.display();
          }),
        );
    }

    containerEl.createEl("h3", { text: t("피드 목록", "Feeds") });

    recommendedCoverageSetting = new Setting(containerEl)
      .setName(t("추천 피드 적용 현황", "Recommended feed status"))
      .setDesc(
        formatRecommendedFeedCoverageDiagnostic(
          this.plugin.settings.feeds,
          this.plugin.settings.topicPriorityOrder,
          lang,
        ),
      );

    new Setting(containerEl)
      .setName(t("추천 RSS 자동 추가", "Auto add recommended RSS"))
      .setDesc(
        t(
          "신뢰도 높은 추천 피드를 주제별로 자동 채웁니다. (우선순위 + 실시간 피드 개수 기준)",
          "Auto-fill trusted recommended feeds by topic (priority + live feed counts).",
        ),
      )
      .addButton((button) =>
        button.setButtonText(t("목록 보기", "Preview list")).onClick(() => {
          this.plugin.openRecommendedFeedsModal();
        }),
      )
      .addButton((button) =>
        button.setButtonText(t("주제당 2개 채우기", "Fill 2/topic")).onClick(async () => {
          await this.plugin.addRecommendedFeedsByTarget(RECOMMENDED_MIN_FEEDS_PER_TOPIC, true);
          this.display();
        }),
      )
      .addButton((button) =>
        button.setButtonText(t("주제당 3개 채우기", "Fill 3/topic")).onClick(async () => {
          await this.plugin.addRecommendedFeedsByTarget(RECOMMENDED_MAX_FEEDS_PER_TOPIC, true);
          this.display();
        }),
      );

    if (!simpleMode) {
      new Setting(containerEl)
        .setName(t("인터넷 검색 피드 추가", "Add web-search feeds"))
        .setDesc(
          t(
            "Google News 검색 RSS를 우선순위 토픽별로 1개씩 추가합니다. (보조용)",
            "Add one Google News search RSS feed per priority topic. (supplementary)",
          ),
        )
        .addButton((button) =>
          button.setButtonText(t("검색 피드 추가", "Add search feeds")).onClick(async () => {
            await this.plugin.addGoogleNewsSearchFeedsForPriority(true);
            this.display();
          }),
        );
    }

    new Setting(containerEl)
      .setName(t("피드 추가", "Add feed"))
      .setDesc(t("토픽 라벨과 함께 RSS/Atom 피드를 추가합니다.", "Add an RSS/Atom feed with a topic label."))
      .addButton((button) =>
        button.setButtonText(t("추가", "Add")).onClick(async () => {
          const orderedTopics = parseTopicPriorityOrder(this.plugin.settings.topicPriorityOrder);
          const defaultTopicKey = orderedTopics[0] || DEFAULT_TOPIC_PRIORITY_KEYS[0];
          this.plugin.settings.feeds.push({
            id: createFeedId(),
            topic: getTopicLabel(defaultTopicKey, lang),
            name: "",
            url: "",
            enabled: true,
            source: "manual",
          });
          await this.plugin.saveSettings();
          this.display();
        }),
      );

    if (this.plugin.settings.feeds.length === 0) {
      containerEl.createEl("p", {
        text: t("아직 피드가 없습니다. 수집을 시작하려면 최소 1개 피드를 추가하세요.", "No feeds configured yet. Add at least one feed to start capturing."),
      });
      return;
    }

    this.plugin.settings.feeds.forEach((feed, index) => {
      const row = containerEl.createDiv({ cls: "rss-insight-feed-row" });
      const sourceLabel = feed.source === "rss-dashboard"
        ? t("RSS Dashboard 동기화", "RSS Dashboard sync")
        : t("수동", "Manual");

      new Setting(row)
        .setName(`${t("피드", "Feed")} ${index + 1}`)
        .setDesc(`${sourceLabel} / ${t("이 피드를 켜거나 삭제할 수 있습니다.", "Enable or remove this feed.")}`)
        .addToggle((toggle) =>
          toggle.setValue(feed.enabled).onChange(async (value) => {
            feed.enabled = value;
            await this.plugin.saveSettings();
            refreshPriorityDiagnostics();
          }),
        )
        .addExtraButton((button) =>
          button.setIcon("trash").setTooltip(t("피드 삭제", "Delete feed")).onClick(async () => {
            this.plugin.settings.feeds = this.plugin.settings.feeds.filter(
              (candidate) => candidate.id !== feed.id,
            );
            await this.plugin.saveSettings();
            this.display();
          }),
        );

      new Setting(row)
        .setName(t("토픽", "Topic"))
        .setDesc(t("출력 노트의 섹션 제목으로 사용됩니다.", "Used as section heading in output notes."))
        .addText((text) =>
          text.setValue(feed.topic).onChange(async (value) => {
            feed.topic = normalizeTopic(value);
            await this.plugin.saveSettings();
            refreshPriorityDiagnostics();
          }),
        );

      new Setting(row)
        .setName(t("피드 이름", "Feed name"))
        .setDesc(t("이 소스의 표시 이름입니다.", "Display name for this source."))
        .addText((text) =>
          text.setValue(feed.name).onChange(async (value) => {
            feed.name = value.trim();
            await this.plugin.saveSettings();
          }),
        );

      new Setting(row)
        .setName(t("피드 URL", "Feed URL"))
        .setDesc(t("RSS 또는 Atom URL.", "RSS or Atom URL."))
        .addText((text) =>
          text
            .setPlaceholder("https://example.com/rss")
            .setValue(feed.url)
            .onChange(async (value) => {
              feed.url = value.trim();
              await this.plugin.saveSettings();
              refreshPriorityDiagnostics();
            }),
        );
    });
  }
}
