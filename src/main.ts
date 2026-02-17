import {
  App,
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
}

interface CaptureOutcome {
  notePath: string | null;
  totalItems: number;
  effectiveMaxItemsPerWindow: number;
  feedErrors: string[];
  feedsChecked: number;
  itemsWithoutDate: number;
  itemsFilteredByKeyword: number;
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

interface RssWindowCaptureSettings {
  uiLanguage: UiLanguage;
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
  topicDiversityMinPerTopic: 1,
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
const MIN_TOPIC_DIVERSITY_PER_TOPIC = 0;
const MAX_TOPIC_DIVERSITY_PER_TOPIC = 3;
const MIN_TOPIC_DIVERSITY_PENALTY = 0;
const MAX_TOPIC_DIVERSITY_PENALTY = 5;
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

  const sortedTopicsByTopScore = (): string[] =>
    Array.from(perTopic.entries())
      .filter(([, queue]) => queue.length > 0)
      .sort((a, b) => {
        const aTop = a[1][0]?.qualityScore ?? Number.NEGATIVE_INFINITY;
        const bTop = b[1][0]?.qualityScore ?? Number.NEGATIVE_INFINITY;
        if (aTop !== bTop) {
          return bTop - aTop;
        }
        return a[0].localeCompare(b[0]);
      })
      .map(([topic]) => topic);

