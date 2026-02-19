"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => RssWindowCapturePlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");
var DEFAULT_SETTINGS = {
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
  topicPriorityOrder: "\uC778\uACF5\uC9C0\uB2A5,\uAD50\uC721,\uB300\uD55C\uBBFC\uAD6D \uBD80\uB3D9\uC0B0,\uC8FC\uC2DD,\uBE44\uD2B8\uCF54\uC778,\uC815\uCE58",
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
  feeds: []
};
var SCHEDULER_TICK_MS = 60 * 1e3;
var MAX_TRANSLATION_INPUT_LENGTH = 2e3;
var TRANSLATED_DESCRIPTION_MAX_LENGTH = 300;
var MAX_DESCRIPTION_ENRICH_ITEMS_PER_WINDOW = 40;
var MIN_BASE_ITEMS_PER_WINDOW = 10;
var MAX_BASE_ITEMS_PER_WINDOW = 250;
var TOPIC_RELEVANCE_WEIGHT = 3;
var MAX_KEYWORD_MATCHES_PER_BUCKET = 4;
var MIN_TOPIC_RELEVANCE_MIN_SCORE = -2;
var MAX_TOPIC_RELEVANCE_MIN_SCORE = 10;
var MIN_TOPIC_PRIORITY_MAX_BOOST = 0;
var MAX_TOPIC_PRIORITY_MAX_BOOST = 12;
var MIN_TOPIC_MAX_ITEMS_PER_TOPIC = 1;
var MAX_TOPIC_MAX_ITEMS_PER_TOPIC = 3;
var TOPIC_MISMATCH_MIN_BEST_SCORE = 4;
var TOPIC_MISMATCH_MIN_GAP = 2;
var MIN_PREFERENCE_SCORE_WEIGHT = 0;
var MAX_PREFERENCE_SCORE_WEIGHT = 8;
var MAX_PREFERENCE_TOKEN_COUNT = 400;
var PREFERENCE_TOKEN_MIN_ABS_WEIGHT = 2;
var PREFERENCE_MARKER_PREFER = "rss-insight:prefer";
var PREFERENCE_MARKER_AVOID = "rss-insight:avoid";
var PREFERENCE_STOPWORDS = /* @__PURE__ */ new Set([
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
  "\uC774",
  "\uADF8",
  "\uC800",
  "\uBC0F",
  "\uB4F1",
  "\uC218",
  "\uAC83",
  "\uD558\uB2E4",
  "\uD588\uB2E4",
  "\uC788\uB294",
  "\uC704\uD55C",
  "\uB300\uD55C",
  "\uC5D0\uC11C",
  "\uC73C\uB85C",
  "\uD558\uACE0",
  "\uAD00\uB828"
]);
var MIN_TOPIC_DIVERSITY_PER_TOPIC = 0;
var MAX_TOPIC_DIVERSITY_PER_TOPIC = 3;
var MIN_TOPIC_DIVERSITY_PENALTY = 0;
var MAX_TOPIC_DIVERSITY_PENALTY = 5;
var RECOMMENDED_MIN_FEEDS_PER_TOPIC = 2;
var RECOMMENDED_MAX_FEEDS_PER_TOPIC = 3;
var GOOGLE_NEWS_RSS_BASE_URL = "https://news.google.com/rss/search";
var DEFAULT_TOPIC_PRIORITY_KEYS = [
  "ai",
  "education",
  "korea-real-estate",
  "stocks",
  "bitcoin",
  "politics"
];
var GOOGLE_NEWS_QUERY_BY_TOPIC = {
  ai: "\uC778\uACF5\uC9C0\uB2A5 OR LLM OR OpenAI",
  education: "\uAD50\uC721 \uC815\uCC45 OR edtech OR \uD559\uAD50",
  "korea-real-estate": "\uB300\uD55C\uBBFC\uAD6D \uBD80\uB3D9\uC0B0 OR \uC544\uD30C\uD2B8 OR \uC804\uC138 OR \uCCAD\uC57D",
  stocks: "\uC8FC\uC2DD OR \uC99D\uC2DC OR \uCF54\uC2A4\uD53C OR \uCF54\uC2A4\uB2E5",
  bitcoin: "\uBE44\uD2B8\uCF54\uC778 OR \uC554\uD638\uD654\uD3D0 OR BTC",
  politics: "\uD55C\uAD6D \uC815\uCE58 OR \uAD6D\uD68C OR \uC815\uBD80 \uC815\uCC45"
};
var RECOMMENDED_FEED_TEMPLATES = [
  {
    topicKey: "ai",
    name: "OpenAI News",
    url: "https://openai.com/news/rss.xml",
    trustNote: "Official"
  },
  {
    topicKey: "ai",
    name: "Google AI Blog",
    url: "https://blog.google/technology/ai/rss/",
    trustNote: "Official"
  },
  {
    topicKey: "ai",
    name: "arXiv cs.AI",
    url: "https://arxiv.org/rss/cs.AI",
    trustNote: "Research"
  },
  {
    topicKey: "education",
    name: "The Hechinger Report",
    url: "https://hechingerreport.org/feed/",
    trustNote: "Education newsroom"
  },
  {
    topicKey: "education",
    name: "Education Next",
    url: "https://www.educationnext.org/feed/",
    trustNote: "Education policy journal"
  },
  {
    topicKey: "education",
    name: "The 74",
    url: "https://www.the74million.org/feed/",
    trustNote: "Education newsroom"
  },
  {
    topicKey: "korea-real-estate",
    name: "\uD55C\uAD6D\uACBD\uC81C | \uBD80\uB3D9\uC0B0",
    url: "https://www.hankyung.com/feed/realestate",
    trustNote: "Major media (KR)"
  },
  {
    topicKey: "korea-real-estate",
    name: "\uB9E4\uC77C\uACBD\uC81C | \uBD80\uB3D9\uC0B0",
    url: "https://www.mk.co.kr/rss/50300009/",
    trustNote: "Major media (KR)"
  },
  {
    topicKey: "korea-real-estate",
    name: "\uB300\uD55C\uBBFC\uAD6D \uC815\uCC45\uBE0C\uB9AC\uD551 | \uBCF4\uB3C4\uC790\uB8CC",
    url: "https://www.korea.kr/rss/pressrelease.xml",
    trustNote: "Official (KR gov)"
  },
  {
    topicKey: "stocks",
    name: "\uD55C\uAD6D\uACBD\uC81C | \uAE08\uC735\xB7\uC99D\uAD8C",
    url: "https://www.hankyung.com/feed/finance",
    trustNote: "Major media (KR)"
  },
  {
    topicKey: "stocks",
    name: "\uB9E4\uC77C\uACBD\uC81C | \uC99D\uAD8C",
    url: "https://www.mk.co.kr/rss/50200011/",
    trustNote: "Major media (KR)"
  },
  {
    topicKey: "stocks",
    name: "\uC5F0\uD569\uB274\uC2A4TV | \uACBD\uC81C",
    url: "http://www.yonhapnewstv.co.kr/category/news/economy/feed/",
    trustNote: "Major media (KR)"
  },
  {
    topicKey: "bitcoin",
    name: "CoinDesk",
    url: "https://www.coindesk.com/arc/outboundfeeds/rss/",
    trustNote: "Major media"
  },
  {
    topicKey: "bitcoin",
    name: "Cointelegraph",
    url: "https://cointelegraph.com/rss",
    trustNote: "Major media"
  },
  {
    topicKey: "bitcoin",
    name: "Decrypt",
    url: "https://decrypt.co/feed",
    trustNote: "Crypto newsroom"
  },
  {
    topicKey: "politics",
    name: "\uD55C\uAD6D\uACBD\uC81C | \uC815\uCE58",
    url: "https://www.hankyung.com/feed/politics",
    trustNote: "Major media (KR)"
  },
  {
    topicKey: "politics",
    name: "\uC5F0\uD569\uB274\uC2A4TV | \uC815\uCE58",
    url: "http://www.yonhapnewstv.co.kr/category/news/politics/feed/",
    trustNote: "Major media (KR)"
  },
  {
    topicKey: "politics",
    name: "\uB300\uD55C\uBBFC\uAD6D \uC815\uCC45\uBE0C\uB9AC\uD551 | \uC815\uCC45",
    url: "https://www.korea.kr/rss/policy.xml",
    trustNote: "Official (KR gov)"
  }
];
var KOREA_INDICATOR_KEYWORDS = [
  "\uB300\uD55C\uBBFC\uAD6D",
  "\uD55C\uAD6D",
  "\uAD6D\uB0B4",
  "\uC11C\uC6B8",
  "\uACBD\uAE30",
  "\uC778\uCC9C",
  "\uBD80\uC0B0",
  "\uB300\uAD6C",
  "\uAD11\uC8FC",
  "\uB300\uC804",
  "\uC6B8\uC0B0",
  "\uC138\uC885",
  "\uC81C\uC8FC"
];
var TOPIC_RELEVANCE_PROFILES = {
  ai: {
    aliases: ["\uC778\uACF5\uC9C0\uB2A5", "ai", "a.i", "llm", "\uBA38\uC2E0\uB7EC\uB2DD", "\uB525\uB7EC\uB2DD", "\uC0DD\uC131\uD615", "artificial intelligence"],
    highSignalKeywords: [
      "\uC778\uACF5\uC9C0\uB2A5",
      "ai",
      "llm",
      "gpt",
      "chatgpt",
      "openai",
      "anthropic",
      "deepmind",
      "\uC0DD\uC131\uD615",
      "\uBA38\uC2E0\uB7EC\uB2DD",
      "\uB525\uB7EC\uB2DD",
      "foundation model",
      "large language model",
      "\uBA40\uD2F0\uBAA8\uB2EC",
      "\uCD94\uB860 \uBAA8\uB378",
      "\uC5D0\uC774\uC804\uD2B8",
      "agentic",
      "gpu",
      "tpu",
      "npu"
    ],
    normalKeywords: [
      "model",
      "\uBAA8\uB378",
      "fine-tuning",
      "rag",
      "vector",
      "prompt",
      "alignment",
      "inference",
      "training",
      "ai safety"
    ],
    negativeKeywords: ["\uAD11\uACE0", "\uD504\uB85C\uBAA8\uC158", "\uD611\uCC2C"]
  },
  education: {
    aliases: ["\uAD50\uC721", "edtech", "school", "student", "education"],
    highSignalKeywords: [
      "\uAD50\uC721",
      "\uAD50\uC0AC",
      "\uD559\uC0DD",
      "\uD559\uAD50",
      "\uB300\uD559",
      "\uC218\uB2A5",
      "\uC785\uC2DC",
      "\uAD50\uC721\uBD80",
      "\uAD50\uACFC",
      "edtech",
      "curriculum",
      "tuition",
      "scholarship"
    ],
    normalKeywords: [
      "\uD559\uC2B5",
      "\uD559\uBD80\uBAA8",
      "\uC720\uC544\uAD50\uC721",
      "\uCD08\uB4F1",
      "\uC911\uB4F1",
      "\uACE0\uB4F1",
      "\uD3C9\uC0DD\uAD50\uC721",
      "\uC628\uB77C\uC778 \uAC15\uC758"
    ],
    negativeKeywords: ["\uAD11\uACE0", "\uD64D\uBCF4", "\uC5F0\uC608"]
  },
  "korea-real-estate": {
    aliases: [
      "\uB300\uD55C\uBBFC\uAD6D \uBD80\uB3D9\uC0B0",
      "\uD55C\uAD6D \uBD80\uB3D9\uC0B0",
      "\uAD6D\uB0B4 \uBD80\uB3D9\uC0B0",
      "\uBD80\uB3D9\uC0B0",
      "real estate",
      "korea real estate",
      "kr real estate"
    ],
    highSignalKeywords: [
      "\uBD80\uB3D9\uC0B0",
      "\uC544\uD30C\uD2B8",
      "\uC8FC\uD0DD",
      "\uBD84\uC591",
      "\uCCAD\uC57D",
      "\uC804\uC138",
      "\uC6D4\uC138",
      "\uB9E4\uB9E4",
      "\uC7AC\uAC74\uCD95",
      "\uC7AC\uAC1C\uBC1C",
      "pf",
      "\uAD6D\uD1A0\uAD50\uD1B5\uBD80",
      "\uAD6D\uD1A0\uBD80",
      "lh",
      "\uACF5\uC2DC\uC9C0\uAC00",
      "\uBCF4\uAE08\uC790\uB9AC\uB860",
      "dti",
      "dsr",
      "ltv"
    ],
    normalKeywords: [
      "\uC784\uB300",
      "\uC624\uD53C\uC2A4\uD154",
      "\uC8FC\uB2F4\uB300",
      "\uBBF8\uBD84\uC591",
      "\uC785\uC8FC",
      "\uC6A9\uC801\uB960",
      "gtx",
      "\uD1A0\uC9C0\uAC70\uB798\uD5C8\uAC00",
      "housing",
      "property market"
    ],
    negativeKeywords: ["\uD574\uC678 \uBD80\uB3D9\uC0B0", "\uBBF8\uAD6D \uC8FC\uD0DD", "\uC911\uAD6D \uBD80\uB3D9\uC0B0", "commercial real estate only"]
  },
  stocks: {
    aliases: ["\uC8FC\uC2DD", "\uC99D\uAD8C", "stock", "stocks", "equity", "equities", "\uAD6D\uB0B4\uC8FC\uC2DD", "\uD574\uC678\uC8FC\uC2DD"],
    highSignalKeywords: [
      "\uC8FC\uC2DD",
      "\uC99D\uC2DC",
      "\uCF54\uC2A4\uD53C",
      "\uCF54\uC2A4\uB2E5",
      "\uCF54\uC2A4\uD53C200",
      "\uB098\uC2A4\uB2E5",
      "s&p",
      "dow",
      "stock",
      "equity",
      "earnings",
      "\uC2E4\uC801",
      "ipo",
      "\uACF5\uBAA8\uC8FC",
      "\uBC30\uB2F9",
      "per",
      "pbr",
      "eps",
      "\uB9E4\uC218",
      "\uB9E4\uB3C4"
    ],
    normalKeywords: [
      "\uB9AC\uC11C\uCE58",
      "target price",
      "\uD22C\uC790\uC758\uACAC",
      "\uBC38\uB958\uC5D0\uC774\uC158",
      "fund flow",
      "etf",
      "\uC2DC\uC7A5 \uB9C8\uAC10"
    ],
    negativeKeywords: ["\uC554\uD638\uD654\uD3D0", "\uBE44\uD2B8\uCF54\uC778", "\uC5F0\uC608", "\uC2A4\uD3EC\uCE20"]
  },
  bitcoin: {
    aliases: ["\uBE44\uD2B8\uCF54\uC778", "bitcoin", "btc", "\uC554\uD638\uD654\uD3D0", "\uCF54\uC778", "crypto", "cryptocurrency"],
    highSignalKeywords: [
      "\uBE44\uD2B8\uCF54\uC778",
      "bitcoin",
      "btc",
      "\uC554\uD638\uD654\uD3D0",
      "crypto",
      "\uBE14\uB85D\uCCB4\uC778",
      "stablecoin",
      "\uC2A4\uD14C\uC774\uBE14\uCF54\uC778",
      "ethereum",
      "eth",
      "on-chain",
      "hashrate",
      "\uCC44\uAD74",
      "digital asset",
      "token",
      "defi",
      "etf",
      "sec"
    ],
    normalKeywords: ["\uAC70\uB798\uC18C", "wallet", "custody", "web3", "layer 2", "\uC9C0\uAC11", "\uD1A0\uD070\uD654"],
    negativeKeywords: ["\uC8FC\uD0DD", "\uC544\uD30C\uD2B8", "\uC57C\uAD6C", "\uC5F0\uC608"]
  },
  politics: {
    aliases: ["\uC815\uCE58", "\uC815\uBD80", "\uAD6D\uD68C", "policy", "policies", "election", "politics"],
    highSignalKeywords: [
      "\uC815\uCE58",
      "\uC815\uBD80",
      "\uAD6D\uD68C",
      "\uB300\uD1B5\uB839",
      "\uCD1D\uB9AC",
      "\uC7A5\uAD00",
      "\uC5EC\uB2F9",
      "\uC57C\uB2F9",
      "\uC120\uAC70",
      "\uACF5\uC57D",
      "\uC678\uAD50",
      "\uC548\uBCF4",
      "\uBC95\uC548",
      "\uC815\uCC45",
      "ministr",
      "parliament",
      "cabinet"
    ],
    normalKeywords: ["\uD589\uC815", "\uADDC\uC81C", "\uAD6D\uC815", "\uCCAD\uBB38\uD68C", "\uACF5\uCCAD\uD68C", "\uC815\uBB34\uC704", "\uC704\uC6D0\uD68C"],
    negativeKeywords: ["\uC2A4\uD3EC\uCE20", "\uC5F0\uC608", "\uAD11\uACE0"]
  }
};
var TRACKING_QUERY_KEYS = /* @__PURE__ */ new Set([
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
  "spm"
]);
var OLLAMA_MODEL_RECOMMENDATION_PATTERNS = [
  /qwen2\.5/i,
  /qwen3/i,
  /llama3(\.1)?/i,
  /exaone/i,
  /gemma/i,
  /mistral/i,
  /phi/i
];
var SITE_SPECIFIC_DESCRIPTION_RULES = [
  {
    hosts: [/(^|\.)hankyung\.com$/i],
    selectors: [
      'meta[property="og:description"]',
      'meta[name="description"]',
      ".article-body p",
      ".article_txt p",
      "article p"
    ]
  },
  {
    hosts: [/(^|\.)donga\.com$/i],
    selectors: [
      'meta[property="og:description"]',
      'meta[name="description"]',
      "#article_txt p",
      ".article_txt p",
      "article p"
    ]
  },
  {
    hosts: [/(^|\.)yonhapnewstv\.co\.kr$/i],
    selectors: [
      'meta[property="og:description"]',
      'meta[name="description"]',
      ".article_txt p",
      ".news-article p",
      "article p"
    ]
  },
  {
    hosts: [/(^|\.)coindesk\.com$/i, /(^|\.)cointelegraph\.com$/i],
    selectors: [
      'meta[property="og:description"]',
      'meta[name="description"]',
      "article p",
      "main p"
    ]
  }
];
function createFeedId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
function buildDeterministicFeedId(url) {
  let hash = 5381;
  for (let i = 0; i < url.length; i += 1) {
    hash = (hash << 5) + hash ^ url.charCodeAt(i);
  }
  const unsigned = hash >>> 0;
  return `rssd-${unsigned.toString(36)}`;
}
function normalizeTopic(raw) {
  const cleaned = raw.trim();
  if (!cleaned) {
    return "Uncategorized";
  }
  return cleaned;
}
function normalizeKeywordHaystack(raw) {
  return raw.toLowerCase();
}
function parseKeywordList(raw) {
  const out = /* @__PURE__ */ new Set();
  for (const token of raw.split(/[\n,]/)) {
    const trimmed = token.trim().toLowerCase();
    if (trimmed) {
      out.add(trimmed);
    }
  }
  return Array.from(out.values());
}
function matchesKeywordFilter(haystack, includeKeywords, excludeKeywords) {
  if (excludeKeywords.some((keyword) => haystack.includes(keyword))) {
    return false;
  }
  if (includeKeywords.length === 0) {
    return true;
  }
  return includeKeywords.some((keyword) => haystack.includes(keyword));
}
function isPrioritizedTopicKey(topicKey) {
  return topicKey !== "other";
}
function countKeywordHits(haystack, keywords) {
  let hits = 0;
  for (const keyword of keywords) {
    if (keyword && matchesRelevanceKeyword(haystack, keyword)) {
      hits += 1;
    }
  }
  return hits;
}
function escapeRegexPattern(raw) {
  return raw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function matchesRelevanceKeyword(haystack, keyword) {
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
      "i"
    );
    return pattern.test(haystack);
  }
  return haystack.includes(normalizedKeyword);
}
function resolveCanonicalTopicKey(rawTopic) {
  const normalizedTopic = normalizeKeywordHaystack(rawTopic.trim());
  if (!normalizedTopic) {
    return "other";
  }
  const entries = Object.entries(TOPIC_RELEVANCE_PROFILES);
  for (const [topicKey, profile] of entries) {
    if (profile.aliases.some((alias) => normalizedTopic.includes(alias))) {
      return topicKey;
    }
  }
  let bestTopic = "other";
  let bestScore = 0;
  for (const [topicKey, profile] of entries) {
    const keywordPool = [...profile.aliases, ...profile.highSignalKeywords];
    const score = keywordPool.reduce((acc, keyword) => keyword && normalizedTopic.includes(keyword) ? acc + 1 : acc, 0);
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
function splitTopicPriorityTokens(raw) {
  return raw.split(/[\n,>|;/]+/).map((token) => token.trim()).filter((token) => token.length > 0);
}
function parseTopicPriorityOrderWithDiagnostics(raw) {
  const source = raw.trim() || DEFAULT_SETTINGS.topicPriorityOrder;
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  const unknownTokens = [];
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
    unknownTokens
  };
}
function parseTopicPriorityOrder(raw) {
  return parseTopicPriorityOrderWithDiagnostics(raw).ordered;
}
function buildTopicRelevanceHaystack(feed, item) {
  return normalizeKeywordHaystack(
    `${item.title}
${item.description}
${item.link}
${feed.name}
${feed.topic}`
  );
}
function buildPreferenceFeatureText(feed, item) {
  const host = getHostnameFromUrl(item.link);
  return normalizePlainText(
    `${feed.topic}
${feed.name}
${item.title}
${item.description}
${host}`
  );
}
function tokenizePreferenceText(raw) {
  const normalized = normalizeKeywordHaystack(normalizePlainText(raw)).replace(/https?:\/\/\S+/g, " ");
  const tokens = normalized.split(/[^\p{L}\p{N}]+/u).map((token) => token.trim()).filter((token) => token.length >= 2 && token.length <= 40).filter((token) => !/^\d+$/.test(token)).filter((token) => !PREFERENCE_STOPWORDS.has(token));
  return Array.from(new Set(tokens));
}
function scoreTopicRelevance(topicKey, haystack) {
  if (!isPrioritizedTopicKey(topicKey)) {
    return 0;
  }
  const profile = TOPIC_RELEVANCE_PROFILES[topicKey];
  const highHits = Math.min(
    MAX_KEYWORD_MATCHES_PER_BUCKET,
    countKeywordHits(haystack, profile.highSignalKeywords)
  );
  const normalHits = Math.min(
    MAX_KEYWORD_MATCHES_PER_BUCKET,
    countKeywordHits(haystack, profile.normalKeywords)
  );
  const negativeHits = Math.min(
    MAX_KEYWORD_MATCHES_PER_BUCKET,
    countKeywordHits(haystack, profile.negativeKeywords)
  );
  let score = highHits * 2 + normalHits - negativeHits * 2;
  if (topicKey === "korea-real-estate") {
    const koreaHits = Math.min(
      MAX_KEYWORD_MATCHES_PER_BUCKET,
      countKeywordHits(haystack, KOREA_INDICATOR_KEYWORDS)
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
function buildTopicScoreMap(haystack) {
  const out = /* @__PURE__ */ new Map();
  for (const topicKey of DEFAULT_TOPIC_PRIORITY_KEYS) {
    out.set(topicKey, scoreTopicRelevance(topicKey, haystack));
  }
  return out;
}
function inferPrimaryTopicFromHaystack(haystack) {
  const scores = buildTopicScoreMap(haystack);
  let bestKey = DEFAULT_TOPIC_PRIORITY_KEYS[0];
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const [topicKey, score] of scores.entries()) {
    if (score > bestScore) {
      bestKey = topicKey;
      bestScore = score;
    }
  }
  return { key: bestKey, score: bestScore, scores };
}
function getTopicPriorityBoost(topicKey, orderedKeys, maxBoost) {
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
  return Math.max(0, Math.round((maxBoost - index * step) * 100) / 100);
}
function formatTopicPriorityPreview(orderedKeys, lang) {
  return orderedKeys.map((key) => getTopicLabel(key, lang)).join(" > ");
}
function formatTopicPriorityDiagnostic(raw, lang) {
  const parsed = parseTopicPriorityOrderWithDiagnostics(raw);
  const applied = formatTopicPriorityPreview(parsed.ordered, lang);
  if (parsed.unknownTokens.length === 0) {
    return lang === "ko" ? `\uC801\uC6A9 \uC21C\uC11C: ${applied}` : `Applied order: ${applied}`;
  }
  const unknown = parsed.unknownTokens.join(", ");
  return lang === "ko" ? `\uC801\uC6A9 \uC21C\uC11C: ${applied} / \uC778\uC2DD \uBD88\uAC00: ${unknown}` : `Applied order: ${applied} / Unrecognized: ${unknown}`;
}
function getTopicLabel(topicKey, lang) {
  const labelsKo = {
    ai: "\uC778\uACF5\uC9C0\uB2A5",
    education: "\uAD50\uC721",
    "korea-real-estate": "\uB300\uD55C\uBBFC\uAD6D \uBD80\uB3D9\uC0B0",
    stocks: "\uC8FC\uC2DD",
    bitcoin: "\uBE44\uD2B8\uCF54\uC778",
    politics: "\uC815\uCE58"
  };
  const labelsEn = {
    ai: "AI",
    education: "Education",
    "korea-real-estate": "Korea Real Estate",
    stocks: "Stocks",
    bitcoin: "Bitcoin",
    politics: "Politics"
  };
  return (lang === "ko" ? labelsKo : labelsEn)[topicKey];
}
function formatTopicFeedCoverageDiagnostic(feeds, lang) {
  var _a;
  const counts = /* @__PURE__ */ new Map();
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
    counts.set(key, ((_a = counts.get(key)) != null ? _a : 0) + 1);
  }
  const parts = DEFAULT_TOPIC_PRIORITY_KEYS.map((key) => {
    var _a2;
    const count = (_a2 = counts.get(key)) != null ? _a2 : 0;
    const label = getTopicLabel(key, lang);
    let mark;
    if (count < RECOMMENDED_MIN_FEEDS_PER_TOPIC) {
      mark = lang === "ko" ? "\uBD80\uC871" : "Low";
    } else if (count > RECOMMENDED_MAX_FEEDS_PER_TOPIC) {
      mark = lang === "ko" ? "\uCD08\uACFC" : "High";
    } else {
      mark = lang === "ko" ? "\uC801\uC815" : "OK";
    }
    return `${label} ${count} (${mark})`;
  });
  const targetLabel = lang === "ko" ? `${RECOMMENDED_MIN_FEEDS_PER_TOPIC}~${RECOMMENDED_MAX_FEEDS_PER_TOPIC}\uAC1C \uAD8C\uC7A5` : `Recommended ${RECOMMENDED_MIN_FEEDS_PER_TOPIC}-${RECOMMENDED_MAX_FEEDS_PER_TOPIC}`;
  return `${targetLabel}: ${parts.join(" | ")}`;
}
function normalizeFeedUrlForCompare(raw) {
  return raw.trim().toLowerCase().replace(/\/+$/, "");
}
function buildGoogleNewsSearchFeedUrl(query) {
  return `${GOOGLE_NEWS_RSS_BASE_URL}?q=${encodeURIComponent(query)}&hl=ko&gl=KR&ceid=KR:ko`;
}
function buildPriorityOrderFromFeedTopics(feeds, lang) {
  const seen = /* @__PURE__ */ new Set();
  const ordered = [];
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
function formatPriorityFeedAlignmentDiagnostic(rawPriority, feeds, lang) {
  var _a;
  const parsed = parseTopicPriorityOrderWithDiagnostics(rawPriority);
  const counts = /* @__PURE__ */ new Map();
  const unknownFeedTopics = /* @__PURE__ */ new Set();
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
      counts.set(key, ((_a = counts.get(key)) != null ? _a : 0) + 1);
    } else {
      unknownFeedTopics.add(topicText);
    }
  }
  const coverageParts = parsed.ordered.map((key) => {
    var _a2;
    return `${getTopicLabel(key, lang)} ${(_a2 = counts.get(key)) != null ? _a2 : 0}`;
  });
  const missingFromFeeds = parsed.ordered.filter((key) => {
    var _a2;
    return ((_a2 = counts.get(key)) != null ? _a2 : 0) === 0;
  }).map((key) => getTopicLabel(key, lang));
  const missingFromPriority = DEFAULT_TOPIC_PRIORITY_KEYS.filter((key) => {
    var _a2;
    return ((_a2 = counts.get(key)) != null ? _a2 : 0) > 0 && !parsed.ordered.includes(key);
  }).map((key) => getTopicLabel(key, lang));
  const pieces = [];
  pieces.push(
    lang === "ko" ? `\uD65C\uC131 \uD53C\uB4DC \uBC18\uC601: ${coverageParts.join(" | ")}` : `Enabled feed alignment: ${coverageParts.join(" | ")}`
  );
  if (missingFromFeeds.length > 0) {
    pieces.push(
      lang === "ko" ? `\uD53C\uB4DC \uC5C6\uC74C: ${missingFromFeeds.join(", ")}` : `No feed yet: ${missingFromFeeds.join(", ")}`
    );
  }
  if (missingFromPriority.length > 0) {
    pieces.push(
      lang === "ko" ? `\uC6B0\uC120\uC21C\uC704\uC5D0 \uBBF8\uD3EC\uD568: ${missingFromPriority.join(", ")}` : `Not in priority: ${missingFromPriority.join(", ")}`
    );
  }
  if (unknownFeedTopics.size > 0) {
    pieces.push(
      lang === "ko" ? `\uC778\uC2DD \uBD88\uAC00 \uD53C\uB4DC \uD1A0\uD53D: ${Array.from(unknownFeedTopics).join(", ")}` : `Unrecognized feed topics: ${Array.from(unknownFeedTopics).join(", ")}`
    );
  }
  return pieces.join(" / ");
}
function formatRecommendedFeedCoverageDiagnostic(feeds, priorityOrderRaw, lang) {
  const parsedOrder = parseTopicPriorityOrder(priorityOrderRaw);
  const ordered = parsedOrder.length > 0 ? parsedOrder : [...DEFAULT_TOPIC_PRIORITY_KEYS];
  const existingUrlSet = new Set(
    feeds.map((feed) => normalizeFeedUrlForCompare(feed.url)).filter((url) => url.length > 0)
  );
  const parts = ordered.map((topicKey) => {
    const totalCandidates = RECOMMENDED_FEED_TEMPLATES.filter((feed) => feed.topicKey === topicKey).length;
    const alreadyAdded = RECOMMENDED_FEED_TEMPLATES.filter(
      (feed) => feed.topicKey === topicKey && existingUrlSet.has(normalizeFeedUrlForCompare(feed.url))
    ).length;
    return `${getTopicLabel(topicKey, lang)} ${alreadyAdded}/${totalCandidates}`;
  });
  return lang === "ko" ? `\uCD94\uCC9C \uD53C\uB4DC \uC801\uC6A9 \uD604\uD669: ${parts.join(" | ")}` : `Recommended feed coverage: ${parts.join(" | ")}`;
}
function containsHangul(raw) {
  return /[가-힣]/.test(raw);
}
function hasAnyLetters(raw) {
  return /\p{L}/u.test(raw);
}
function normalizeHttpBaseUrl(raw) {
  return raw.trim().replace(/\/+$/, "");
}
function truncateForModelInput(raw) {
  if (raw.length <= MAX_TRANSLATION_INPUT_LENGTH) {
    return raw;
  }
  return `${raw.slice(0, MAX_TRANSLATION_INPUT_LENGTH).trimEnd()}...`;
}
function formatYmd(date) {
  if (!date) {
    return "";
  }
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}
function normalizeTitleForDedupe(raw) {
  return raw.toLowerCase().replace(/\s+/g, " ").replace(/[^\p{L}\p{N}\s]/gu, "").trim();
}
function canonicalizeLinkForDedupe(raw) {
  const trimmed = raw.trim();
  if (!trimmed) {
    return "";
  }
  try {
    const parsed = new URL(trimmed);
    parsed.hash = "";
    const keepPairs = [];
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
  } catch (e) {
    return trimmed.split("#")[0];
  }
}
function looksLikeLowSignalTitle(raw) {
  const normalized = raw.toLowerCase();
  return /(광고|협찬|이벤트|promo|promoted|sponsored|advertisement|newsletter)/i.test(normalized);
}
function looksLikeArticleLink(raw) {
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
  } catch (e) {
    return false;
  }
}
function scoreWindowItemQuality(item, windowEnd) {
  let score = 0;
  if (item.published) {
    const ageMinutes = Math.max(0, (windowEnd.getTime() - item.published.getTime()) / 6e4);
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
function getRowTopic(row) {
  return row.feed.topic.trim() || "Uncategorized";
}
function selectRowsWithTopicDiversity(rankedRows, limit, minPerTopic, maxPerTopic, penaltyPerSelected) {
  var _a, _b, _c, _d, _e, _f;
  if (limit <= 0 || rankedRows.length === 0) {
    return [];
  }
  const perTopic = /* @__PURE__ */ new Map();
  for (const entry of rankedRows) {
    const topic = getRowTopic(entry.row);
    if (!perTopic.has(topic)) {
      perTopic.set(topic, []);
    }
    (_a = perTopic.get(topic)) == null ? void 0 : _a.push(entry);
  }
  const selected = [];
  const selectedByTopic = /* @__PURE__ */ new Map();
  const effectiveMaxPerTopic = Math.max(1, maxPerTopic);
  const effectiveMinPerTopic = Math.max(0, Math.min(minPerTopic, effectiveMaxPerTopic));
  const sortedTopicsByTopScore = () => Array.from(perTopic.entries()).filter(([, queue]) => queue.length > 0).sort((a, b) => {
    var _a2, _b2, _c2, _d2, _e2, _f2, _g, _h;
    const aTop = (_b2 = (_a2 = a[1][0]) == null ? void 0 : _a2.totalScore) != null ? _b2 : Number.NEGATIVE_INFINITY;
    const bTop = (_d2 = (_c2 = b[1][0]) == null ? void 0 : _c2.totalScore) != null ? _d2 : Number.NEGATIVE_INFINITY;
    if (aTop !== bTop) {
      return bTop - aTop;
    }
    const aQuality = (_f2 = (_e2 = a[1][0]) == null ? void 0 : _e2.qualityScore) != null ? _f2 : Number.NEGATIVE_INFINITY;
    const bQuality = (_h = (_g = b[1][0]) == null ? void 0 : _g.qualityScore) != null ? _h : Number.NEGATIVE_INFINITY;
    if (aQuality !== bQuality) {
      return bQuality - aQuality;
    }
    return a[0].localeCompare(b[0]);
  }).map(([topic]) => topic);
  const takeTopFromTopic = (topic) => {
    var _a2, _b2;
    const queue = perTopic.get(topic);
    if (!queue || queue.length === 0) {
      return false;
    }
    if (((_a2 = selectedByTopic.get(topic)) != null ? _a2 : 0) >= effectiveMaxPerTopic) {
      return false;
    }
    const entry = queue.shift();
    if (!entry) {
      return false;
    }
    selected.push(entry.row);
    selectedByTopic.set(topic, ((_b2 = selectedByTopic.get(topic)) != null ? _b2 : 0) + 1);
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
      const selectedCount = (_b = selectedByTopic.get(topic)) != null ? _b : 0;
      if (selectedCount >= effectiveMaxPerTopic) {
        continue;
      }
      const rawScore = (_d = (_c = queue[0]) == null ? void 0 : _c.totalScore) != null ? _d : Number.NEGATIVE_INFINITY;
      const rawQuality = (_f = (_e = queue[0]) == null ? void 0 : _e.qualityScore) != null ? _f : Number.NEGATIVE_INFINITY;
      const adjustedScore = rawScore - selectedCount * penaltyPerSelected;
      if (adjustedScore > bestAdjustedScore || adjustedScore === bestAdjustedScore && rawScore > bestRawScore || adjustedScore === bestAdjustedScore && rawScore === bestRawScore && rawQuality > bestRawQuality || adjustedScore === bestAdjustedScore && rawScore === bestRawScore && rawQuality === bestRawQuality && topic < bestTopic) {
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
function pad2(value) {
  return String(value).padStart(2, "0");
}
function parseScheduleToken(token) {
  const trimmed = token.trim();
  const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(trimmed);
  if (!match) {
    return null;
  }
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour * 60 + minute;
}
function parseScheduleMinutes(raw) {
  const out = /* @__PURE__ */ new Set();
  for (const token of raw.split(",")) {
    const parsed = parseScheduleToken(token);
    if (parsed !== null) {
      out.add(parsed);
    }
  }
  return Array.from(out.values()).sort((a, b) => a - b);
}
function minutesToToken(minutes) {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${pad2(hour)}:${pad2(minute)}`;
}
function dateAtMinutes(baseDate, minutes) {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return new Date(
    baseDate.getFullYear(),
    baseDate.getMonth(),
    baseDate.getDate(),
    hour,
    minute,
    0,
    0
  );
}
function formatLocalDateTime(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}
function formatFileStamp(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}-${pad2(date.getHours())}${pad2(date.getMinutes())}`;
}
function parseDateMaybe(raw) {
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
function sanitizeFilePart(raw) {
  const replaced = raw.trim().replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-+/, "").replace(/-+$/, "");
  return replaced || "rss-capture";
}
function normalizePlainText(raw) {
  if (!raw) {
    return "";
  }
  return raw.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim();
}
function stripHtml(raw) {
  var _a, _b, _c, _d;
  if (!raw) {
    return "";
  }
  const parser = new DOMParser();
  const doc = parser.parseFromString(raw, "text/html");
  const text = (_d = (_c = (_a = doc.body) == null ? void 0 : _a.textContent) != null ? _c : (_b = doc.documentElement) == null ? void 0 : _b.textContent) != null ? _d : "";
  return normalizePlainText(text);
}
function getHostnameFromUrl(raw) {
  try {
    return new URL(raw).hostname.toLowerCase();
  } catch (e) {
    return "";
  }
}
function readDescriptionBySelectors(doc, selectors) {
  for (const selector of selectors) {
    const elements = Array.from(doc.querySelectorAll(selector));
    for (const element of elements) {
      const value = normalizePlainText(
        (element.getAttribute("content") || element.textContent || "").trim()
      );
      if (value.length >= 20) {
        return value;
      }
    }
  }
  return "";
}
function readSiteSpecificDescription(url, doc) {
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
function readMetaDescription(doc) {
  const selectors = [
    'meta[property="og:description"]',
    'meta[name="twitter:description"]',
    'meta[name="description"]'
  ];
  for (const selector of selectors) {
    const element = doc.querySelector(selector);
    const content = ((element == null ? void 0 : element.getAttribute("content")) || "").trim();
    if (content) {
      return normalizePlainText(content);
    }
  }
  return "";
}
function collectJsonLdTextCandidates(node, out) {
  if (node === null || node === void 0) {
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
  const obj = node;
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    if (lowerKey === "description" || lowerKey === "articlebody" || lowerKey === "headline" || lowerKey === "abstract" || lowerKey === "summary") {
      collectJsonLdTextCandidates(value, out);
      continue;
    }
    if (typeof value === "object" || Array.isArray(value)) {
      collectJsonLdTextCandidates(value, out);
    }
  }
}
function readJsonLdDescription(doc) {
  const scripts = Array.from(
    doc.querySelectorAll('script[type="application/ld+json"]')
  );
  const candidates = [];
  for (const script of scripts) {
    const raw = (script.textContent || "").trim();
    if (!raw) {
      continue;
    }
    try {
      const parsed = JSON.parse(raw);
      collectJsonLdTextCandidates(parsed, candidates);
    } catch (e) {
      continue;
    }
  }
  const filtered = candidates.map((text) => normalizePlainText(text)).filter((text) => text.length >= 40);
  if (filtered.length === 0) {
    return "";
  }
  filtered.sort((a, b) => b.length - a.length);
  return filtered[0];
}
function readBestParagraph(doc) {
  const selectorPriority = [
    ".article-body p",
    ".article_txt p",
    "#article_txt p",
    "article p",
    "main p",
    "p"
  ];
  for (const selector of selectorPriority) {
    const paragraphs = Array.from(doc.querySelectorAll(selector)).map((element) => normalizePlainText(element.textContent || "")).filter((text) => text.length >= 40);
    if (paragraphs.length === 0) {
      continue;
    }
    return paragraphs.slice(0, 2).join("\n\n");
  }
  return "";
}
function truncateText(raw, maxLength) {
  if (raw.length <= maxLength) {
    return raw;
  }
  return `${raw.slice(0, maxLength).trimEnd()}...`;
}
function escapeYamlString(raw) {
  return raw.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
function readChildText(parent, tagNames) {
  var _a;
  for (const tag of tagNames) {
    const lowerTag = tag.toLowerCase();
    for (const child of Array.from(parent.children)) {
      if (child.tagName.toLowerCase() === lowerTag) {
        return normalizePlainText((_a = child.textContent) != null ? _a : "");
      }
    }
  }
  return "";
}
function readAtomLink(entry) {
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
function toItemKey(feed, item) {
  const base = item.id || item.link || `${item.title}::${item.publishedRaw}`;
  return `${feed.url}::${base}`;
}
var RssWindowCapturePlugin = class extends import_obsidian.Plugin {
  constructor() {
    super(...arguments);
    this.runInProgress = false;
    this.translationCache = /* @__PURE__ */ new Map();
  }
  async onload() {
    await this.loadSettings();
    this.addSettingTab(new RssWindowCaptureSettingTab(this.app, this));
    this.addCommand({
      id: "run-due-rss-insight",
      name: "Run due RSS window captures now",
      callback: () => {
        void this.runDueWindows("manual");
      }
    });
    this.addCommand({
      id: "capture-latest-completed-rss-window",
      name: "Capture latest completed RSS window now",
      callback: () => {
        void this.captureLatestCompletedWindow();
      }
    });
    this.addCommand({
      id: "sync-feeds-from-rss-dashboard",
      name: "Sync feeds from RSS Dashboard now",
      callback: () => {
        void this.syncFeedsFromRssDashboard(true, true);
      }
    });
    this.addCommand({
      id: "refresh-ollama-models",
      name: "Refresh Ollama translation models",
      callback: () => {
        void this.refreshOllamaModels(true);
      }
    });
    this.addCommand({
      id: "refresh-preference-learning-profile",
      name: "Refresh preference learning profile",
      callback: () => {
        void this.refreshPreferenceLearningProfile(true);
      }
    });
    this.addCommand({
      id: "preview-rss-note-template",
      name: "Preview RSS note template",
      callback: () => {
        this.openNotePreviewModal();
      }
    });
    this.addCommand({
      id: "preview-recommended-rss-feeds",
      name: "Preview recommended RSS feeds",
      callback: () => {
        this.openRecommendedFeedsModal();
      }
    });
    this.addCommand({
      id: "add-recommended-rss-feeds-minimum",
      name: "Add recommended RSS feeds (target 2 per topic)",
      callback: () => {
        void this.addRecommendedFeedsByTarget(RECOMMENDED_MIN_FEEDS_PER_TOPIC, true);
      }
    });
    this.addCommand({
      id: "add-google-news-search-feeds",
      name: "Add Google News search feeds by topic",
      callback: () => {
        void this.addGoogleNewsSearchFeedsForPriority(true);
      }
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
      }, SCHEDULER_TICK_MS)
    );
    const startupTimer = window.setTimeout(() => {
      if (this.settings.rssDashboardSyncEnabled) {
        void this.syncFeedsFromRssDashboard(false, false);
      }
      if (!this.settings.autoFetchEnabled || !this.settings.startupCatchupEnabled) {
        return;
      }
      void this.runDueWindows("startup");
    }, 4e3);
    this.register(() => window.clearTimeout(startupTimer));
  }
  async loadSettings() {
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
      source: feed.source === "rss-dashboard" ? "rss-dashboard" : "manual"
    }));
    this.settings.rssDashboardDataPath = (this.settings.rssDashboardDataPath || DEFAULT_SETTINGS.rssDashboardDataPath).trim() || DEFAULT_SETTINGS.rssDashboardDataPath;
    this.settings.includeKeywords = (this.settings.includeKeywords || "").trim();
    this.settings.excludeKeywords = (this.settings.excludeKeywords || "").trim();
    this.settings.scoreDefaultValue = Math.max(
      1,
      Math.min(5, Math.floor(Number(this.settings.scoreDefaultValue) || 3))
    );
    this.settings.scoreActionThreshold = Math.max(
      1,
      Math.floor(Number(this.settings.scoreActionThreshold) || 14)
    );
    this.settings.maxCatchupWindowsPerRun = Math.max(
      1,
      Math.min(100, Math.floor(Number(this.settings.maxCatchupWindowsPerRun) || 10))
    );
    this.settings.maxItemsPerWindow = Math.max(
      MIN_BASE_ITEMS_PER_WINDOW,
      Math.min(MAX_BASE_ITEMS_PER_WINDOW, Math.floor(Number(this.settings.maxItemsPerWindow) || 20))
    );
    this.settings.adaptiveItemCapEnabled = this.settings.adaptiveItemCapEnabled !== false;
    this.settings.adaptiveItemCapMax = Math.max(
      this.settings.maxItemsPerWindow,
      Math.min(MAX_BASE_ITEMS_PER_WINDOW, Math.floor(Number(this.settings.adaptiveItemCapMax) || 50))
    );
    this.settings.topicRelevanceFilterEnabled = this.settings.topicRelevanceFilterEnabled !== false;
    const parsedTopicRelevanceMinScore = Number(this.settings.topicRelevanceMinScore);
    const safeTopicRelevanceMinScore = Number.isFinite(parsedTopicRelevanceMinScore) ? parsedTopicRelevanceMinScore : DEFAULT_SETTINGS.topicRelevanceMinScore;
    this.settings.topicRelevanceMinScore = Math.max(
      MIN_TOPIC_RELEVANCE_MIN_SCORE,
      Math.min(MAX_TOPIC_RELEVANCE_MIN_SCORE, Math.floor(safeTopicRelevanceMinScore))
    );
    this.settings.topicPriorityEnabled = this.settings.topicPriorityEnabled !== false;
    this.settings.topicPriorityOrder = (this.settings.topicPriorityOrder || DEFAULT_SETTINGS.topicPriorityOrder).trim() || DEFAULT_SETTINGS.topicPriorityOrder;
    const parsedTopicPriorityMaxBoost = Number(this.settings.topicPriorityMaxBoost);
    const safeTopicPriorityMaxBoost = Number.isFinite(parsedTopicPriorityMaxBoost) ? parsedTopicPriorityMaxBoost : DEFAULT_SETTINGS.topicPriorityMaxBoost;
    this.settings.topicPriorityMaxBoost = Math.max(
      MIN_TOPIC_PRIORITY_MAX_BOOST,
      Math.min(
        MAX_TOPIC_PRIORITY_MAX_BOOST,
        Math.round(safeTopicPriorityMaxBoost * 100) / 100
      )
    );
    const parsedTopicMaxItems = Number(this.settings.topicMaxItemsPerTopic);
    const safeTopicMaxItems = Number.isFinite(parsedTopicMaxItems) ? parsedTopicMaxItems : DEFAULT_SETTINGS.topicMaxItemsPerTopic;
    this.settings.topicMaxItemsPerTopic = Math.max(
      MIN_TOPIC_MAX_ITEMS_PER_TOPIC,
      Math.min(MAX_TOPIC_MAX_ITEMS_PER_TOPIC, Math.floor(safeTopicMaxItems))
    );
    this.settings.preferenceLearningEnabled = this.settings.preferenceLearningEnabled === true;
    this.settings.preferenceFeedbackTemplateEnabled = this.settings.preferenceFeedbackTemplateEnabled !== false;
    const parsedPreferenceScoreWeight = Number(this.settings.preferenceScoreWeight);
    const safePreferenceScoreWeight = Number.isFinite(parsedPreferenceScoreWeight) ? parsedPreferenceScoreWeight : DEFAULT_SETTINGS.preferenceScoreWeight;
    this.settings.preferenceScoreWeight = Math.max(
      MIN_PREFERENCE_SCORE_WEIGHT,
      Math.min(
        MAX_PREFERENCE_SCORE_WEIGHT,
        Math.round(safePreferenceScoreWeight * 100) / 100
      )
    );
    const rawWeights = this.settings.preferenceTokenWeights && typeof this.settings.preferenceTokenWeights === "object" ? this.settings.preferenceTokenWeights : {};
    const normalizedWeights = Object.entries(rawWeights).map(([token, value]) => {
      const normalizedToken = token.trim().toLowerCase();
      const numeric = Number(value);
      if (!normalizedToken || !Number.isFinite(numeric) || numeric === 0) {
        return null;
      }
      const rounded = Math.round(numeric * 100) / 100;
      return [normalizedToken, rounded];
    }).filter((entry) => entry !== null).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, MAX_PREFERENCE_TOKEN_COUNT);
    this.settings.preferenceTokenWeights = Object.fromEntries(normalizedWeights);
    this.settings.preferenceLastLearnedAtIso = (this.settings.preferenceLastLearnedAtIso || "").trim();
    const parsedTopicMin = Number(this.settings.topicDiversityMinPerTopic);
    const safeTopicMin = Number.isFinite(parsedTopicMin) ? parsedTopicMin : 1;
    this.settings.topicDiversityMinPerTopic = Math.max(
      MIN_TOPIC_DIVERSITY_PER_TOPIC,
      Math.min(MAX_TOPIC_DIVERSITY_PER_TOPIC, Math.floor(safeTopicMin))
    );
    if (this.settings.topicDiversityMinPerTopic > this.settings.topicMaxItemsPerTopic) {
      this.settings.topicDiversityMinPerTopic = this.settings.topicMaxItemsPerTopic;
    }
    const parsedDiversityPenalty = Number(this.settings.topicDiversityPenaltyPerSelected);
    const safeDiversityPenalty = Number.isFinite(parsedDiversityPenalty) ? parsedDiversityPenalty : 1.25;
    this.settings.topicDiversityPenaltyPerSelected = Math.max(
      MIN_TOPIC_DIVERSITY_PENALTY,
      Math.min(
        MAX_TOPIC_DIVERSITY_PENALTY,
        Math.round(safeDiversityPenalty * 100) / 100
      )
    );
    this.settings.translationProvider = this.normalizeTranslationProvider(
      this.settings.translationProvider
    );
    this.settings.translationTargetLanguage = (this.settings.translationTargetLanguage || "ko").trim().toLowerCase() || "ko";
    this.settings.translationWebEndpoint = normalizeHttpBaseUrl(
      this.settings.translationWebEndpoint || DEFAULT_SETTINGS.translationWebEndpoint
    ) || DEFAULT_SETTINGS.translationWebEndpoint;
    this.settings.ollamaBaseUrl = normalizeHttpBaseUrl(this.settings.ollamaBaseUrl || DEFAULT_SETTINGS.ollamaBaseUrl) || DEFAULT_SETTINGS.ollamaBaseUrl;
    this.settings.ollamaDetectedModels = Array.isArray(this.settings.ollamaDetectedModels) ? this.settings.ollamaDetectedModels.filter((model) => typeof model === "string").map((model) => model.trim()).filter((model) => model.length > 0) : [];
    this.settings.ollamaModel = (this.settings.ollamaModel || "").trim();
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
  getPreferenceTokenWeightMap() {
    return new Map(
      Object.entries(this.settings.preferenceTokenWeights || {}).filter(
        ([, value]) => Number.isFinite(value)
      )
    );
  }
  scorePreferenceForRow(row) {
    var _a;
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
      score += (_a = weights.get(token)) != null ? _a : 0;
    }
    return Math.max(-10, Math.min(10, Math.round(score * 100) / 100));
  }
  extractPreferenceFeedbackSamples(content) {
    const lines = content.split(/\r?\n/);
    const samples = [];
    const preferPattern = new RegExp(
      `- \\[x\\] .*\\(${escapeRegexPattern(PREFERENCE_MARKER_PREFER)}\\)`,
      "i"
    );
    const avoidPattern = new RegExp(
      `- \\[x\\] .*\\(${escapeRegexPattern(PREFERENCE_MARKER_AVOID)}\\)`,
      "i"
    );
    let currentTopic = "";
    let currentTitle = "";
    let currentItemLines = [];
    const flush = () => {
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
      const quoteLines = currentItemLines.filter((line) => line.startsWith("> ")).map((line) => line.replace(/^>\s?/, ""));
      const sampleText = normalizePlainText(
        [currentTopic, currentTitle, sourceLine, ...quoteLines].filter((part) => part.trim().length > 0).join("\n")
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
  async refreshPreferenceLearningProfile(showNotice) {
    var _a;
    const folder = this.resolveOutputFolder().replace(/\/+$/, "");
    const isKo = this.settings.uiLanguage !== "en";
    if (!folder) {
      if (showNotice) {
        new import_obsidian.Notice(isKo ? "\uCD9C\uB825 \uD3F4\uB354\uAC00 \uBE44\uC5B4 \uC788\uC5B4 \uC120\uD638\uB3C4 \uD559\uC2B5\uC744 \uC2E4\uD589\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4." : "Output folder is empty.");
      }
      return 0;
    }
    try {
      const files = this.app.vault.getMarkdownFiles().filter((file) => file.path.startsWith(`${folder}/`));
      const tokenScores = /* @__PURE__ */ new Map();
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
            tokenScores.set(token, ((_a = tokenScores.get(token)) != null ? _a : 0) + delta);
          }
        }
      }
      const learned = Array.from(tokenScores.entries()).filter(([, score]) => Math.abs(score) >= PREFERENCE_TOKEN_MIN_ABS_WEIGHT).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, MAX_PREFERENCE_TOKEN_COUNT).map(([token, score]) => [token, Math.round(score * 100) / 100]);
      this.settings.preferenceTokenWeights = Object.fromEntries(learned);
      this.settings.preferenceLastLearnedAtIso = (/* @__PURE__ */ new Date()).toISOString();
      await this.saveSettings();
      if (showNotice) {
        const tokenCount = learned.length;
        const message = isKo ? `\uC120\uD638\uB3C4 \uD559\uC2B5 \uC644\uB8CC: \uB178\uD2B8 ${scannedNotes}\uAC1C, \uD53C\uB4DC\uBC31 ${sampledItems}\uAC74, \uD1A0\uD070 ${tokenCount}\uAC1C` : `Preference learning updated: notes ${scannedNotes}, feedback ${sampledItems}, tokens ${tokenCount}`;
        new import_obsidian.Notice(message, 7e3);
      }
      return learned.length;
    } catch (error) {
      console.error("[rss-insight] preference learning failure", error);
      if (showNotice) {
        new import_obsidian.Notice(isKo ? "\uC120\uD638\uB3C4 \uD559\uC2B5\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4. \uCF58\uC194 \uB85C\uADF8\uB97C \uD655\uC778\uD558\uC138\uC694." : "Preference learning failed.");
      }
      return 0;
    }
  }
  openNotePreviewModal() {
    const isKo = this.settings.uiLanguage !== "en";
    const modal = new import_obsidian.Modal(this.app);
    modal.titleEl.setText(isKo ? "RSS \uB178\uD2B8 \uBBF8\uB9AC\uBCF4\uAE30" : "RSS Note Preview");
    const pre = modal.contentEl.createEl("pre");
    pre.setText(this.buildNotePreviewSample());
    pre.style.whiteSpace = "pre-wrap";
    pre.style.userSelect = "text";
    pre.style.maxHeight = "70vh";
    pre.style.overflowY = "auto";
    modal.open();
  }
  buildNotePreviewSample() {
    const now = /* @__PURE__ */ new Date();
    const start = new Date(now.getTime() - 9 * 60 * 60 * 1e3);
    const sampleFeed = {
      id: "preview",
      topic: this.settings.uiLanguage === "en" ? "AI" : "\uC778\uACF5\uC9C0\uB2A5",
      name: "Sample Source",
      url: "https://example.com/rss",
      enabled: true,
      source: "manual"
    };
    const sampleItem = {
      id: "preview-item",
      title: this.settings.uiLanguage === "en" ? "Sample AI policy update for preview" : "\uBBF8\uB9AC\uBCF4\uAE30\uC6A9 \uC778\uACF5\uC9C0\uB2A5 \uC815\uCC45 \uC5C5\uB370\uC774\uD2B8 \uAE30\uC0AC",
      link: "https://example.com/articles/preview-ai",
      published: now,
      publishedRaw: now.toISOString(),
      description: this.settings.uiLanguage === "en" ? "This is a preview description. The real note will contain collected feed items." : "\uC774 \uBB38\uC7A5\uC740 \uBBF8\uB9AC\uBCF4\uAE30 \uC124\uBA85\uC785\uB2C8\uB2E4. \uC2E4\uC81C \uC0DD\uC131 \uC2DC\uC5D0\uB294 \uC218\uC9D1\uB41C \uAE30\uC0AC \uB0B4\uC6A9\uC774 \uB4E4\uC5B4\uAC11\uB2C8\uB2E4."
    };
    const grouped = /* @__PURE__ */ new Map([
      [sampleFeed.topic, [{ feed: sampleFeed, item: sampleItem }]]
    ]);
    const translationStats = {
      provider: "none",
      model: "",
      titlesTranslated: 0,
      descriptionsTranslated: 0,
      errors: []
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
      false
    );
  }
  resolveEffectiveMaxItemsPerWindow(feeds) {
    const baseMax = Math.max(
      MIN_BASE_ITEMS_PER_WINDOW,
      Math.min(MAX_BASE_ITEMS_PER_WINDOW, Math.floor(Number(this.settings.maxItemsPerWindow) || 20))
    );
    if (!this.settings.adaptiveItemCapEnabled) {
      return baseMax;
    }
    const enabledFeeds = feeds.filter((feed) => feed.enabled && feed.url.trim().length > 0);
    const topicCount = new Set(
      enabledFeeds.map((feed) => normalizeTopic(feed.topic || "Uncategorized"))
    ).size;
    const feedBonus = Math.floor(enabledFeeds.length / 3);
    const topicBonus = Math.floor(topicCount / 2);
    const adaptiveMax = Math.max(
      baseMax,
      Math.min(MAX_BASE_ITEMS_PER_WINDOW, Math.floor(Number(this.settings.adaptiveItemCapMax) || 50))
    );
    return Math.max(baseMax, Math.min(adaptiveMax, baseMax + feedBonus + topicBonus));
  }
  getEffectiveMaxItemsPreview() {
    const enabledFeeds = this.settings.feeds.filter((feed) => feed.enabled && feed.url.trim().length > 0);
    return this.resolveEffectiveMaxItemsPerWindow(enabledFeeds);
  }
  openRecommendedFeedsModal() {
    const isKo = this.settings.uiLanguage !== "en";
    const modal = new import_obsidian.Modal(this.app);
    modal.titleEl.setText(isKo ? "\uCD94\uCC9C RSS \uD53C\uB4DC \uBAA9\uB85D" : "Recommended RSS Feeds");
    const pre = modal.contentEl.createEl("pre");
    pre.setText(this.buildRecommendedFeedPreviewText());
    pre.style.whiteSpace = "pre-wrap";
    pre.style.userSelect = "text";
    pre.style.maxHeight = "70vh";
    pre.style.overflowY = "auto";
    modal.open();
  }
  async addRecommendedFeedsByTarget(targetPerTopic, showNotice) {
    const clampedTarget = Math.max(1, Math.min(RECOMMENDED_MAX_FEEDS_PER_TOPIC, Math.floor(targetPerTopic)));
    const orderedTopics = parseTopicPriorityOrder(this.settings.topicPriorityOrder);
    const topicOrder = orderedTopics.length > 0 ? orderedTopics : [...DEFAULT_TOPIC_PRIORITY_KEYS];
    const existingUrlSet = this.getExistingFeedUrlSet();
    let added = 0;
    for (const topicKey of topicOrder) {
      const currentCount = this.settings.feeds.filter(
        (feed) => feed.enabled && feed.url.trim().length > 0 && resolveCanonicalTopicKey(feed.topic) === topicKey
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
          source: "manual"
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
      const msg = isKo ? `\uCD94\uCC9C \uD53C\uB4DC ${added}\uAC1C\uB97C \uC790\uB3D9 \uCD94\uAC00\uD588\uC2B5\uB2C8\uB2E4.` : `Added ${added} recommended feed(s).`;
      new import_obsidian.Notice(msg, 5e3);
    }
    return added;
  }
  async addGoogleNewsSearchFeedsForPriority(showNotice) {
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
        name: `Google News \uAC80\uC0C9 - ${displayLabel}`,
        url,
        enabled: true,
        source: "manual"
      });
      existingUrlSet.add(normalizedUrl);
      added += 1;
    }
    if (added > 0) {
      await this.saveSettings();
    }
    if (showNotice) {
      const isKo = this.settings.uiLanguage !== "en";
      const msg = isKo ? `Google News \uAC80\uC0C9 \uD53C\uB4DC ${added}\uAC1C\uB97C \uCD94\uAC00\uD588\uC2B5\uB2C8\uB2E4.` : `Added ${added} Google News search feed(s).`;
      new import_obsidian.Notice(msg, 5e3);
    }
    return added;
  }
  buildRecommendedFeedPreviewText() {
    const isKo = this.settings.uiLanguage !== "en";
    const lines = [];
    const existingUrlSet = this.getExistingFeedUrlSet();
    const orderedTopics = parseTopicPriorityOrder(this.settings.topicPriorityOrder);
    const topicOrder = orderedTopics.length > 0 ? orderedTopics : [...DEFAULT_TOPIC_PRIORITY_KEYS];
    lines.push(
      isKo ? "\uC6B0\uC120\uC21C\uC704 \uD1A0\uD53D \uAE30\uC900 \uCD94\uCC9C RSS \uBAA9\uB85D (\uAC80\uC99D\uB41C URL)" : "Recommended RSS list by priority topic (validated URLs)"
    );
    lines.push("");
    for (const topicKey of topicOrder) {
      lines.push(`## ${getTopicLabel(topicKey, this.settings.uiLanguage)}`);
      const candidates = RECOMMENDED_FEED_TEMPLATES.filter((candidate) => candidate.topicKey === topicKey);
      for (const candidate of candidates) {
        const exists = existingUrlSet.has(normalizeFeedUrlForCompare(candidate.url));
        const status = exists ? isKo ? "\uC774\uBBF8 \uCD94\uAC00\uB428" : "already added" : isKo ? "\uCD94\uAC00 \uAC00\uB2A5" : "available";
        lines.push(`- ${candidate.name} [${status}]`);
        lines.push(`  ${candidate.url}`);
        lines.push(`  ${isKo ? "\uC2E0\uB8B0\uB3C4" : "Trust"}: ${candidate.trustNote}`);
      }
      const googleSearchUrl = buildGoogleNewsSearchFeedUrl(GOOGLE_NEWS_QUERY_BY_TOPIC[topicKey]);
      const existsGoogle = existingUrlSet.has(normalizeFeedUrlForCompare(googleSearchUrl));
      lines.push(`- Google News (${isKo ? "\uAC80\uC0C9 \uD53C\uB4DC" : "search feed"}) [${existsGoogle ? isKo ? "\uC774\uBBF8 \uCD94\uAC00\uB428" : "already added" : isKo ? "\uCD94\uAC00 \uAC00\uB2A5" : "available"}]`);
      lines.push(`  ${googleSearchUrl}`);
      lines.push("");
    }
    return lines.join("\n");
  }
  getExistingFeedUrlSet() {
    return new Set(
      this.settings.feeds.map((feed) => normalizeFeedUrlForCompare(feed.url)).filter((url) => url.length > 0)
    );
  }
  pickTopicLabelForTopicKey(topicKey) {
    var _a;
    const counts = /* @__PURE__ */ new Map();
    for (const feed of this.settings.feeds) {
      const topicText = normalizeTopic(feed.topic || "");
      if (!topicText || resolveCanonicalTopicKey(topicText) !== topicKey) {
        continue;
      }
      counts.set(topicText, ((_a = counts.get(topicText)) != null ? _a : 0) + 1);
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
  async syncFeedsFromRssDashboard(force, showNotice) {
    var _a, _b, _c;
    if (!this.settings.rssDashboardSyncEnabled) {
      if (showNotice) {
        new import_obsidian.Notice("RSS Dashboard sync is disabled.");
      }
      return false;
    }
    const dataPath = (0, import_obsidian.normalizePath)(
      this.settings.rssDashboardDataPath.trim() || DEFAULT_SETTINGS.rssDashboardDataPath
    );
    try {
      const adapter = this.app.vault.adapter;
      const exists = await adapter.exists(dataPath);
      if (!exists) {
        if (showNotice) {
          new import_obsidian.Notice(`RSS Dashboard data not found: ${dataPath}`);
        }
        return false;
      }
      const stat = await adapter.stat(dataPath);
      const mtime = (_a = stat == null ? void 0 : stat.mtime) != null ? _a : 0;
      if (!force && mtime > 0 && mtime <= this.settings.rssDashboardLastMtime) {
        return false;
      }
      const raw = await adapter.read(dataPath);
      const parsed = JSON.parse(raw);
      const dashboardFeeds = Array.isArray(parsed.feeds) ? parsed.feeds : [];
      const manualFeeds = this.settings.feeds.filter((feed) => feed.source !== "rss-dashboard");
      const manualUrlSet = new Set(
        manualFeeds.map((feed) => feed.url.trim()).filter((url) => url.length > 0)
      );
      const existingSyncedByUrl = new Map(
        this.settings.feeds.filter((feed) => feed.source === "rss-dashboard").map((feed) => [feed.url.trim(), feed])
      );
      const nextSyncedByUrl = /* @__PURE__ */ new Map();
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
          id: (existing == null ? void 0 : existing.id) || buildDeterministicFeedId(url),
          topic: ((_b = existing == null ? void 0 : existing.topic) == null ? void 0 : _b.trim()) ? existing.topic.trim() : defaultTopic,
          name: ((_c = existing == null ? void 0 : existing.name) == null ? void 0 : _c.trim()) ? existing.name.trim() : defaultName,
          url,
          enabled: existing ? existing.enabled : false,
          source: "rss-dashboard"
        });
      }
      const syncedFeeds = Array.from(nextSyncedByUrl.values());
      const nextFeeds = [...manualFeeds, ...syncedFeeds];
      const changed = JSON.stringify(this.settings.feeds) !== JSON.stringify(nextFeeds) || this.settings.rssDashboardLastMtime !== mtime;
      this.settings.rssDashboardLastMtime = mtime;
      this.settings.rssDashboardLastSyncAtIso = (/* @__PURE__ */ new Date()).toISOString();
      if (changed) {
        this.settings.feeds = nextFeeds;
      }
      await this.saveSettings();
      if (showNotice) {
        const suffix = changed ? "" : " (no feed changes)";
        new import_obsidian.Notice(`Synced ${syncedFeeds.length} feed(s) from RSS Dashboard${suffix}.`, 5e3);
      }
      return changed;
    } catch (error) {
      console.error("[rss-insight] dashboard sync failure", error);
      if (showNotice) {
        new import_obsidian.Notice("Failed to sync from RSS Dashboard. Check console logs.", 8e3);
      }
      return false;
    }
  }
  getOllamaModelOptionsForUi() {
    const out = [];
    const seen = /* @__PURE__ */ new Set();
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
  getRecommendedOllamaModelForUi() {
    const options = this.getOllamaModelOptionsForUi();
    return this.getRecommendedOllamaModel(options);
  }
  async refreshOllamaModels(showNotice) {
    const base = normalizeHttpBaseUrl(this.settings.ollamaBaseUrl || DEFAULT_SETTINGS.ollamaBaseUrl);
    if (!base) {
      if (showNotice) {
        new import_obsidian.Notice("Ollama base URL is empty.");
      }
      return [];
    }
    try {
      const response = await (0, import_obsidian.requestUrl)({
        url: `${base}/api/tags`,
        method: "GET",
        throw: false,
        headers: {
          Accept: "application/json"
        }
      });
      if (response.status >= 400) {
        throw new Error(`HTTP ${response.status}`);
      }
      const parsed = JSON.parse(response.text);
      const models = Array.isArray(parsed.models) ? parsed.models.map((model) => typeof (model == null ? void 0 : model.name) === "string" ? model.name.trim() : "").filter((name) => name.length > 0) : [];
      this.settings.ollamaDetectedModels = Array.from(new Set(models));
      this.settings.ollamaLastModelRefreshIso = (/* @__PURE__ */ new Date()).toISOString();
      if (this.settings.ollamaDetectedModels.length > 0 && !this.settings.ollamaDetectedModels.includes(this.settings.ollamaModel)) {
        this.settings.ollamaModel = this.getRecommendedOllamaModel(
          this.settings.ollamaDetectedModels
        );
      }
      await this.saveSettings();
      if (showNotice) {
        const recommended = this.getRecommendedOllamaModel(this.settings.ollamaDetectedModels);
        const suffix = recommended ? ` / recommended: ${recommended}` : "";
        new import_obsidian.Notice(`Detected ${this.settings.ollamaDetectedModels.length} Ollama model(s)${suffix}.`, 6e3);
      }
      return this.settings.ollamaDetectedModels;
    } catch (error) {
      console.error("[rss-insight] ollama model refresh failure", error);
      if (showNotice) {
        new import_obsidian.Notice("Failed to fetch Ollama models. Check Ollama server URL.", 8e3);
      }
      return [];
    }
  }
  normalizeTranslationProvider(raw) {
    if (raw === "none" || raw === "web" || raw === "ollama") {
      return raw;
    }
    return DEFAULT_SETTINGS.translationProvider;
  }
  getRecommendedOllamaModel(models) {
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
  getEffectiveTranslationProvider() {
    if (!this.settings.translationEnabled) {
      return "none";
    }
    const provider = this.normalizeTranslationProvider(this.settings.translationProvider);
    if (provider === "ollama" && !this.settings.ollamaModel.trim()) {
      return "none";
    }
    return provider;
  }
  shouldTranslateField(raw) {
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
  async applyTranslations(grouped) {
    const provider = this.getEffectiveTranslationProvider();
    const model = provider === "ollama" ? this.settings.ollamaModel.trim() : "";
    const stats = {
      provider,
      model,
      titlesTranslated: 0,
      descriptionsTranslated: 0,
      errors: []
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
            `Title translation failed (${row.feed.name || row.feed.url}): ${this.errorToMessage(error)}`
          );
        }
      }
      if (this.settings.translationTranslateDescription && this.settings.includeDescription && this.shouldTranslateField(row.item.description)) {
        try {
          const translated = await this.translateTextWithProvider(
            row.item.description,
            provider,
            model
          );
          if (translated && translated !== row.item.description) {
            row.translatedDescription = translated;
            stats.descriptionsTranslated += 1;
          }
        } catch (error) {
          stats.errors.push(
            `Description translation failed (${row.feed.name || row.feed.url}): ${this.errorToMessage(error)}`
          );
        }
      }
    }
    return stats;
  }
  async translateTextWithProvider(raw, provider, model) {
    const normalized = normalizePlainText(raw);
    if (!normalized) {
      return normalized;
    }
    const targetLanguage = (this.settings.translationTargetLanguage || "ko").trim().toLowerCase();
    const cacheKey = `${provider}::${model}::${targetLanguage}::${normalized}`;
    const cached = this.translationCache.get(cacheKey);
    if (cached !== void 0) {
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
  async translateWithWebProvider(raw, targetLanguage) {
    const endpoint = normalizeHttpBaseUrl(
      this.settings.translationWebEndpoint || DEFAULT_SETTINGS.translationWebEndpoint
    );
    const url = `${endpoint}?client=gtx&sl=auto&tl=${encodeURIComponent(targetLanguage)}&dt=t&q=${encodeURIComponent(raw)}`;
    const response = await (0, import_obsidian.requestUrl)({
      url,
      method: "GET",
      throw: false,
      headers: {
        Accept: "application/json, text/plain, */*"
      }
    });
    if (response.status >= 400) {
      throw new Error(`web translate HTTP ${response.status}`);
    }
    let parsed;
    try {
      parsed = JSON.parse(response.text);
    } catch (e) {
      throw new Error("web translate invalid JSON");
    }
    if (!Array.isArray(parsed) || !Array.isArray(parsed[0])) {
      throw new Error("web translate unexpected payload");
    }
    const translated = parsed[0].map((chunk) => {
      if (!Array.isArray(chunk) || typeof chunk[0] !== "string") {
        return "";
      }
      return chunk[0];
    }).join("");
    return normalizePlainText(translated) || raw;
  }
  async translateWithOllamaProvider(raw, targetLanguage, model) {
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
      truncateForModelInput(raw)
    ].join("\n");
    const response = await (0, import_obsidian.requestUrl)({
      url: `${base}/api/generate`,
      method: "POST",
      throw: false,
      contentType: "application/json",
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        options: {
          temperature: 0.1
        }
      }),
      headers: {
        Accept: "application/json"
      }
    });
    if (response.status >= 400) {
      throw new Error(`ollama HTTP ${response.status}`);
    }
    const parsed = JSON.parse(response.text);
    if (typeof parsed.response !== "string") {
      throw new Error("ollama invalid response payload");
    }
    return normalizePlainText(parsed.response) || raw;
  }
  errorToMessage(error) {
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }
  async enrichMissingDescriptions(grouped) {
    if (!this.settings.includeDescription) {
      return;
    }
    const candidates = Array.from(grouped.values()).flat().filter((row) => !normalizePlainText(row.item.description) && row.item.link.trim().length > 0).slice(0, MAX_DESCRIPTION_ENRICH_ITEMS_PER_WINDOW);
    if (candidates.length === 0) {
      return;
    }
    const results = await Promise.allSettled(
      candidates.map(async (row) => {
        const description = await this.fetchDescriptionFromArticleLink(row.item.link);
        if (description) {
          row.item.description = description;
        }
      })
    );
    for (const result of results) {
      if (result.status === "rejected") {
        console.debug("[rss-insight] description enrich skipped", result.reason);
      }
    }
  }
  async fetchDescriptionFromArticleLink(url) {
    const response = await (0, import_obsidian.requestUrl)({
      url,
      method: "GET",
      throw: false,
      headers: {
        Accept: "text/html,application/xhtml+xml"
      }
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
  buildDedupeKeys(feed, item) {
    const keys = [toItemKey(feed, item)];
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
  async runDueWindows(reason) {
    if (this.runInProgress) {
      if (reason === "manual") {
        new import_obsidian.Notice("RSS window capture is already running.");
      }
      return;
    }
    await this.syncFeedsFromRssDashboard(false, false);
    const enabledFeeds = this.settings.feeds.filter(
      (feed) => feed.enabled && feed.url.trim().length > 0
    );
    if (enabledFeeds.length === 0) {
      if (reason === "manual") {
        new import_obsidian.Notice("No enabled RSS feeds configured.");
      }
      return;
    }
    const scheduleMinutes = parseScheduleMinutes(this.settings.scheduleTimes);
    if (scheduleMinutes.length === 0) {
      if (reason === "manual") {
        new import_obsidian.Notice("Schedule is invalid. Use HH:MM,HH:MM format.");
      }
      return;
    }
    const dueWindowEnds = this.collectDueWindowEnds(/* @__PURE__ */ new Date(), scheduleMinutes);
    if (dueWindowEnds.length === 0) {
      if (reason === "manual") {
        new import_obsidian.Notice("No due RSS windows to capture right now.");
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
          new import_obsidian.Notice(
            `RSS window ${formatLocalDateTime(windowEnd)} captured with ${outcome.feedErrors.length} feed errors.`,
            8e3
          );
        }
      }
    } catch (error) {
      console.error("[rss-insight] run failure", error);
      new import_obsidian.Notice("RSS window capture failed. Check console logs for details.", 8e3);
    } finally {
      this.runInProgress = false;
    }
    if (reason === "manual") {
      const limitSuffix = windowsHitItemLimit > 0 ? ` (item limit hit in ${windowsHitItemLimit} window(s))` : "";
      new import_obsidian.Notice(`Captured ${processedCount} window(s), ${totalItems} item(s)${limitSuffix}.`, 6e3);
    }
  }
  async captureLatestCompletedWindow() {
    if (this.runInProgress) {
      new import_obsidian.Notice("RSS window capture is already running.");
      return;
    }
    await this.syncFeedsFromRssDashboard(false, false);
    const enabledFeeds = this.settings.feeds.filter(
      (feed) => feed.enabled && feed.url.trim().length > 0
    );
    if (enabledFeeds.length === 0) {
      new import_obsidian.Notice("No enabled RSS feeds configured.");
      return;
    }
    const scheduleMinutes = parseScheduleMinutes(this.settings.scheduleTimes);
    if (scheduleMinutes.length === 0) {
      new import_obsidian.Notice("Schedule is invalid. Use HH:MM,HH:MM format.");
      return;
    }
    const now = /* @__PURE__ */ new Date();
    const latestWindowEnd = this.findPreviousBoundary(
      new Date(now.getTime() + 1e3),
      scheduleMinutes
    );
    const latestWindowStart = this.findPreviousBoundary(latestWindowEnd, scheduleMinutes);
    this.runInProgress = true;
    try {
      const outcome = await this.captureWindow(latestWindowStart, latestWindowEnd, enabledFeeds);
      if (!this.settings.lastWindowEndIso || latestWindowEnd.getTime() > new Date(this.settings.lastWindowEndIso).getTime()) {
        this.settings.lastWindowEndIso = latestWindowEnd.toISOString();
        await this.saveSettings();
      }
      const limitSuffix = outcome.itemLimitHit ? " (item limit hit)" : "";
      new import_obsidian.Notice(
        `Captured latest window ${formatLocalDateTime(latestWindowEnd)} with ${outcome.totalItems} item(s)${limitSuffix}.`,
        6e3
      );
    } catch (error) {
      console.error("[rss-insight] latest window failure", error);
      new import_obsidian.Notice("Failed to capture latest window.", 8e3);
    } finally {
      this.runInProgress = false;
    }
  }
  collectDueWindowEnds(now, scheduleMinutes) {
    let anchor;
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
    const due = [];
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
  findNextBoundary(after, scheduleMinutes) {
    for (let dayOffset = 0; dayOffset <= 7; dayOffset += 1) {
      const day = new Date(
        after.getFullYear(),
        after.getMonth(),
        after.getDate() + dayOffset,
        0,
        0,
        0,
        0
      );
      const candidates = scheduleMinutes.map((minutes) => dateAtMinutes(day, minutes)).filter((candidate) => candidate.getTime() > after.getTime()).sort((a, b) => a.getTime() - b.getTime());
      if (candidates.length > 0) {
        return candidates[0];
      }
    }
    return new Date(after.getTime() + 24 * 60 * 60 * 1e3);
  }
  findPreviousBoundary(before, scheduleMinutes) {
    for (let dayOffset = 0; dayOffset <= 7; dayOffset += 1) {
      const day = new Date(
        before.getFullYear(),
        before.getMonth(),
        before.getDate() - dayOffset,
        0,
        0,
        0,
        0
      );
      const candidates = scheduleMinutes.map((minutes) => dateAtMinutes(day, minutes)).filter((candidate) => candidate.getTime() < before.getTime()).sort((a, b) => b.getTime() - a.getTime());
      if (candidates.length > 0) {
        return candidates[0];
      }
    }
    return new Date(before.getTime() - 24 * 60 * 60 * 1e3);
  }
  async captureWindow(windowStart, windowEnd, feeds) {
    var _a, _b;
    const grouped = /* @__PURE__ */ new Map();
    const windowCandidates = [];
    const itemKeys = /* @__PURE__ */ new Set();
    const feedErrors = [];
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
        items: await this.fetchFeedItems(feed)
      }))
    );
    for (const result of fetchResults) {
      if (result.status === "rejected") {
        const reason = result.reason instanceof Error ? result.reason.message : String(result.reason);
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
          const feedTopicScore = (_a = inferred.scores.get(feedTopicKey)) != null ? _a : 0;
          if (inferred.key !== feedTopicKey && inferred.score >= TOPIC_MISMATCH_MIN_BEST_SCORE && inferred.score - feedTopicScore >= TOPIC_MISMATCH_MIN_GAP) {
            itemsFilteredByTopicMismatch += 1;
            continue;
          }
        }
        if (this.settings.topicRelevanceFilterEnabled) {
          const topicKey = feedTopicKey;
          if (topicKey !== "other") {
            const relevanceScore = scoreTopicRelevance(
              topicKey,
              relevanceHaystack
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
    const rankedRows = windowCandidates.map((row) => {
      const qualityScore = scoreWindowItemQuality(row.item, windowEnd);
      const topicKey = resolveCanonicalTopicKey(row.feed.topic);
      const relevanceScore = scoreTopicRelevance(
        topicKey,
        buildTopicRelevanceHaystack(row.feed, row.item)
      );
      const priorityBoost = this.settings.topicPriorityEnabled ? getTopicPriorityBoost(topicKey, topicPriorityOrder, this.settings.topicPriorityMaxBoost) : 0;
      const preferenceScore = this.scorePreferenceForRow(row);
      const totalScore = qualityScore + relevanceScore * TOPIC_RELEVANCE_WEIGHT + priorityBoost + preferenceScore * this.settings.preferenceScoreWeight;
      return {
        row,
        qualityScore,
        relevanceScore,
        priorityBoost,
        preferenceScore,
        totalScore
      };
    }).sort((a, b) => {
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
      this.settings.topicDiversityPenaltyPerSelected
    );
    itemLimitHit = rankedRows.length > selectedRows.length;
    itemsFilteredByQuality = Math.max(0, rankedRows.length - selectedRows.length);
    totalItems = selectedRows.length;
    for (const row of selectedRows) {
      const topic = getRowTopic(row);
      if (!grouped.has(topic)) {
        grouped.set(topic, []);
      }
      (_b = grouped.get(topic)) == null ? void 0 : _b.push(row);
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
        itemLimitHit
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
      itemLimitHit
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
      itemLimitHit
    };
  }
  buildOutputPath(windowEnd) {
    const folder = this.resolveOutputFolder();
    const prefix = sanitizeFilePart(this.settings.filePrefix || DEFAULT_SETTINGS.filePrefix);
    const fileName = `${prefix}-${formatFileStamp(windowEnd)}.md`;
    return (0, import_obsidian.normalizePath)(`${folder}/${fileName}`);
  }
  resolveOutputFolder() {
    return (0, import_obsidian.normalizePath)(this.settings.outputFolder.trim() || DEFAULT_SETTINGS.outputFolder);
  }
  buildNoteContent(windowStart, windowEnd, grouped, feedsChecked, totalItems, itemsWithoutDate, itemsFilteredByKeyword, itemsFilteredByTopicMismatch, itemsFilteredByTopicRelevance, itemsDeduped, itemsFilteredByQuality, effectiveMaxItemsPerWindow, feedErrors, translationStats, itemLimitHit) {
    var _a;
    const lines = [];
    const defaultScore = this.settings.scoreDefaultValue;
    const defaultTotalScore = defaultScore * 4;
    const isKo = this.settings.uiLanguage !== "en";
    const t = (ko, en) => isKo ? ko : en;
    const translationProviderLabel = translationStats.provider === "none" ? t("\uC0AC\uC6A9 \uC548 \uD568", "Disabled") : translationStats.provider === "web" ? t("\uC6F9 \uBC88\uC5ED", "Web") : "Ollama";
    lines.push("---");
    lines.push('plugin: "rss-insight"');
    lines.push(`\uC0DD\uC131\uC2DC\uAC01: "${escapeYamlString((/* @__PURE__ */ new Date()).toISOString())}"`);
    lines.push(`\uC708\uB3C4\uC6B0_\uC2DC\uC791: "${escapeYamlString(windowStart.toISOString())}"`);
    lines.push(`\uC708\uB3C4\uC6B0_\uC885\uB8CC: "${escapeYamlString(windowEnd.toISOString())}"`);
    lines.push(`\uD655\uC778\uD53C\uB4DC\uC218: ${feedsChecked}`);
    lines.push(`\uC218\uC9D1\uAE30\uC0AC\uC218: ${totalItems}`);
    lines.push(`\uD1A0\uD53D\uBD88\uC77C\uCE58\uC81C\uC678\uC218: ${itemsFilteredByTopicMismatch}`);
    lines.push(`\uD1A0\uD53D\uAD00\uB828\uC131\uC81C\uC678\uC218: ${itemsFilteredByTopicRelevance}`);
    lines.push(`\uD53C\uB4DC\uC624\uB958\uC218: ${feedErrors.length}`);
    lines.push(`\uC0C1\uD55C\uB3C4\uB2EC: ${itemLimitHit ? "true" : "false"}`);
    lines.push("---");
    lines.push("");
    lines.push(`# ${t("RSS \uC218\uC9D1 \uB9AC\uD3EC\uD2B8", "RSS Capture")} ${formatLocalDateTime(windowEnd)}`);
    lines.push("");
    lines.push(`- ${t("\uC708\uB3C4\uC6B0 \uC2DC\uC791", "Window start")}: ${formatLocalDateTime(windowStart)}`);
    lines.push(`- ${t("\uC708\uB3C4\uC6B0 \uC885\uB8CC", "Window end")}: ${formatLocalDateTime(windowEnd)}`);
    lines.push(`- ${t("\uD655\uC778\uD55C \uD53C\uB4DC \uC218", "Feeds checked")}: ${feedsChecked}`);
    lines.push(`- ${t("\uC218\uC9D1 \uAE30\uC0AC \uC218", "Items captured")}: ${totalItems}`);
    if (itemsFilteredByKeyword > 0) {
      lines.push(`- ${t("\uD0A4\uC6CC\uB4DC \uD544\uD130 \uC81C\uC678", "Filtered by keywords")}: ${itemsFilteredByKeyword}`);
    }
    if (itemsFilteredByTopicMismatch > 0) {
      lines.push(`- ${t("\uD1A0\uD53D \uBD88\uC77C\uCE58 \uC81C\uC678", "Filtered by topic mismatch")}: ${itemsFilteredByTopicMismatch}`);
    }
    lines.push(`- ${t("\uD1A0\uD53D \uAD00\uB828\uC131 \uC81C\uC678", "Filtered by topic relevance")}: ${itemsFilteredByTopicRelevance}`);
    if (itemsDeduped > 0) {
      lines.push(`- ${t("\uC911\uBCF5 \uC81C\uAC70", "Deduped")}: ${itemsDeduped}`);
    }
    if (itemsFilteredByQuality > 0) {
      lines.push(`- ${t("\uD488\uC9C8 \uC120\uBCC4 \uC81C\uC678", "Filtered by quality")}: ${itemsFilteredByQuality}`);
    }
    lines.push(`- ${t("\uC708\uB3C4\uC6B0 \uCD5C\uB300 \uAE30\uC0AC \uC218", "Max items per window")}: ${effectiveMaxItemsPerWindow}`);
    lines.push(`- ${t("\uC0C1\uD55C \uB3C4\uB2EC", "Item limit hit")}: ${itemLimitHit ? t("\uC608", "yes") : t("\uC544\uB2C8\uC624", "no")}`);
    if (feedErrors.length > 0) {
      lines.push(`- ${t("\uD53C\uB4DC \uC624\uB958", "Feed errors")}: ${feedErrors.length}`);
    }
    if (translationStats.provider !== "none") {
      lines.push(`- ${t("\uBC88\uC5ED \uBC29\uC2DD", "Translation provider")}: ${translationProviderLabel}`);
    }
    if (this.settings.preferenceLearningEnabled) {
      lines.push(
        `- ${t("\uC120\uD638\uB3C4 \uD559\uC2B5", "Preference learning")}: ${Object.keys(this.settings.preferenceTokenWeights || {}).length} ${t("\uAC1C \uD1A0\uD070 \uC801\uC6A9", "tokens applied")}`
      );
    }
    if (this.settings.scoreTemplateEnabled) {
      lines.push(`- ${t("\uC561\uC158 \uD6C4\uBCF4 \uAE30\uC900", "Action threshold")}: ${this.settings.scoreActionThreshold}+`);
    }
    lines.push("");
    const topics = Array.from(grouped.keys()).sort((a, b) => a.localeCompare(b));
    if (topics.length === 0) {
      lines.push(`## ${t("\uAE30\uC0AC \uBAA9\uB85D", "Items")}`);
      lines.push("");
      lines.push(t("\uC774 \uC708\uB3C4\uC6B0\uC5D0\uC11C \uC218\uC9D1\uB41C \uAE30\uC0AC\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.", "No items were found in this window."));
      lines.push("");
    }
    for (const topic of topics) {
      lines.push(`## ${topic}`);
      lines.push("");
      const rows = (_a = grouped.get(topic)) != null ? _a : [];
      rows.sort((a, b) => {
        const aTime = a.item.published ? a.item.published.getTime() : 0;
        const bTime = b.item.published ? b.item.published.getTime() : 0;
        return bTime - aTime;
      });
      for (const row of rows) {
        const title = row.item.title || "(untitled)";
        const displayTitle = row.translatedTitle || title;
        const link = row.item.link || "";
        const published = row.item.published ? formatLocalDateTime(row.item.published) : row.item.publishedRaw || t("\uC54C \uC218 \uC5C6\uC74C", "unknown");
        lines.push(`### ${displayTitle}`);
        lines.push(`- ${t("\uC18C\uC2A4", "Source")}: ${row.feed.name || row.feed.url}`);
        lines.push(`- ${t("\uBC1C\uD589 \uC2DC\uAC01", "Published")}: ${published}`);
        if (link) {
          lines.push(`- ${t("\uB9C1\uD06C", "URL")}: ${link}`);
        }
        if (displayTitle !== title) {
          lines.push(`- ${t("\uC6D0\uBB38 \uC81C\uBAA9", "Original title")}: ${title}`);
        }
        if (this.settings.scoreTemplateEnabled) {
          lines.push(
            `- ${t("\uC810\uC218", "Score")}: ${t("\uC601\uD5A5\uB3C4", "Impact")} ${defaultScore} / ${t("\uC2E4\uD589\uAC00\uB2A5\uC131", "Actionability")} ${defaultScore} / ${t("\uC2DC\uC758\uC131", "Timing")} ${defaultScore} / ${t("\uC2E0\uB8B0\uB3C4", "Confidence")} ${defaultScore} = ${defaultTotalScore}`
          );
        }
        if (this.settings.preferenceFeedbackTemplateEnabled) {
          lines.push(`- [ ] ${t("\uC120\uD638", "Prefer")} (${PREFERENCE_MARKER_PREFER})`);
          lines.push(`- [ ] ${t("\uBE44\uC120\uD638", "Avoid")} (${PREFERENCE_MARKER_AVOID})`);
        }
        if (this.settings.includeDescription && row.item.description) {
          const hasTranslatedDescription = !!row.translatedDescription && normalizePlainText(row.translatedDescription) !== normalizePlainText(row.item.description);
          const maxLength = hasTranslatedDescription ? TRANSLATED_DESCRIPTION_MAX_LENGTH : Math.max(80, this.settings.descriptionMaxLength);
          const descriptionBody = row.translatedDescription || row.item.description;
          const description = truncateText(normalizePlainText(descriptionBody), maxLength);
          if (description) {
            lines.push("");
            for (const descLine of description.split("\n")) {
              lines.push(`> ${descLine}`);
            }
          }
          if (hasTranslatedDescription && this.settings.translationKeepOriginal) {
            const originalDescription = normalizePlainText(row.item.description);
            if (originalDescription) {
              lines.push("");
              lines.push("<details>");
              lines.push(`<summary>${t("\uC6D0\uBB38 \uC124\uBA85", "Original description")}</summary>`);
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
      lines.push(`## ${t("\uD53C\uB4DC \uC624\uB958", "Feed Errors")}`);
      lines.push("");
      for (const error of feedErrors) {
        lines.push(`- ${error}`);
      }
      lines.push("");
    }
    if (translationStats.errors.length > 0) {
      lines.push(`## ${t("\uBC88\uC5ED \uC624\uB958", "Translation Errors")}`);
      lines.push("");
      for (const error of translationStats.errors) {
        lines.push(`- ${error}`);
      }
      lines.push("");
    }
    return lines.join("\n");
  }
  async ensureFolderExists(folderPath) {
    const normalized = (0, import_obsidian.normalizePath)(folderPath).replace(/\/+$/, "");
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
      if (!(existing instanceof import_obsidian.TFolder)) {
        throw new Error(`Path exists and is not a folder: ${currentPath}`);
      }
    }
  }
  async writeOrOverwriteNote(path, content) {
    const existing = this.app.vault.getAbstractFileByPath(path);
    if (!existing) {
      await this.app.vault.create(path, content);
      return;
    }
    if (existing instanceof import_obsidian.TFile) {
      await this.app.vault.modify(existing, content);
      return;
    }
    throw new Error(`Cannot write note. Path exists as folder: ${path}`);
  }
  async fetchFeedItems(feed) {
    const response = await (0, import_obsidian.requestUrl)({
      url: feed.url,
      method: "GET",
      throw: false,
      headers: {
        Accept: "application/rss+xml, application/atom+xml, text/xml, application/xml, text/plain"
      }
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
  parseRss(doc) {
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
        description: stripHtml(descriptionRaw)
      };
    });
  }
  parseAtom(doc) {
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
        description: stripHtml(descriptionRaw)
      };
    });
  }
};
var RssWindowCaptureSettingTab = class extends import_obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    const lang = this.plugin.settings.uiLanguage === "en" ? "en" : "ko";
    const t = (ko, en) => lang === "ko" ? ko : en;
    const simpleMode = this.plugin.settings.simpleSettingsMode !== false;
    containerEl.createEl("h2", { text: t("RSS \uC778\uC0AC\uC774\uD2B8", "RSS Insight") });
    new import_obsidian.Setting(containerEl).setName(t("\uC124\uC815 \uC5B8\uC5B4", "Settings language")).setDesc(
      t(
        "\uC124\uC815\uCC3D \uC5B8\uC5B4\uB97C \uC120\uD0DD\uD569\uB2C8\uB2E4. \uD55C \uBC88\uC5D0 \uD55C \uC5B8\uC5B4\uB9CC \uD45C\uC2DC\uB429\uB2C8\uB2E4.",
        "Choose the settings UI language. Only one language is shown at a time."
      )
    ).addDropdown(
      (dropdown) => dropdown.addOption("ko", "\uD55C\uAD6D\uC5B4").addOption("en", "English").setValue(this.plugin.settings.uiLanguage).onChange(async (value) => {
        this.plugin.settings.uiLanguage = value === "en" ? "en" : "ko";
        await this.plugin.saveSettings();
        this.display();
      })
    );
    new import_obsidian.Setting(containerEl).setName(t("\uACE0\uAE09 \uC635\uC158 \uD45C\uC2DC", "Show advanced options")).setDesc(
      t(
        "\uB044\uBA74 \uD575\uC2EC \uC124\uC815\uB9CC \uBCF4\uC785\uB2C8\uB2E4. (\uCD94\uCC9C: \uB054)",
        "Turn off to show only essential settings. (Recommended: off)"
      )
    ).addToggle(
      (toggle) => toggle.setValue(!simpleMode).onChange(async (value) => {
        this.plugin.settings.simpleSettingsMode = !value;
        await this.plugin.saveSettings();
        this.display();
      })
    );
    containerEl.createEl("h3", { text: t("\uBE60\uB978 \uC2DC\uC791", "Quick Start") });
    const applyQuickPreset = async (mode) => {
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
      const message = mode === "strict" ? t("\uC5C4\uACA9 \uD544\uD130 \uD504\uB9AC\uC14B\uC744 \uC801\uC6A9\uD588\uC2B5\uB2C8\uB2E4.", "Applied strict filtering preset.") : t("\uADE0\uD615\uD615 \uD504\uB9AC\uC14B\uC744 \uC801\uC6A9\uD588\uC2B5\uB2C8\uB2E4.", "Applied balanced preset.");
      new import_obsidian.Notice(message, 4e3);
      this.display();
    };
    new import_obsidian.Setting(containerEl).setName(t("\uCD08\uBCF4\uC790 \uCD94\uCC9C \uD504\uB9AC\uC14B", "Beginner preset")).setDesc(
      t(
        "\uBC84\uD2BC \uD55C \uBC88\uC73C\uB85C \uAD00\uB828\uC131/\uC6B0\uC120\uC21C\uC704 \uAE30\uBCF8\uAC12\uC744 \uB9DE\uCDA5\uB2C8\uB2E4.",
        "Apply relevance/priority defaults in one click."
      )
    ).addButton(
      (button) => button.setButtonText(t("\uADE0\uD615\uD615", "Balanced")).onClick(async () => {
        await applyQuickPreset("balanced");
      })
    ).addButton(
      (button) => button.setButtonText(t("\uC5C4\uACA9\uD615", "Strict")).onClick(async () => {
        await applyQuickPreset("strict");
      })
    );
    new import_obsidian.Setting(containerEl).setName(t("\uC0DD\uC131 \uB178\uD2B8 \uBBF8\uB9AC\uBCF4\uAE30", "Note preview")).setDesc(
      t(
        "\uD604\uC7AC \uC124\uC815 \uAE30\uC900\uC73C\uB85C \uC0DD\uC131\uB420 \uB178\uD2B8 \uD615\uC2DD\uC744 \uBBF8\uB9AC \uD655\uC778\uD569\uB2C8\uB2E4.",
        "Preview the generated note format with current settings."
      )
    ).addButton(
      (button) => button.setButtonText(t("\uBBF8\uB9AC\uBCF4\uAE30 \uC5F4\uAE30", "Open preview")).onClick(() => {
        this.plugin.openNotePreviewModal();
      })
    );
    const topicCoverageSetting = new import_obsidian.Setting(containerEl).setName(t("\uD1A0\uD53D\uBCC4 \uD53C\uB4DC \uAC1C\uC218 \uC810\uAC80", "Topic feed count check")).setDesc(formatTopicFeedCoverageDiagnostic(this.plugin.settings.feeds, lang));
    let recommendedCoverageSetting = null;
    new import_obsidian.Setting(containerEl).setName(t("\uC790\uB3D9 \uC218\uC9D1", "Auto fetch")).setDesc(
      t(
        "Obsidian\uC774 \uC5F4\uB824 \uC788\uB294 \uB3D9\uC548 \uB9E4\uBD84 \uC218\uC9D1 \uB300\uC0C1 \uC708\uB3C4\uC6B0\uB97C \uD655\uC778\uD558\uACE0 \uC2E4\uD589\uD569\uB2C8\uB2E4.",
        "Check and run due windows every minute while Obsidian is open."
      )
    ).addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.autoFetchEnabled).onChange(async (value) => {
        this.plugin.settings.autoFetchEnabled = value;
        await this.plugin.saveSettings();
        if (value) {
          void this.plugin.runDueWindows("settings");
        }
      })
    );
    new import_obsidian.Setting(containerEl).setName(t("\uC218\uC9D1 \uC2DC\uAC04", "Schedule times")).setDesc(t("\uC27C\uD45C\uB85C \uAD6C\uBD84\uD55C HH:MM \uD615\uC2DD. \uC608: 08:00,17:00", "Comma-separated HH:MM values. Example: 08:00,17:00")).addText(
      (text) => text.setPlaceholder("08:00,17:00").setValue(this.plugin.settings.scheduleTimes).onChange(async (value) => {
        this.plugin.settings.scheduleTimes = value;
        await this.plugin.saveSettings();
      })
    );
    const parsedTimes = parseScheduleMinutes(this.plugin.settings.scheduleTimes);
    new import_obsidian.Setting(containerEl).setName(t("\uD574\uC11D\uB41C \uC2DC\uAC04", "Parsed times")).setDesc(
      parsedTimes.length > 0 ? parsedTimes.map((minutes) => minutesToToken(minutes)).join(", ") : t("\uC720\uD6A8\uD55C \uC218\uC9D1 \uC2DC\uAC04\uC774 \uC5C6\uC2B5\uB2C8\uB2E4", "No valid schedule times")
    );
    if (!simpleMode) {
      new import_obsidian.Setting(containerEl).setName(t("\uC2DC\uC791 \uC2DC \uB204\uB77D \uBCF4\uCDA9", "Catch up on startup")).setDesc(
        t(
          "Obsidian \uC2DC\uC791 \uC2DC \uB9C8\uC9C0\uB9C9 \uD3EC\uC778\uD130 \uC774\uD6C4 \uB193\uCE5C \uC708\uB3C4\uC6B0\uB97C \uBCF4\uCDA9 \uC218\uC9D1\uD569\uB2C8\uB2E4.",
          "When Obsidian starts, capture missed windows since the last pointer."
        )
      ).addToggle(
        (toggle) => toggle.setValue(this.plugin.settings.startupCatchupEnabled).onChange(async (value) => {
          this.plugin.settings.startupCatchupEnabled = value;
          await this.plugin.saveSettings();
        })
      );
      new import_obsidian.Setting(containerEl).setName(t("1\uD68C \uC2E4\uD589\uB2F9 \uCD5C\uB300 \uBCF4\uCDA9 \uC708\uB3C4\uC6B0", "Max catch-up windows per run")).setDesc(
        t(
          "\uD55C \uBC88 \uC2E4\uD589\uC5D0\uC11C \uCC98\uB9AC\uD560 \uBCF4\uCDA9 \uC708\uB3C4\uC6B0 \uC0C1\uD55C\uC785\uB2C8\uB2E4. \uB204\uB77D\uC774 \uB354 \uB9CE\uC73C\uBA74 \uB2E4\uC74C \uD2F1\uC5D0\uC11C \uACC4\uC18D \uCC98\uB9AC\uD569\uB2C8\uB2E4.",
          "Safety cap for one run. If missed windows are larger, the next tick keeps catching up."
        )
      ).addText(
        (text) => text.setPlaceholder("10").setValue(String(this.plugin.settings.maxCatchupWindowsPerRun)).onChange(async (value) => {
          const parsed = Number(value);
          if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 100) {
            this.plugin.settings.maxCatchupWindowsPerRun = Math.floor(parsed);
            await this.plugin.saveSettings();
          }
        })
      );
    }
    new import_obsidian.Setting(containerEl).setName(t("\uAE30\uBCF8 \uCD5C\uB300 \uD56D\uBAA9 \uC218(\uC708\uB3C4\uC6B0\uB2F9)", "Base max items per window")).setDesc(
      t(
        "\uC790\uB3D9 \uD655\uC7A5 \uC801\uC6A9 \uC804, \uD488\uC9C8 \uC120\uBCC4\uC758 \uAE30\uBCF8 \uC0C1\uD55C\uC785\uB2C8\uB2E4.",
        "Base target for quality-selected items before adaptive expansion."
      )
    ).addText(
      (text) => text.setPlaceholder("20").setValue(String(this.plugin.settings.maxItemsPerWindow)).onChange(async (value) => {
        const parsed = Number(value);
        if (Number.isFinite(parsed) && parsed >= MIN_BASE_ITEMS_PER_WINDOW && parsed <= MAX_BASE_ITEMS_PER_WINDOW) {
          this.plugin.settings.maxItemsPerWindow = Math.floor(parsed);
          if (this.plugin.settings.adaptiveItemCapMax < this.plugin.settings.maxItemsPerWindow) {
            this.plugin.settings.adaptiveItemCapMax = this.plugin.settings.maxItemsPerWindow;
          }
          await this.plugin.saveSettings();
          this.display();
        }
      })
    );
    if (!simpleMode) {
      new import_obsidian.Setting(containerEl).setName(t("\uCD5C\uB300 \uD56D\uBAA9 \uC790\uB3D9 \uD655\uC7A5", "Adaptive max items")).setDesc(
        t(
          "\uD65C\uC131 \uD53C\uB4DC/\uD1A0\uD53D \uC218\uC5D0 \uB530\uB77C \uC720\uD6A8 \uC0C1\uD55C\uC744 \uC790\uB3D9\uC73C\uB85C \uB298\uB9BD\uB2C8\uB2E4.",
          "Auto-expand effective cap based on enabled feed/topic count."
        )
      ).addToggle(
        (toggle) => toggle.setValue(this.plugin.settings.adaptiveItemCapEnabled).onChange(async (value) => {
          this.plugin.settings.adaptiveItemCapEnabled = value;
          await this.plugin.saveSettings();
          this.display();
        })
      );
      new import_obsidian.Setting(containerEl).setName(t("\uC790\uB3D9 \uD655\uC7A5 \uCD5C\uB300\uCE58", "Adaptive cap upper bound")).setDesc(
        t(
          "\uC790\uB3D9 \uD655\uC7A5\uC744 \uCF30\uC744 \uB54C \uC62C\uB77C\uAC08 \uC218 \uC788\uB294 \uCD5C\uB300 \uC0C1\uD55C\uC785\uB2C8\uB2E4.",
          "Maximum effective cap when adaptive mode is enabled."
        )
      ).addText(
        (text) => text.setPlaceholder("50").setValue(String(this.plugin.settings.adaptiveItemCapMax)).onChange(async (value) => {
          const parsed = Number(value);
          if (Number.isFinite(parsed) && parsed >= this.plugin.settings.maxItemsPerWindow && parsed <= MAX_BASE_ITEMS_PER_WINDOW) {
            this.plugin.settings.adaptiveItemCapMax = Math.floor(parsed);
            await this.plugin.saveSettings();
            this.display();
          }
        })
      );
      const enabledFeedsForPreview = this.plugin.settings.feeds.filter(
        (feed) => feed.enabled && feed.url.trim().length > 0
      );
      const topicCountForPreview = new Set(
        enabledFeedsForPreview.map((feed) => normalizeTopic(feed.topic || "Uncategorized"))
      ).size;
      new import_obsidian.Setting(containerEl).setName(t("\uC720\uD6A8 \uC0C1\uD55C \uBBF8\uB9AC\uBCF4\uAE30", "Effective cap preview")).setDesc(
        t(
          `\uD604\uC7AC: ${this.plugin.getEffectiveMaxItemsPreview()}\uAC1C (\uD65C\uC131 \uD53C\uB4DC: ${enabledFeedsForPreview.length}, \uD1A0\uD53D: ${topicCountForPreview})`,
          `Now: ${this.plugin.getEffectiveMaxItemsPreview()} items (enabled feeds: ${enabledFeedsForPreview.length}, topics: ${topicCountForPreview})`
        )
      );
    }
    new import_obsidian.Setting(containerEl).setName(t("\uD1A0\uD53D\uBCC4 \uCD5C\uC18C \uD655\uBCF4 \uAC1C\uC218", "Topic diversity minimum per topic")).setDesc(
      t(
        "\uAC00\uC911\uCE58 \uCC44\uC6B0\uAE30 \uC804\uC5D0 \uD1A0\uD53D\uBCC4\uB85C \uCD5C\uC18C \uC774 \uAC1C\uC218\uB9CC\uD07C \uBA3C\uC800 \uD655\uBCF4\uD569\uB2C8\uB2E4. \uAD8C\uC7A5: 2",
        "Try to keep at least this many items per topic before weighted fill."
      )
    ).addText(
      (text) => text.setPlaceholder("2").setValue(String(this.plugin.settings.topicDiversityMinPerTopic)).onChange(async (value) => {
        const parsed = Number(value);
        if (Number.isFinite(parsed) && parsed >= MIN_TOPIC_DIVERSITY_PER_TOPIC && parsed <= MAX_TOPIC_DIVERSITY_PER_TOPIC) {
          const next = Math.floor(parsed);
          this.plugin.settings.topicDiversityMinPerTopic = Math.min(
            next,
            this.plugin.settings.topicMaxItemsPerTopic
          );
          await this.plugin.saveSettings();
          this.display();
        }
      })
    );
    new import_obsidian.Setting(containerEl).setName(t("\uD1A0\uD53D\uBCC4 \uCD5C\uB300 \uD5C8\uC6A9 \uAC1C\uC218", "Topic max items per topic")).setDesc(
      t(
        "\uD55C \uD1A0\uD53D\uC5D0\uC11C \uB108\uBB34 \uB9CE\uC774 \uBF51\uD788\uC9C0 \uC54A\uB3C4\uB85D \uC0C1\uD55C\uC744 \uB461\uB2C8\uB2E4. \uAD8C\uC7A5: 3 (4\uAC1C \uBBF8\uB9CC)",
        "Upper cap per topic to avoid over-concentration. Recommended: 3 (under 4)."
      )
    ).addText(
      (text) => text.setPlaceholder("3").setValue(String(this.plugin.settings.topicMaxItemsPerTopic)).onChange(async (value) => {
        const parsed = Number(value);
        if (Number.isFinite(parsed) && parsed >= MIN_TOPIC_MAX_ITEMS_PER_TOPIC && parsed <= MAX_TOPIC_MAX_ITEMS_PER_TOPIC) {
          this.plugin.settings.topicMaxItemsPerTopic = Math.floor(parsed);
          if (this.plugin.settings.topicDiversityMinPerTopic > this.plugin.settings.topicMaxItemsPerTopic) {
            this.plugin.settings.topicDiversityMinPerTopic = this.plugin.settings.topicMaxItemsPerTopic;
          }
          await this.plugin.saveSettings();
          this.display();
        }
      })
    );
    new import_obsidian.Setting(containerEl).setName(t("\uD1A0\uD53D \uBD84\uC0B0 \uD398\uB110\uD2F0", "Topic diversity penalty")).setDesc(
      t(
        "\uAC12\uC774 \uB192\uC744\uC218\uB85D \uD1A0\uD53D \uBD84\uC0B0\uC774 \uAC15\uD574\uC9D1\uB2C8\uB2E4. 0\uC774\uBA74 \uC21C\uC218 \uD488\uC9C8 \uC21C\uC11C\uC785\uB2C8\uB2E4.",
        "Higher value spreads topics more aggressively. 0 = pure quality order."
      )
    ).addText(
      (text) => text.setPlaceholder("1.25").setValue(String(this.plugin.settings.topicDiversityPenaltyPerSelected)).onChange(async (value) => {
        const parsed = Number(value);
        if (Number.isFinite(parsed) && parsed >= MIN_TOPIC_DIVERSITY_PENALTY && parsed <= MAX_TOPIC_DIVERSITY_PENALTY) {
          this.plugin.settings.topicDiversityPenaltyPerSelected = Math.round(parsed * 100) / 100;
          await this.plugin.saveSettings();
        }
      })
    );
    new import_obsidian.Setting(containerEl).setName(t("\uCD9C\uB825 \uD3F4\uB354", "Output folder")).setDesc(t("\uC218\uC9D1 \uB178\uD2B8\uB97C \uC800\uC7A5\uD560 Vault \uAE30\uC900 \uD3F4\uB354\uC785\uB2C8\uB2E4.", "Vault-relative folder where capture notes are written.")).addText(
      (text) => text.setPlaceholder("000-Inbox/RSS").setValue(this.plugin.settings.outputFolder).onChange(async (value) => {
        this.plugin.settings.outputFolder = value.trim();
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName(t("\uD30C\uC77C\uBA85 \uC811\uB450\uC5B4", "Filename prefix")).setDesc(t("\uC0DD\uC131\uB418\uB294 \uB178\uD2B8 \uD30C\uC77C\uBA85 \uC55E\uBD80\uBD84\uC785\uB2C8\uB2E4.", "Prefix used for generated note filenames.")).addText(
      (text) => text.setPlaceholder("rss-capture").setValue(this.plugin.settings.filePrefix).onChange(async (value) => {
        this.plugin.settings.filePrefix = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName(t("\uC124\uBA85 \uD3EC\uD568", "Include description")).setDesc(t("\uAC01 \uAE30\uC0AC \uC544\uB798\uC5D0 feed description/summary\uB97C \uD568\uAED8 \uAE30\uB85D\uD569\uB2C8\uB2E4.", "Add feed description/summary text under each item.")).addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.includeDescription).onChange(async (value) => {
        this.plugin.settings.includeDescription = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName(t("\uC124\uBA85 \uCD5C\uB300 \uAE38\uC774", "Description max length")).setDesc(t("\uAC01 \uC124\uBA85 \uBE14\uB85D\uC758 \uCD5C\uB300 \uAE00\uC790 \uC218\uC785\uB2C8\uB2E4.", "Maximum characters for each description block.")).addText(
      (text) => text.setPlaceholder("500").setValue(String(this.plugin.settings.descriptionMaxLength)).onChange(async (value) => {
        const parsed = Number(value);
        if (Number.isFinite(parsed) && parsed > 0) {
          this.plugin.settings.descriptionMaxLength = Math.floor(parsed);
          await this.plugin.saveSettings();
        }
      })
    );
    new import_obsidian.Setting(containerEl).setName(t("\uBE48 \uB178\uD2B8\uB3C4 \uC0DD\uC131", "Write empty notes")).setDesc(t("\uACB0\uACFC\uAC00 \uC5C6\uC5B4\uB3C4 \uB9AC\uD3EC\uD2B8 \uB178\uD2B8\uB97C \uC0DD\uC131\uD569\uB2C8\uB2E4.", "If enabled, create a note even when no items are found.")).addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.writeEmptyNote).onChange(async (value) => {
        this.plugin.settings.writeEmptyNote = value;
        await this.plugin.saveSettings();
      })
    );
    if (!simpleMode) {
      containerEl.createEl("h3", { text: t("\uBC88\uC5ED", "Translation") });
      new import_obsidian.Setting(containerEl).setName(t("\uBC88\uC5ED \uC0AC\uC6A9", "Enable translation")).setDesc(t("\uB178\uD2B8 \uC791\uC131 \uC2DC \uBE44\uD55C\uAE00 \uD56D\uBAA9\uC744 \uC790\uB3D9 \uBC88\uC5ED\uD569\uB2C8\uB2E4.", "Translate non-Korean items while writing notes.")).addToggle(
        (toggle) => toggle.setValue(this.plugin.settings.translationEnabled).onChange(async (value) => {
          this.plugin.settings.translationEnabled = value;
          await this.plugin.saveSettings();
          this.display();
        })
      );
      new import_obsidian.Setting(containerEl).setName(t("\uBC88\uC5ED \uC81C\uACF5\uC790", "Translation provider")).setDesc(
        t(
          "\uC6F9 \uBC88\uC5ED\uC740 \uB85C\uCEEC AI \uC5C6\uC774 \uB3D9\uC791\uD569\uB2C8\uB2E4. Ollama\uB294 \uC120\uD0DD\uD55C \uB85C\uCEEC \uBAA8\uB378\uC744 \uC0AC\uC6A9\uD569\uB2C8\uB2E4.",
          "Web mode works without local AI. Ollama mode uses local model you choose."
        )
      ).addDropdown(
        (dropdown) => dropdown.addOption("web", t("\uC6F9 \uBC88\uC5ED(\uB85C\uCEEC AI \uC5C6\uC74C)", "Web translate (no local AI)")).addOption("ollama", t("\uB85C\uCEEC Ollama", "Local Ollama")).addOption("none", t("\uC0AC\uC6A9 \uC548 \uD568", "Disabled")).setValue(this.plugin.settings.translationProvider).onChange(async (value) => {
          this.plugin.settings.translationProvider = value === "web" || value === "ollama" || value === "none" ? value : "web";
          await this.plugin.saveSettings();
          this.display();
        })
      );
      new import_obsidian.Setting(containerEl).setName(t("\uB300\uC0C1 \uC5B8\uC5B4", "Target language")).setDesc(t("ko, en, ja \uAC19\uC740 ISO \uCF54\uB4DC.", "ISO code like ko, en, ja.")).addText(
        (text) => text.setPlaceholder("ko").setValue(this.plugin.settings.translationTargetLanguage).onChange(async (value) => {
          const normalized = value.trim().toLowerCase();
          if (normalized) {
            this.plugin.settings.translationTargetLanguage = normalized;
            await this.plugin.saveSettings();
          }
        })
      );
      new import_obsidian.Setting(containerEl).setName(t("\uBE44\uD55C\uAE00\uB9CC \uBC88\uC5ED", "Translate only non-Korean")).setDesc(t("\uD55C\uAE00\uC774 \uD3EC\uD568\uB41C \uD14D\uC2A4\uD2B8\uB294 \uBC88\uC5ED\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.", "If enabled, text already containing Hangul is skipped.")).addToggle(
        (toggle) => toggle.setValue(this.plugin.settings.translationOnlyNonKorean).onChange(async (value) => {
          this.plugin.settings.translationOnlyNonKorean = value;
          await this.plugin.saveSettings();
        })
      );
      new import_obsidian.Setting(containerEl).setName(t("\uC6D0\uBB38 \uC720\uC9C0", "Keep original text")).setDesc(t("\uBC88\uC5ED\uC744 \uCD94\uAC00\uD560 \uB54C \uC6D0\uBB38 \uC124\uBA85\uC744 \uC544\uB798\uC5D0 \uD568\uAED8 \uC720\uC9C0\uD569\uB2C8\uB2E4.", "When translation is added, keep original description below it.")).addToggle(
        (toggle) => toggle.setValue(this.plugin.settings.translationKeepOriginal).onChange(async (value) => {
          this.plugin.settings.translationKeepOriginal = value;
          await this.plugin.saveSettings();
        })
      );
      new import_obsidian.Setting(containerEl).setName(t("\uC81C\uBAA9 \uBC88\uC5ED", "Translate title")).setDesc(t("\uAE30\uC0AC \uC81C\uBAA9\uC744 \uBC88\uC5ED\uD569\uB2C8\uB2E4.", "Translate item titles.")).addToggle(
        (toggle) => toggle.setValue(this.plugin.settings.translationTranslateTitle).onChange(async (value) => {
          this.plugin.settings.translationTranslateTitle = value;
          await this.plugin.saveSettings();
        })
      );
      new import_obsidian.Setting(containerEl).setName(t("\uC124\uBA85 \uBC88\uC5ED", "Translate description")).setDesc(t("description/summary \uBE14\uB85D\uC744 \uBC88\uC5ED\uD569\uB2C8\uB2E4.", "Translate description/summary blocks.")).addToggle(
        (toggle) => toggle.setValue(this.plugin.settings.translationTranslateDescription).onChange(async (value) => {
          this.plugin.settings.translationTranslateDescription = value;
          await this.plugin.saveSettings();
        })
      );
      if (this.plugin.settings.translationProvider === "web") {
        new import_obsidian.Setting(containerEl).setName(t("\uC6F9 \uBC88\uC5ED \uC5D4\uB4DC\uD3EC\uC778\uD2B8", "Web translation endpoint")).setDesc(t("\uAE30\uBCF8 \uC5D4\uB4DC\uD3EC\uC778\uD2B8\uB294 \uBCF4\uD1B5 API \uD0A4 \uC5C6\uC774 \uB3D9\uC791\uD569\uB2C8\uB2E4.", "Default endpoint usually works without API key.")).addText(
          (text) => text.setPlaceholder("https://translate.googleapis.com/translate_a/single").setValue(this.plugin.settings.translationWebEndpoint).onChange(async (value) => {
            const normalized = normalizeHttpBaseUrl(value);
            if (normalized) {
              this.plugin.settings.translationWebEndpoint = normalized;
              await this.plugin.saveSettings();
            }
          })
        );
      }
      if (this.plugin.settings.translationProvider === "ollama") {
        new import_obsidian.Setting(containerEl).setName(t("Ollama \uAE30\uBCF8 URL", "Ollama base URL")).setDesc(t("\uC608\uC2DC: http://127.0.0.1:11434", "Example: http://127.0.0.1:11434")).addText(
          (text) => text.setPlaceholder("http://127.0.0.1:11434").setValue(this.plugin.settings.ollamaBaseUrl).onChange(async (value) => {
            const normalized = normalizeHttpBaseUrl(value);
            if (normalized) {
              this.plugin.settings.ollamaBaseUrl = normalized;
              await this.plugin.saveSettings();
            }
          })
        );
        const modelOptions = this.plugin.getOllamaModelOptionsForUi();
        const recommendedModel = this.plugin.getRecommendedOllamaModelForUi();
        const modelDescription = recommendedModel ? t(
          `\uD0D0\uC9C0\uB428: ${modelOptions.length} / \uCD94\uCC9C: ${recommendedModel}`,
          `Detected: ${modelOptions.length} / Recommended: ${recommendedModel}`
        ) : t("\uD0D0\uC9C0\uB41C \uBAA8\uB378\uC774 \uC5C6\uC2B5\uB2C8\uB2E4. \uBA3C\uC800 \uC0C8\uB85C\uACE0\uCE68\uD558\uC138\uC694.", "No detected models yet. Click refresh first.");
        new import_obsidian.Setting(containerEl).setName(t("Ollama \uBAA8\uB378", "Ollama model")).setDesc(modelDescription).addDropdown((dropdown) => {
          if (modelOptions.length === 0) {
            dropdown.addOption("", t("(\uBA3C\uC800 \uBAA8\uB378 \uC0C8\uB85C\uACE0\uCE68)", "(refresh models first)"));
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
        }).addButton(
          (button) => button.setButtonText(t("\uBAA8\uB378 \uC0C8\uB85C\uACE0\uCE68", "Refresh models")).onClick(async () => {
            await this.plugin.refreshOllamaModels(true);
            this.display();
          })
        );
        new import_obsidian.Setting(containerEl).setName(t("\uB9C8\uC9C0\uB9C9 \uBAA8\uB378 \uC0C8\uB85C\uACE0\uCE68", "Last model refresh")).setDesc(this.plugin.settings.ollamaLastModelRefreshIso || t("\uC544\uC9C1 \uC0C8\uB85C\uACE0\uCE68 \uC548 \uB428", "Not refreshed yet"));
      }
    }
    containerEl.createEl("h3", { text: t("\uD544\uD130\uB9C1 \xB7 \uC911\uBCF5\uC81C\uAC70 \xB7 \uC810\uC218", "Filtering, Dedupe, Scoring") });
    if (!simpleMode) {
      new import_obsidian.Setting(containerEl).setName(t("\uACE0\uAE09 \uC911\uBCF5 \uC81C\uAC70", "Enhanced dedupe")).setDesc(t("\uC815\uADDC\uD654\uB41C \uB9C1\uD06C/\uC81C\uBAA9\uC744 \uC0AC\uC6A9\uD574 \uD53C\uB4DC \uAC04 \uC911\uBCF5\uC744 \uC81C\uAC70\uD569\uB2C8\uB2E4.", "Deduplicate across feeds using normalized link/title.")).addToggle(
        (toggle) => toggle.setValue(this.plugin.settings.enhancedDedupeEnabled).onChange(async (value) => {
          this.plugin.settings.enhancedDedupeEnabled = value;
          await this.plugin.saveSettings();
        })
      );
      new import_obsidian.Setting(containerEl).setName(t("\uD0A4\uC6CC\uB4DC \uD544\uD130", "Keyword filter")).setDesc(t("\uC218\uC9D1 \uD56D\uBAA9\uC5D0 \uD3EC\uD568/\uC81C\uC678 \uD0A4\uC6CC\uB4DC \uD544\uD130\uB97C \uC801\uC6A9\uD569\uB2C8\uB2E4.", "Apply include/exclude keyword filter to collected items.")).addToggle(
        (toggle) => toggle.setValue(this.plugin.settings.keywordFilterEnabled).onChange(async (value) => {
          this.plugin.settings.keywordFilterEnabled = value;
          await this.plugin.saveSettings();
        })
      );
      new import_obsidian.Setting(containerEl).setName(t("\uD3EC\uD568 \uD0A4\uC6CC\uB4DC", "Include keywords")).setDesc(t("\uC27C\uD45C \uB610\uB294 \uC904\uBC14\uAFC8\uC73C\uB85C \uAD6C\uBD84. \uD558\uB098\uB77C\uB3C4 \uB9E4\uCE6D\uB418\uBA74 \uD1B5\uACFC.", "Comma or newline separated. Match any keyword.")).addTextArea(
        (text) => text.setPlaceholder("ai, bitcoin, fed").setValue(this.plugin.settings.includeKeywords).onChange(async (value) => {
          this.plugin.settings.includeKeywords = value;
          await this.plugin.saveSettings();
        })
      );
      new import_obsidian.Setting(containerEl).setName(t("\uC81C\uC678 \uD0A4\uC6CC\uB4DC", "Exclude keywords")).setDesc(t("\uC27C\uD45C \uB610\uB294 \uC904\uBC14\uAFC8\uC73C\uB85C \uAD6C\uBD84. \uB9E4\uCE6D\uB418\uBA74 \uC81C\uC678.", "Comma or newline separated. Exclude if matched.")).addTextArea(
        (text) => text.setPlaceholder("sponsored, advertisement").setValue(this.plugin.settings.excludeKeywords).onChange(async (value) => {
          this.plugin.settings.excludeKeywords = value;
          await this.plugin.saveSettings();
        })
      );
    }
    new import_obsidian.Setting(containerEl).setName(t("\uD1A0\uD53D \uAD00\uB828\uC131 \uD544\uD130", "Topic relevance filter")).setDesc(
      t(
        "\uD53C\uB4DC \uD1A0\uD53D(\uC778\uACF5\uC9C0\uB2A5/\uAD50\uC721/\uBD80\uB3D9\uC0B0/\uC8FC\uC2DD/\uBE44\uD2B8\uCF54\uC778/\uC815\uCE58)\uC5D0 \uB9DE\uB294 \uAE30\uC0AC\uB9CC \uD1B5\uACFC\uC2DC\uD0B5\uB2C8\uB2E4.",
        "Keep only items that match the feed topic (AI/Education/Real Estate/Stocks/Bitcoin/Politics)."
      )
    ).addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.topicRelevanceFilterEnabled).onChange(async (value) => {
        this.plugin.settings.topicRelevanceFilterEnabled = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName(t("\uD1A0\uD53D \uAD00\uB828\uC131 \uCD5C\uC18C \uC810\uC218", "Minimum topic relevance score")).setDesc(
      t(
        "\uB192\uC77C\uC218\uB85D \uBB34\uAD00 \uAE30\uC0AC \uC81C\uAC70\uAC00 \uAC15\uD574\uC9D1\uB2C8\uB2E4. \uAD8C\uC7A5: 2~4",
        "Higher value removes off-topic items more aggressively. Recommended: 2-4"
      )
    ).addText(
      (text) => text.setPlaceholder("2").setValue(String(this.plugin.settings.topicRelevanceMinScore)).onChange(async (value) => {
        const parsed = Number(value);
        if (Number.isFinite(parsed) && parsed >= MIN_TOPIC_RELEVANCE_MIN_SCORE && parsed <= MAX_TOPIC_RELEVANCE_MIN_SCORE) {
          this.plugin.settings.topicRelevanceMinScore = Math.floor(parsed);
          await this.plugin.saveSettings();
        }
      })
    );
    new import_obsidian.Setting(containerEl).setName(t("\uD1A0\uD53D \uC6B0\uC120\uC21C\uC704 \uAC00\uC911\uCE58", "Topic priority weighting")).setDesc(
      t(
        "\uC6B0\uC120\uC21C\uC704 \uAE30\uBC18\uC73C\uB85C \uAE30\uC0AC \uC810\uC218\uC5D0 \uAC00\uC911\uCE58\uB97C \uC90D\uB2C8\uB2E4.",
        "Apply ranking boost by topic priority."
      )
    ).addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.topicPriorityEnabled).onChange(async (value) => {
        this.plugin.settings.topicPriorityEnabled = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName(t("\uD1A0\uD53D \uC6B0\uC120\uC21C\uC704 \uC21C\uC11C", "Topic priority order")).setDesc(
      t(
        "\uC27C\uD45C/\uC904\uBC14\uAFC8\uC73C\uB85C \uC785\uB825. \uC608: \uC778\uACF5\uC9C0\uB2A5, \uAD50\uC721, \uB300\uD55C\uBBFC\uAD6D \uBD80\uB3D9\uC0B0, \uC8FC\uC2DD, \uBE44\uD2B8\uCF54\uC778, \uC815\uCE58",
        "Comma/newline list. Example: AI, Education, Korea Real Estate, Stocks, Bitcoin, Politics"
      )
    ).addTextArea(
      (text) => text.setPlaceholder(DEFAULT_SETTINGS.topicPriorityOrder).setValue(this.plugin.settings.topicPriorityOrder).onChange(async (value) => {
        this.plugin.settings.topicPriorityOrder = value;
        refreshPriorityDiagnostics();
        await this.plugin.saveSettings();
      })
    );
    const priorityPreviewSetting = new import_obsidian.Setting(containerEl).setName(t("\uC801\uC6A9 \uC6B0\uC120\uC21C\uC704 \uBBF8\uB9AC\uBCF4\uAE30", "Applied priority preview")).setDesc(formatTopicPriorityDiagnostic(this.plugin.settings.topicPriorityOrder, lang));
    const priorityFeedAlignmentSetting = new import_obsidian.Setting(containerEl).setName(t("\uC2E4\uC2DC\uAC04 \uD53C\uB4DC \uBC18\uC601 \uC0C1\uD0DC", "Live feed alignment")).setDesc(
      formatPriorityFeedAlignmentDiagnostic(
        this.plugin.settings.topicPriorityOrder,
        this.plugin.settings.feeds,
        lang
      )
    );
    new import_obsidian.Setting(containerEl).setName(t("\uD53C\uB4DC \uD1A0\uD53D\uC5D0\uC11C \uC6B0\uC120\uC21C\uC704 \uB3D9\uAE30\uD654", "Sync priority from feed topics")).setDesc(
      t(
        "\uD604\uC7AC \uD53C\uB4DC \uBAA9\uB85D\uC758 \uD1A0\uD53D \uBD84\uD3EC\uB97C \uAE30\uC900\uC73C\uB85C \uC6B0\uC120\uC21C\uC704 \uC785\uB825\uAC12\uC744 \uC790\uB3D9 \uCC44\uC6C1\uB2C8\uB2E4.",
        "Auto-fill priority order from current feed topic distribution."
      )
    ).addButton(
      (button) => button.setButtonText(t("\uC9C0\uAE08 \uBC18\uC601", "Sync now")).onClick(async () => {
        this.plugin.settings.topicPriorityOrder = buildPriorityOrderFromFeedTopics(
          this.plugin.settings.feeds,
          lang
        );
        await this.plugin.saveSettings();
        refreshPriorityDiagnostics();
        new import_obsidian.Notice(
          t("\uD53C\uB4DC \uD1A0\uD53D \uAE30\uC900\uC73C\uB85C \uC6B0\uC120\uC21C\uC704\uB97C \uB3D9\uAE30\uD654\uD588\uC2B5\uB2C8\uB2E4.", "Priority order synced from feed topics."),
          4e3
        );
      })
    );
    const refreshPriorityDiagnostics = () => {
      priorityPreviewSetting.setDesc(
        formatTopicPriorityDiagnostic(this.plugin.settings.topicPriorityOrder, lang)
      );
      priorityFeedAlignmentSetting.setDesc(
        formatPriorityFeedAlignmentDiagnostic(
          this.plugin.settings.topicPriorityOrder,
          this.plugin.settings.feeds,
          lang
        )
      );
      topicCoverageSetting.setDesc(formatTopicFeedCoverageDiagnostic(this.plugin.settings.feeds, lang));
      if (recommendedCoverageSetting) {
        recommendedCoverageSetting.setDesc(
          formatRecommendedFeedCoverageDiagnostic(
            this.plugin.settings.feeds,
            this.plugin.settings.topicPriorityOrder,
            lang
          )
        );
      }
    };
    new import_obsidian.Setting(containerEl).setName(t("\uC6B0\uC120\uC21C\uC704 \uCD5C\uB300 \uAC00\uC911\uCE58", "Priority max boost")).setDesc(
      t(
        "\uCCAB \uBC88\uC9F8 \uC6B0\uC120\uC21C\uC704 \uD1A0\uD53D\uC5D0 \uBD80\uC5EC\uD560 \uCD5C\uB300 \uC810\uC218\uC785\uB2C8\uB2E4. 0\uC774\uBA74 \uBE44\uD65C\uC131.",
        "Maximum score boost for the top-priority topic. 0 disables boost."
      )
    ).addText(
      (text) => text.setPlaceholder("6").setValue(String(this.plugin.settings.topicPriorityMaxBoost)).onChange(async (value) => {
        const parsed = Number(value);
        if (Number.isFinite(parsed) && parsed >= MIN_TOPIC_PRIORITY_MAX_BOOST && parsed <= MAX_TOPIC_PRIORITY_MAX_BOOST) {
          this.plugin.settings.topicPriorityMaxBoost = Math.round(parsed * 100) / 100;
          await this.plugin.saveSettings();
          refreshPriorityDiagnostics();
        }
      })
    );
    new import_obsidian.Setting(containerEl).setName(t("\uC120\uD638\uB3C4 \uD559\uC2B5 \uC801\uC6A9", "Apply preference learning")).setDesc(
      t(
        "\uC9C1\uC811 \uD45C\uC2DC\uD55C \uC120\uD638/\uBE44\uC120\uD638 \uD53C\uB4DC\uBC31\uC744 \uAE30\uC0AC \uC120\uBCC4 \uC810\uC218\uC5D0 \uBC18\uC601\uD569\uB2C8\uB2E4.",
        "Use your like/dislike feedback to adjust ranking."
      )
    ).addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.preferenceLearningEnabled).onChange(async (value) => {
        this.plugin.settings.preferenceLearningEnabled = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName(t("\uD53C\uB4DC\uBC31 \uCCB4\uD06C\uBC15\uC2A4 \uCD9C\uB825", "Write feedback checkboxes")).setDesc(
      t(
        "\uAC01 \uAE30\uC0AC \uC544\uB798\uC5D0 \uC120\uD638/\uBE44\uC120\uD638 \uCCB4\uD06C\uBC15\uC2A4\uB97C \uB123\uC5B4 \uD559\uC2B5 \uB370\uC774\uD130\uB97C \uC27D\uAC8C \uB0A8\uAE41\uB2C8\uB2E4.",
        "Write like/dislike checkboxes under each item for easy feedback."
      )
    ).addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.preferenceFeedbackTemplateEnabled).onChange(async (value) => {
        this.plugin.settings.preferenceFeedbackTemplateEnabled = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName(t("\uC120\uD638\uB3C4 \uC810\uC218 \uAC00\uC911\uCE58", "Preference score weight")).setDesc(
      t(
        "\uD559\uC2B5 \uC810\uC218\uAC00 \uCD5C\uC885 \uC21C\uC704\uC5D0 \uBBF8\uCE58\uB294 \uC601\uD5A5\uB3C4\uC785\uB2C8\uB2E4. \uAD8C\uC7A5: 1~3",
        "How strongly learned preference affects final ranking. Recommended: 1-3"
      )
    ).addText(
      (text) => text.setPlaceholder("2").setValue(String(this.plugin.settings.preferenceScoreWeight)).onChange(async (value) => {
        const parsed = Number(value);
        if (Number.isFinite(parsed) && parsed >= MIN_PREFERENCE_SCORE_WEIGHT && parsed <= MAX_PREFERENCE_SCORE_WEIGHT) {
          this.plugin.settings.preferenceScoreWeight = Math.round(parsed * 100) / 100;
          await this.plugin.saveSettings();
        }
      })
    );
    const learnedTokenCount = Object.keys(this.plugin.settings.preferenceTokenWeights || {}).length;
    const learnedStatus = this.plugin.settings.preferenceLastLearnedAtIso ? t(
      `\uB9C8\uC9C0\uB9C9 \uD559\uC2B5: ${this.plugin.settings.preferenceLastLearnedAtIso} / \uD1A0\uD070 ${learnedTokenCount}\uAC1C`,
      `Last learned: ${this.plugin.settings.preferenceLastLearnedAtIso} / tokens ${learnedTokenCount}`
    ) : t(`\uC544\uC9C1 \uD559\uC2B5 \uC548 \uB428 / \uD1A0\uD070 ${learnedTokenCount}\uAC1C`, `Not learned yet / tokens ${learnedTokenCount}`);
    new import_obsidian.Setting(containerEl).setName(t("\uC120\uD638\uB3C4 \uD559\uC2B5 \uC0C1\uD0DC", "Preference learning status")).setDesc(learnedStatus).addButton(
      (button) => button.setButtonText(t("\uC9C0\uAE08 \uD559\uC2B5", "Learn now")).onClick(async () => {
        await this.plugin.refreshPreferenceLearningProfile(true);
        this.display();
      })
    );
    if (!simpleMode) {
      new import_obsidian.Setting(containerEl).setName(t("\uC810\uC218 \uD15C\uD50C\uB9BF", "Score template")).setDesc(t("\uAC01 \uAE30\uC0AC \uC544\uB798\uC5D0 \uAE30\uBCF8 4\uC694\uC18C \uC810\uC218 \uB77C\uC778\uC744 \uCD94\uAC00\uD569\uB2C8\uB2E4.", "Add default 4-factor score lines under each item.")).addToggle(
        (toggle) => toggle.setValue(this.plugin.settings.scoreTemplateEnabled).onChange(async (value) => {
          this.plugin.settings.scoreTemplateEnabled = value;
          await this.plugin.saveSettings();
        })
      );
      new import_obsidian.Setting(containerEl).setName(t("\uAE30\uBCF8 \uC810\uC218\uAC12", "Default score value")).setDesc(t("Impact/Actionability/Timing/Confidence\uC758 \uAE30\uBCF8\uAC12(1-5).", "Default value for Impact/Actionability/Timing/Confidence (1-5).")).addText(
        (text) => text.setPlaceholder("3").setValue(String(this.plugin.settings.scoreDefaultValue)).onChange(async (value) => {
          const parsed = Number(value);
          if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 5) {
            this.plugin.settings.scoreDefaultValue = Math.floor(parsed);
            await this.plugin.saveSettings();
          }
        })
      );
      new import_obsidian.Setting(containerEl).setName(t("\uC561\uC158 \uC784\uACC4\uAC12", "Action threshold")).setDesc(t("\uC561\uC158 \uD6C4\uBCF4 \uD310\uB2E8\uC6A9 \uCD1D\uC810 \uAE30\uC900\uAC12\uC785\uB2C8\uB2E4.", "Score total threshold reference for action candidates.")).addText(
        (text) => text.setPlaceholder("14").setValue(String(this.plugin.settings.scoreActionThreshold)).onChange(async (value) => {
          const parsed = Number(value);
          if (Number.isFinite(parsed) && parsed > 0) {
            this.plugin.settings.scoreActionThreshold = Math.floor(parsed);
            await this.plugin.saveSettings();
          }
        })
      );
      new import_obsidian.Setting(containerEl).setName(t("\uB9C8\uC9C0\uB9C9 \uC708\uB3C4\uC6B0 \uD3EC\uC778\uD130", "Last window pointer")).setDesc(this.plugin.settings.lastWindowEndIso || t("\uC544\uC9C1 \uC124\uC815\uB418\uC9C0 \uC54A\uC74C", "Not set yet")).addButton(
        (button) => button.setButtonText(t("\uCD08\uAE30\uD654", "Reset")).onClick(async () => {
          this.plugin.settings.lastWindowEndIso = "";
          await this.plugin.saveSettings();
          this.display();
        })
      );
      containerEl.createEl("h3", { text: t("RSS Dashboard \uB3D9\uAE30\uD654", "RSS Dashboard Sync") });
      new import_obsidian.Setting(containerEl).setName(t("RSS Dashboard \uB3D9\uAE30\uD654 \uC0AC\uC6A9", "Enable RSS Dashboard sync")).setDesc(t("RSS Dashboard data.json\uC758 \uD53C\uB4DC \uBAA9\uB85D\uC744 \uC790\uB3D9 \uAC00\uC838\uC635\uB2C8\uB2E4.", "Auto-import feed list from RSS Dashboard data.json.")).addToggle(
        (toggle) => toggle.setValue(this.plugin.settings.rssDashboardSyncEnabled).onChange(async (value) => {
          this.plugin.settings.rssDashboardSyncEnabled = value;
          await this.plugin.saveSettings();
        })
      );
      new import_obsidian.Setting(containerEl).setName(t("RSS Dashboard \uB370\uC774\uD130 \uACBD\uB85C", "RSS Dashboard data path")).setDesc(t("RSS Dashboard \uC124\uC815 \uD30C\uC77C\uC758 Vault \uAE30\uC900 \uACBD\uB85C\uC785\uB2C8\uB2E4.", "Vault-relative path to RSS Dashboard settings file.")).addText(
        (text) => text.setPlaceholder(".obsidian/plugins/rss-dashboard/data.json").setValue(this.plugin.settings.rssDashboardDataPath).onChange(async (value) => {
          this.plugin.settings.rssDashboardDataPath = value.trim() || DEFAULT_SETTINGS.rssDashboardDataPath;
          await this.plugin.saveSettings();
        })
      );
      const syncedFeedCount = this.plugin.settings.feeds.filter(
        (feed) => feed.source === "rss-dashboard"
      ).length;
      const syncStatus = this.plugin.settings.rssDashboardLastSyncAtIso ? t(
        `\uB9C8\uC9C0\uB9C9 \uB3D9\uAE30\uD654: ${this.plugin.settings.rssDashboardLastSyncAtIso} / \uB3D9\uAE30\uD654 \uD53C\uB4DC: ${syncedFeedCount}`,
        `Last sync: ${this.plugin.settings.rssDashboardLastSyncAtIso} / synced feeds: ${syncedFeedCount}`
      ) : t(`\uC544\uC9C1 \uB3D9\uAE30\uD654 \uC548 \uB428 / \uB3D9\uAE30\uD654 \uD53C\uB4DC: ${syncedFeedCount}`, `No sync yet / synced feeds: ${syncedFeedCount}`);
      new import_obsidian.Setting(containerEl).setName(t("\uB3D9\uAE30\uD654 \uC0C1\uD0DC", "Dashboard sync status")).setDesc(syncStatus).addButton(
        (button) => button.setButtonText(t("\uC9C0\uAE08 \uB3D9\uAE30\uD654", "Sync now")).onClick(async () => {
          await this.plugin.syncFeedsFromRssDashboard(true, true);
          this.display();
        })
      );
    }
    containerEl.createEl("h3", { text: t("\uD53C\uB4DC \uBAA9\uB85D", "Feeds") });
    recommendedCoverageSetting = new import_obsidian.Setting(containerEl).setName(t("\uCD94\uCC9C \uD53C\uB4DC \uC801\uC6A9 \uD604\uD669", "Recommended feed status")).setDesc(
      formatRecommendedFeedCoverageDiagnostic(
        this.plugin.settings.feeds,
        this.plugin.settings.topicPriorityOrder,
        lang
      )
    );
    new import_obsidian.Setting(containerEl).setName(t("\uCD94\uCC9C RSS \uC790\uB3D9 \uCD94\uAC00", "Auto add recommended RSS")).setDesc(
      t(
        "\uC2E0\uB8B0\uB3C4 \uB192\uC740 \uCD94\uCC9C \uD53C\uB4DC\uB97C \uC8FC\uC81C\uBCC4\uB85C \uC790\uB3D9 \uCC44\uC6C1\uB2C8\uB2E4. (\uC6B0\uC120\uC21C\uC704 + \uC2E4\uC2DC\uAC04 \uD53C\uB4DC \uAC1C\uC218 \uAE30\uC900)",
        "Auto-fill trusted recommended feeds by topic (priority + live feed counts)."
      )
    ).addButton(
      (button) => button.setButtonText(t("\uBAA9\uB85D \uBCF4\uAE30", "Preview list")).onClick(() => {
        this.plugin.openRecommendedFeedsModal();
      })
    ).addButton(
      (button) => button.setButtonText(t("\uC8FC\uC81C\uB2F9 2\uAC1C \uCC44\uC6B0\uAE30", "Fill 2/topic")).onClick(async () => {
        await this.plugin.addRecommendedFeedsByTarget(RECOMMENDED_MIN_FEEDS_PER_TOPIC, true);
        this.display();
      })
    ).addButton(
      (button) => button.setButtonText(t("\uC8FC\uC81C\uB2F9 3\uAC1C \uCC44\uC6B0\uAE30", "Fill 3/topic")).onClick(async () => {
        await this.plugin.addRecommendedFeedsByTarget(RECOMMENDED_MAX_FEEDS_PER_TOPIC, true);
        this.display();
      })
    );
    if (!simpleMode) {
      new import_obsidian.Setting(containerEl).setName(t("\uC778\uD130\uB137 \uAC80\uC0C9 \uD53C\uB4DC \uCD94\uAC00", "Add web-search feeds")).setDesc(
        t(
          "Google News \uAC80\uC0C9 RSS\uB97C \uC6B0\uC120\uC21C\uC704 \uD1A0\uD53D\uBCC4\uB85C 1\uAC1C\uC529 \uCD94\uAC00\uD569\uB2C8\uB2E4. (\uBCF4\uC870\uC6A9)",
          "Add one Google News search RSS feed per priority topic. (supplementary)"
        )
      ).addButton(
        (button) => button.setButtonText(t("\uAC80\uC0C9 \uD53C\uB4DC \uCD94\uAC00", "Add search feeds")).onClick(async () => {
          await this.plugin.addGoogleNewsSearchFeedsForPriority(true);
          this.display();
        })
      );
    }
    new import_obsidian.Setting(containerEl).setName(t("\uD53C\uB4DC \uCD94\uAC00", "Add feed")).setDesc(t("\uD1A0\uD53D \uB77C\uBCA8\uACFC \uD568\uAED8 RSS/Atom \uD53C\uB4DC\uB97C \uCD94\uAC00\uD569\uB2C8\uB2E4.", "Add an RSS/Atom feed with a topic label.")).addButton(
      (button) => button.setButtonText(t("\uCD94\uAC00", "Add")).onClick(async () => {
        const orderedTopics = parseTopicPriorityOrder(this.plugin.settings.topicPriorityOrder);
        const defaultTopicKey = orderedTopics[0] || DEFAULT_TOPIC_PRIORITY_KEYS[0];
        this.plugin.settings.feeds.push({
          id: createFeedId(),
          topic: getTopicLabel(defaultTopicKey, lang),
          name: "",
          url: "",
          enabled: true,
          source: "manual"
        });
        await this.plugin.saveSettings();
        this.display();
      })
    );
    if (this.plugin.settings.feeds.length === 0) {
      containerEl.createEl("p", {
        text: t("\uC544\uC9C1 \uD53C\uB4DC\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4. \uC218\uC9D1\uC744 \uC2DC\uC791\uD558\uB824\uBA74 \uCD5C\uC18C 1\uAC1C \uD53C\uB4DC\uB97C \uCD94\uAC00\uD558\uC138\uC694.", "No feeds configured yet. Add at least one feed to start capturing.")
      });
      return;
    }
    this.plugin.settings.feeds.forEach((feed, index) => {
      const row = containerEl.createDiv({ cls: "rss-insight-feed-row" });
      const sourceLabel = feed.source === "rss-dashboard" ? t("RSS Dashboard \uB3D9\uAE30\uD654", "RSS Dashboard sync") : t("\uC218\uB3D9", "Manual");
      new import_obsidian.Setting(row).setName(`${t("\uD53C\uB4DC", "Feed")} ${index + 1}`).setDesc(`${sourceLabel} / ${t("\uC774 \uD53C\uB4DC\uB97C \uCF1C\uAC70\uB098 \uC0AD\uC81C\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.", "Enable or remove this feed.")}`).addToggle(
        (toggle) => toggle.setValue(feed.enabled).onChange(async (value) => {
          feed.enabled = value;
          await this.plugin.saveSettings();
          refreshPriorityDiagnostics();
        })
      ).addExtraButton(
        (button) => button.setIcon("trash").setTooltip(t("\uD53C\uB4DC \uC0AD\uC81C", "Delete feed")).onClick(async () => {
          this.plugin.settings.feeds = this.plugin.settings.feeds.filter(
            (candidate) => candidate.id !== feed.id
          );
          await this.plugin.saveSettings();
          this.display();
        })
      );
      new import_obsidian.Setting(row).setName(t("\uD1A0\uD53D", "Topic")).setDesc(t("\uCD9C\uB825 \uB178\uD2B8\uC758 \uC139\uC158 \uC81C\uBAA9\uC73C\uB85C \uC0AC\uC6A9\uB429\uB2C8\uB2E4.", "Used as section heading in output notes.")).addText(
        (text) => text.setValue(feed.topic).onChange(async (value) => {
          feed.topic = normalizeTopic(value);
          await this.plugin.saveSettings();
          refreshPriorityDiagnostics();
        })
      );
      new import_obsidian.Setting(row).setName(t("\uD53C\uB4DC \uC774\uB984", "Feed name")).setDesc(t("\uC774 \uC18C\uC2A4\uC758 \uD45C\uC2DC \uC774\uB984\uC785\uB2C8\uB2E4.", "Display name for this source.")).addText(
        (text) => text.setValue(feed.name).onChange(async (value) => {
          feed.name = value.trim();
          await this.plugin.saveSettings();
        })
      );
      new import_obsidian.Setting(row).setName(t("\uD53C\uB4DC URL", "Feed URL")).setDesc(t("RSS \uB610\uB294 Atom URL.", "RSS or Atom URL.")).addText(
        (text) => text.setPlaceholder("https://example.com/rss").setValue(feed.url).onChange(async (value) => {
          feed.url = value.trim();
          await this.plugin.saveSettings();
          refreshPriorityDiagnostics();
        })
      );
    });
  }
};
