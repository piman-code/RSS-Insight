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
  autoFetchEnabled: true,
  scheduleTimes: "08:00,17:00",
  outputFolder: "000-Inbox/RSS",
  filePrefix: "rss-capture",
  includeDescription: true,
  descriptionMaxLength: 500,
  writeEmptyNote: true,
  lastWindowEndIso: "",
  rssDashboardSyncEnabled: true,
  rssDashboardDataPath: ".obsidian/plugins/rss-dashboard/data.json",
  rssDashboardLastSyncAtIso: "",
  rssDashboardLastMtime: 0,
  feeds: []
};
var SCHEDULER_TICK_MS = 60 * 1e3;
var MAX_CATCHUP_WINDOWS = 10;
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
      if (!this.settings.autoFetchEnabled) {
        return;
      }
      void this.runDueWindows("startup");
    }, 4e3);
    this.register(() => window.clearTimeout(startupTimer));
  }
  async loadSettings() {
    const loaded = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, loaded);
    this.settings.feeds = (this.settings.feeds || []).map((feed) => ({
      id: feed.id || createFeedId(),
      topic: normalizeTopic(feed.topic || "Uncategorized"),
      name: (feed.name || "").trim(),
      url: (feed.url || "").trim(),
      enabled: feed.enabled !== false,
      source: feed.source === "rss-dashboard" ? "rss-dashboard" : "manual"
    }));
    this.settings.rssDashboardDataPath = (this.settings.rssDashboardDataPath || DEFAULT_SETTINGS.rssDashboardDataPath).trim() || DEFAULT_SETTINGS.rssDashboardDataPath;
  }
  async saveSettings() {
    await this.saveData(this.settings);
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
          enabled: existing ? existing.enabled : true,
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
    try {
      for (const windowEnd of dueWindowEnds) {
        const windowStart = this.findPreviousBoundary(windowEnd, scheduleMinutes);
        const outcome = await this.captureWindow(windowStart, windowEnd, enabledFeeds);
        this.settings.lastWindowEndIso = windowEnd.toISOString();
        await this.saveSettings();
        processedCount += 1;
        totalItems += outcome.totalItems;
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
      new import_obsidian.Notice(`Captured ${processedCount} window(s), ${totalItems} item(s).`, 6e3);
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
      new import_obsidian.Notice(
        `Captured latest window ${formatLocalDateTime(latestWindowEnd)} with ${outcome.totalItems} item(s).`,
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
    for (let i = 0; i < MAX_CATCHUP_WINDOWS; i += 1) {
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
    var _a;
    const grouped = /* @__PURE__ */ new Map();
    const itemKeys = /* @__PURE__ */ new Set();
    const feedErrors = [];
    let totalItems = 0;
    let itemsWithoutDate = 0;
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
        const itemKey = toItemKey(feed, item);
        if (itemKeys.has(itemKey)) {
          continue;
        }
        itemKeys.add(itemKey);
        const topic = feed.topic.trim() || "Uncategorized";
        if (!grouped.has(topic)) {
          grouped.set(topic, []);
        }
        (_a = grouped.get(topic)) == null ? void 0 : _a.push({ feed, item });
        totalItems += 1;
      }
    }
    if (totalItems === 0 && !this.settings.writeEmptyNote && feedErrors.length === 0) {
      return {
        notePath: null,
        totalItems,
        feedErrors,
        feedsChecked: feeds.length,
        itemsWithoutDate
      };
    }
    const notePath = this.buildOutputPath(windowEnd);
    const content = this.buildNoteContent(
      windowStart,
      windowEnd,
      grouped,
      feeds.length,
      totalItems,
      itemsWithoutDate,
      feedErrors
    );
    await this.ensureFolderExists(this.resolveOutputFolder());
    await this.writeOrOverwriteNote(notePath, content);
    return {
      notePath,
      totalItems,
      feedErrors,
      feedsChecked: feeds.length,
      itemsWithoutDate
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
  buildNoteContent(windowStart, windowEnd, grouped, feedsChecked, totalItems, itemsWithoutDate, feedErrors) {
    var _a;
    const lines = [];
    lines.push("---");
    lines.push('plugin: "rss-insight"');
    lines.push(`generated_at: "${escapeYamlString((/* @__PURE__ */ new Date()).toISOString())}"`);
    lines.push(`window_start: "${escapeYamlString(windowStart.toISOString())}"`);
    lines.push(`window_end: "${escapeYamlString(windowEnd.toISOString())}"`);
    lines.push(`feeds_checked: ${feedsChecked}`);
    lines.push(`items_count: ${totalItems}`);
    lines.push(`items_without_date: ${itemsWithoutDate}`);
    lines.push(`feed_errors: ${feedErrors.length}`);
    lines.push("---");
    lines.push("");
    lines.push(`# RSS Capture ${formatLocalDateTime(windowEnd)}`);
    lines.push("");
    lines.push(`- Window start: ${formatLocalDateTime(windowStart)}`);
    lines.push(`- Window end: ${formatLocalDateTime(windowEnd)}`);
    lines.push(`- Feeds checked: ${feedsChecked}`);
    lines.push(`- Items captured: ${totalItems}`);
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
      const rows = (_a = grouped.get(topic)) != null ? _a : [];
      rows.sort((a, b) => {
        const aTime = a.item.published ? a.item.published.getTime() : 0;
        const bTime = b.item.published ? b.item.published.getTime() : 0;
        return bTime - aTime;
      });
      for (const row of rows) {
        const title = row.item.title || "(untitled)";
        const link = row.item.link || "";
        const published = row.item.published ? formatLocalDateTime(row.item.published) : row.item.publishedRaw || "unknown";
        lines.push(`### ${title}`);
        lines.push(`- Source: ${row.feed.name || row.feed.url}`);
        lines.push(`- Published: ${published}`);
        if (link) {
          lines.push(`- URL: ${link}`);
        }
        if (this.settings.includeDescription && row.item.description) {
          const description = truncateText(
            normalizePlainText(row.item.description),
            Math.max(80, this.settings.descriptionMaxLength)
          );
          if (description) {
            lines.push("");
            for (const descLine of description.split("\n")) {
              lines.push(`> ${descLine}`);
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
    containerEl.createEl("h2", { text: "RSS Insight" });
    new import_obsidian.Setting(containerEl).setName("Auto fetch").setDesc("Check and run due windows every minute while Obsidian is open.").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.autoFetchEnabled).onChange(async (value) => {
        this.plugin.settings.autoFetchEnabled = value;
        await this.plugin.saveSettings();
        if (value) {
          void this.plugin.runDueWindows("settings");
        }
      })
    );
    new import_obsidian.Setting(containerEl).setName("Schedule times").setDesc("Comma-separated HH:MM values. Example: 08:00,17:00").addText(
      (text) => text.setPlaceholder("08:00,17:00").setValue(this.plugin.settings.scheduleTimes).onChange(async (value) => {
        this.plugin.settings.scheduleTimes = value;
        await this.plugin.saveSettings();
      })
    );
    const parsedTimes = parseScheduleMinutes(this.plugin.settings.scheduleTimes);
    new import_obsidian.Setting(containerEl).setName("Parsed times").setDesc(
      parsedTimes.length > 0 ? parsedTimes.map((minutes) => minutesToToken(minutes)).join(", ") : "No valid schedule times"
    );
    new import_obsidian.Setting(containerEl).setName("Output folder").setDesc("Vault-relative folder where capture notes are written.").addText(
      (text) => text.setPlaceholder("000-Inbox/RSS").setValue(this.plugin.settings.outputFolder).onChange(async (value) => {
        this.plugin.settings.outputFolder = value.trim();
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("Filename prefix").setDesc("Prefix used for generated note filenames.").addText(
      (text) => text.setPlaceholder("rss-capture").setValue(this.plugin.settings.filePrefix).onChange(async (value) => {
        this.plugin.settings.filePrefix = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("Include description").setDesc("Add feed description/summary text under each item.").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.includeDescription).onChange(async (value) => {
        this.plugin.settings.includeDescription = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("Description max length").setDesc("Maximum characters for each description block.").addText(
      (text) => text.setPlaceholder("500").setValue(String(this.plugin.settings.descriptionMaxLength)).onChange(async (value) => {
        const parsed = Number(value);
        if (Number.isFinite(parsed) && parsed > 0) {
          this.plugin.settings.descriptionMaxLength = Math.floor(parsed);
          await this.plugin.saveSettings();
        }
      })
    );
    new import_obsidian.Setting(containerEl).setName("Write empty notes").setDesc("If enabled, create a note even when no items are found.").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.writeEmptyNote).onChange(async (value) => {
        this.plugin.settings.writeEmptyNote = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("Last window pointer").setDesc(this.plugin.settings.lastWindowEndIso || "Not set yet").addButton(
      (button) => button.setButtonText("Reset").onClick(async () => {
        this.plugin.settings.lastWindowEndIso = "";
        await this.plugin.saveSettings();
        this.display();
      })
    );
    containerEl.createEl("h3", { text: "RSS Dashboard Sync" });
    new import_obsidian.Setting(containerEl).setName("Enable RSS Dashboard sync").setDesc("Auto-import feed list from RSS Dashboard data.json.").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.rssDashboardSyncEnabled).onChange(async (value) => {
        this.plugin.settings.rssDashboardSyncEnabled = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("RSS Dashboard data path").setDesc("Vault-relative path to RSS Dashboard settings file.").addText(
      (text) => text.setPlaceholder(".obsidian/plugins/rss-dashboard/data.json").setValue(this.plugin.settings.rssDashboardDataPath).onChange(async (value) => {
        this.plugin.settings.rssDashboardDataPath = value.trim() || DEFAULT_SETTINGS.rssDashboardDataPath;
        await this.plugin.saveSettings();
      })
    );
    const syncedFeedCount = this.plugin.settings.feeds.filter(
      (feed) => feed.source === "rss-dashboard"
    ).length;
    const syncStatus = this.plugin.settings.rssDashboardLastSyncAtIso ? `Last sync: ${this.plugin.settings.rssDashboardLastSyncAtIso} / synced feeds: ${syncedFeedCount}` : `No sync yet / synced feeds: ${syncedFeedCount}`;
    new import_obsidian.Setting(containerEl).setName("Dashboard sync status").setDesc(syncStatus).addButton(
      (button) => button.setButtonText("Sync now").onClick(async () => {
        await this.plugin.syncFeedsFromRssDashboard(true, true);
        this.display();
      })
    );
    containerEl.createEl("h3", { text: "Feeds" });
    new import_obsidian.Setting(containerEl).setName("Add feed").setDesc("Add an RSS/Atom feed with a topic label.").addButton(
      (button) => button.setButtonText("Add").onClick(async () => {
        this.plugin.settings.feeds.push({
          id: createFeedId(),
          topic: "AI",
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
        text: "No feeds configured yet. Add at least one feed to start capturing."
      });
      return;
    }
    this.plugin.settings.feeds.forEach((feed, index) => {
      const row = containerEl.createDiv({ cls: "rss-insight-feed-row" });
      const sourceLabel = feed.source === "rss-dashboard" ? "RSS Dashboard sync" : "Manual";
      new import_obsidian.Setting(row).setName(`Feed ${index + 1}`).setDesc(`${sourceLabel} / Enable or remove this feed.`).addToggle(
        (toggle) => toggle.setValue(feed.enabled).onChange(async (value) => {
          feed.enabled = value;
          await this.plugin.saveSettings();
        })
      ).addExtraButton(
        (button) => button.setIcon("trash").setTooltip("Delete feed").onClick(async () => {
          this.plugin.settings.feeds = this.plugin.settings.feeds.filter(
            (candidate) => candidate.id !== feed.id
          );
          await this.plugin.saveSettings();
          this.display();
        })
      );
      new import_obsidian.Setting(row).setName("Topic").setDesc("Used as section heading in output notes.").addText(
        (text) => text.setValue(feed.topic).onChange(async (value) => {
          feed.topic = normalizeTopic(value);
          await this.plugin.saveSettings();
        })
      );
      new import_obsidian.Setting(row).setName("Feed name").setDesc("Display name for this source.").addText(
        (text) => text.setValue(feed.name).onChange(async (value) => {
          feed.name = value.trim();
          await this.plugin.saveSettings();
        })
      );
      new import_obsidian.Setting(row).setName("Feed URL").setDesc("RSS or Atom URL.").addText(
        (text) => text.setPlaceholder("https://example.com/rss").setValue(feed.url).onChange(async (value) => {
          feed.url = value.trim();
          await this.plugin.saveSettings();
        })
      );
    });
  }
};