  const takeTopFromTopic = (topic: string): boolean => {
    const queue = perTopic.get(topic);
    if (!queue || queue.length === 0) {
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

  for (let pass = 0; pass < minPerTopic; pass += 1) {
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

    for (const [topic, queue] of perTopic.entries()) {
      if (queue.length === 0) {
        continue;
      }
      const rawScore = queue[0]?.qualityScore ?? Number.NEGATIVE_INFINITY;
      const selectedCount = selectedByTopic.get(topic) ?? 0;
      const adjustedScore = rawScore - (selectedCount * penaltyPerSelected);
      if (
        adjustedScore > bestAdjustedScore
        || (adjustedScore === bestAdjustedScore && rawScore > bestRawScore)
        || (adjustedScore === bestAdjustedScore && rawScore === bestRawScore && topic < bestTopic)
      ) {
        bestTopic = topic;
        bestAdjustedScore = adjustedScore;
        bestRawScore = rawScore;
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
    const parsedTopicMin = Number(this.settings.topicDiversityMinPerTopic);
    const safeTopicMin = Number.isFinite(parsedTopicMin) ? parsedTopicMin : 1;
    this.settings.topicDiversityMinPerTopic = Math.max(
      MIN_TOPIC_DIVERSITY_PER_TOPIC,
      Math.min(MAX_TOPIC_DIVERSITY_PER_TOPIC, Math.floor(safeTopicMin)),
    );
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
    let itemsDeduped = 0;
    let itemsFilteredByQuality = 0;
    const maxItemsPerWindow = this.resolveEffectiveMaxItemsPerWindow(feeds);
    let itemLimitHit = false;
    const includeKeywords = parseKeywordList(this.settings.includeKeywords);
    const excludeKeywords = parseKeywordList(this.settings.excludeKeywords);

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

        if (this.settings.keywordFilterEnabled) {
          const haystack = normalizeKeywordHaystack(
            `${item.title}\n${item.description}\n${item.link}\n${feed.name}\n${feed.topic}`,
          );
          if (!matchesKeywordFilter(haystack, includeKeywords, excludeKeywords)) {
            itemsFilteredByKeyword += 1;
            continue;
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
      .map((row) => ({
        row,
        qualityScore: scoreWindowItemQuality(row.item, windowEnd),
      }))
      .sort((a, b) => {
        if (a.qualityScore !== b.qualityScore) {
          return b.qualityScore - a.qualityScore;
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

    lines.push("---");
    lines.push('plugin: "rss-insight"');
    lines.push(`generated_at: "${escapeYamlString(new Date().toISOString())}"`);
    lines.push(`window_start: "${escapeYamlString(windowStart.toISOString())}"`);
    lines.push(`window_end: "${escapeYamlString(windowEnd.toISOString())}"`);
    lines.push(`feeds_checked: ${feedsChecked}`);
    lines.push(`items_count: ${totalItems}`);
    lines.push(`items_without_date: ${itemsWithoutDate}`);
    lines.push(`items_filtered_by_keyword: ${itemsFilteredByKeyword}`);
    lines.push(`items_deduped: ${itemsDeduped}`);
    lines.push(`items_filtered_by_quality: ${itemsFilteredByQuality}`);
    lines.push(`feed_errors: ${feedErrors.length}`);
    lines.push(`max_items_per_window_base: ${this.settings.maxItemsPerWindow}`);
    lines.push(`max_items_per_window_effective: ${effectiveMaxItemsPerWindow}`);
    lines.push(`max_items_per_window: ${effectiveMaxItemsPerWindow}`);
    lines.push(`item_limit_hit: ${itemLimitHit ? "true" : "false"}`);
    lines.push(`translation_provider: "${translationStats.provider}"`);
    if (translationStats.model) {
      lines.push(`translation_model: "${escapeYamlString(translationStats.model)}"`);
    }
    lines.push(`titles_translated: ${translationStats.titlesTranslated}`);
    lines.push(`descriptions_translated: ${translationStats.descriptionsTranslated}`);
    lines.push(`translation_errors: ${translationStats.errors.length}`);
    lines.push(`score_template_enabled: ${this.settings.scoreTemplateEnabled ? "true" : "false"}`);
    lines.push("---");
    lines.push("");

    lines.push(`# RSS Capture ${formatLocalDateTime(windowEnd)}`);
    lines.push("");
    lines.push(`- Window start: ${formatLocalDateTime(windowStart)}`);
    lines.push(`- Window end: ${formatLocalDateTime(windowEnd)}`);
    lines.push(`- Feeds checked: ${feedsChecked}`);
    lines.push(`- Items captured: ${totalItems}`);
    lines.push(`- Filtered by keywords: ${itemsFilteredByKeyword}`);
    lines.push(`- Deduped: ${itemsDeduped}`);
    lines.push(`- Filtered by quality: ${itemsFilteredByQuality}`);
    lines.push(`- Max items per window (base/effective): ${this.settings.maxItemsPerWindow} / ${effectiveMaxItemsPerWindow}`);
    lines.push(`- Item limit hit: ${itemLimitHit ? "yes" : "no"}`);
    lines.push(`- Topic diversity minimum per topic: ${this.settings.topicDiversityMinPerTopic}`);
    lines.push(`- Topic diversity penalty: ${this.settings.topicDiversityPenaltyPerSelected.toFixed(2)}`);
    lines.push(`- Translation provider: ${translationStats.provider}`);
    lines.push(`- Titles translated: ${translationStats.titlesTranslated}`);
    lines.push(`- Descriptions translated: ${translationStats.descriptionsTranslated}`);
    if (this.settings.scoreTemplateEnabled) {
      lines.push(`- Action candidate threshold: ${this.settings.scoreActionThreshold}+`);
    }
    lines.push("");

    const topics = Array.from(grouped.keys()).sort((a, b) => a.localeCompare(b));

    if (topics.length === 0) {
      lines.push("## Items");
      lines.push("");
      lines.push("No items were found in this window.");
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
          : row.item.publishedRaw || "unknown";

        lines.push(`### ${displayTitle}`);
        lines.push(`- Source: ${row.feed.name || row.feed.url}`);
        lines.push(`- Published: ${published}`);
        if (link) {
          lines.push(`- URL: ${link}`);
        }
        if (displayTitle !== title) {
          lines.push(`- Original title: ${title}`);
        }

        if (this.settings.scoreTemplateEnabled) {
          lines.push(
            `- Score: Impact ${defaultScore} / Actionability ${defaultScore} / Timing ${defaultScore} / Confidence ${defaultScore} = ${defaultTotalScore}`,
          );
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
              lines.push("<summary>Original description</summary>");
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
      lines.push("## Feed Errors");
      lines.push("");
      for (const error of feedErrors) {
        lines.push(`- ${error}`);
      }
      lines.push("");
    }

    if (translationStats.errors.length > 0) {
      lines.push("## Translation Errors");
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

    new Setting(containerEl)
      .setName(t("토픽별 최소 확보 개수", "Topic diversity minimum per topic"))
      .setDesc(
        t(
          "가중치 채우기 전에 토픽별로 최소 이 개수만큼 먼저 확보합니다.",
          "Try to keep at least this many items per topic before weighted fill.",
        ),
      )
      .addText((text) =>
        text
          .setPlaceholder("1")
          .setValue(String(this.plugin.settings.topicDiversityMinPerTopic))
          .onChange(async (value) => {
            const parsed = Number(value);
            if (
              Number.isFinite(parsed)
              && parsed >= MIN_TOPIC_DIVERSITY_PER_TOPIC
              && parsed <= MAX_TOPIC_DIVERSITY_PER_TOPIC
            ) {
              this.plugin.settings.topicDiversityMinPerTopic = Math.floor(parsed);
              await this.plugin.saveSettings();
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

    containerEl.createEl("h3", { text: t("필터링 · 중복제거 · 점수", "Filtering, Dedupe, Scoring") });

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

    containerEl.createEl("h3", { text: t("피드 목록", "Feeds") });

    new Setting(containerEl)
      .setName(t("피드 추가", "Add feed"))
      .setDesc(t("토픽 라벨과 함께 RSS/Atom 피드를 추가합니다.", "Add an RSS/Atom feed with a topic label."))
      .addButton((button) =>
        button.setButtonText(t("추가", "Add")).onClick(async () => {
          this.plugin.settings.feeds.push({
            id: createFeedId(),
            topic: "AI",
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
            }),
        );
    });
  }
}
