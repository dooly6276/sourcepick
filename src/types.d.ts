// Types shared by every file in src/. The files are plain scripts (no modules), so each one
// publishes a global object, and this file declares those globals and the data shapes they use.

type LensMode = "include" | "exclude";
type EngineId = "google" | "bing" | "duckduckgo" | "brave";
type Period = "" | "d" | "w" | "m" | "y";
type Lang = "en" | "ko" | "ja";

interface Site {
  domain: string;
  name?: string;
}

interface LocalizedName {
  en: string;
  ko?: string;
  ja?: string;
}

/** What a lens needs to be shown, shared or searched. */
interface LensLike {
  name: string | LocalizedName;
  mode: LensMode;
  sites: Site[];
}

/** The parts of a source that building a query needs. */
interface LensSites {
  mode: LensMode;
  sites: Site[];
}

interface LensRef extends LensSites {
  id: string;
}

/** A source: a set of sites searched together (or excluded together). */
interface Lens extends LensLike {
  id: string;
  /** "kr", "jp", "global" for built-in sources, "custom" for the user's own. */
  region: string;
}

/** A source the user made or imported, as kept in the saved state. */
interface CustomLens {
  id: string;
  name: string;
  mode?: LensMode;
  sites: Site[];
}

/** A source decoded from a share link, not saved yet. */
interface SharedLens {
  name: string;
  mode: LensMode;
  sites: Site[];
}

/** Saved settings (version 2). */
interface State {
  v: 2;
  shown: string[];
  known: string[];
  active: string[];
  off: string[];
  extra: string[];
  custom: CustomLens[];
  engine: EngineId;
  period: Period;
  forums: boolean;
  multi: boolean;
}

type PeriodValue = string | ((now: number) => string);

/** A search engine's URL shape and query limits. */
interface Engine {
  name: string;
  maxTerms: number;
  maxLength?: { size: number; unit: "chars" | "bytes" };
  url: string;
  period: { param: string; values: Record<"d" | "w" | "m" | "y", PeriodValue> };
  forums?: { param: string; value: string };
  /** URL parameters carried over when the results-page bar searches again. */
  keep: string[];
}

interface Filters {
  include: string[];
  exclude: string[];
}

interface SearchOptions {
  engine?: string;
  period?: Period;
  forums?: boolean;
  now?: number;
  /** The current results page's parameters. */
  keepFrom?: URLSearchParams | null;
}

interface FitResult extends Filters {
  byLength: boolean;
  cut: Filters;
  limit: number;
}

type LensApplied = "all" | "part" | "none";

interface SourceCoreApi {
  ENGINES: Record<string, Engine>;
  PERIODS: Period[];
  normalizeDomain(input: unknown): string | null;
  stripFilters(q: string | null | undefined): string;
  parseFilters(q: string | null | undefined): Filters;
  buildQuery(text: string, include: string[], exclude: string[]): string;
  countWords(text: string): number;
  fit(text: string, include: string[], exclude: string[], engine: string | undefined): FitResult;
  searchUrl(text: string, include: string[], exclude: string[], opts?: SearchOptions): string;
  periodKey(engine: string, value: string | null | undefined): Period;
  lensState(q: string, lens: LensSites, engine?: string): LensApplied;
  nearLength(q: string, engine?: string): boolean;
  activeLensIds(q: string, lenses: LensRef[], engine?: string): string[];
  collect(lenses: LensRef[], ids: string[], off?: string[], extra?: string[]): Filters;
  lensName(lens: { id?: string; name?: string | LocalizedName }, lang: string): string;
  lensDomains(lens: { sites: Site[] }): string[];
  encodeLens(lens: LensLike): string;
  decodeLens(code: string): SharedLens | null;
}

interface SourceStoreApi {
  KEY: string;
  lang(): Lang;
  defaults(): State;
  sanitize(s: unknown): State;
  readLocal(): State;
  load(): Promise<State>;
  save(state: State): Promise<void>;
  onChange(fn: (state: State) => void): void;
  allLenses(state: State): Lens[];
  isExtension: boolean;
}

/** Keys of the interface text. Every key has an English string; ko and ja may leave some out. */
type I18nKey =
  "appName" |
  "lead" |
  "add" |
  "close" |
  "cancel" |
  "copy" |
  "copied" |
  "delete" |
  "edit" |
  "back" |
  "query" |
  "queryPlaceholder" |
  "search" |
  "sources" |
  "clear" |
  "manage" |
  "noShown" |
  "siteCount" |
  "siteCountNone" |
  "editSites" |
  "editDone" |
  "editorEmpty" |
  "addedSites" |
  "deleteSite" |
  "addSiteLabel" |
  "addSitePlaceholder" |
  "myLensName" |
  "saveLens" |
  "badDomain" |
  "needName" |
  "needSites" |
  "options" |
  "engine" |
  "engineDesc" |
  "period" |
  "period_all" |
  "period_d" |
  "period_w" |
  "period_m" |
  "period_y" |
  "googleForums" |
  "perSite" |
  "count" |
  "moreWays" |
  "wayPhone" |
  "wayPhoneDesc" |
  "samsungInternet" |
  "samsungStep1" |
  "samsungStep2" |
  "playProtect" |
  "chromeAndroid" |
  "chromeAndroidStep1" |
  "chromeAndroidStep2" |
  "safariIos" |
  "safariStep1" |
  "safariStep2" |
  "shareDesc" |
  "wayBar" |
  "wayBarDesc" |
  "barStep1" |
  "barStep2" |
  "barStep3" |
  "barStep4" |
  "barAndroidDesc" |
  "barAndroidStep1" |
  "barAndroidStep2" |
  "barAndroidStep3" |
  "wayBarExt" |
  "wayExt" |
  "wayExtDesc" |
  "manageTitle" |
  "newLens" |
  "editLens" |
  "lensName" |
  "lensMode" |
  "modeInclude" |
  "modeExclude" |
  "modeExcludeShort" |
  "andMore" |
  "lensSites" |
  "lensSitesPlaceholder" |
  "saveChanges" |
  "badDomains" |
  "needSitesManage" |
  "lensSaved" |
  "changesSaved" |
  "importLabel" |
  "importPlaceholder" |
  "badLink" |
  "lensAdded" |
  "importAsk" |
  "allLenses" |
  "allLensesDesc" |
  "showLens" |
  "region_custom" |
  "region_kr" |
  "region_jp" |
  "region_global" |
  "copyLink" |
  "linkCopied" |
  "confirmDelete" |
  "deleted" |
  "reset" |
  "confirmReset" |
  "resetDone" |
  "barLabel" |
  "barClear" |
  "barManage" |
  "multiPick" |
  "limitInclude" |
  "limitExclude" |
  "saveAsDesc" |
  "saveAsLens" |
  "selectAll" |
  "shareSelection" |
  "selectionCopied" |
  "perSiteDesc" |
  "excludeHead" |
  "excludeDesc" |
  "newLensTile" |
  "shownCount" |
  "storeChrome" |
  "storeEdge" |
  "storeFirefox" |
  "installGuide" |
  "alreadyAdded" |
  "barPartial" |
  "barPartialTitle" |
  "limitIncludeLength" |
  "limitExcludeLength" |
  "tileTitle" |
  "tabNote" |
  "forumsShort" |
  "excludeShort" |
  "barMore" |
  "barLess" |
  "barPartialTitleLength";

interface SourceI18nApi {
  t(key: I18nKey, ...args: (string | number)[]): string;
  apply(doc: Document): void;
  ui: Lang;
  lensLang: Lang;
  APP: string;
  STR: { en: Record<I18nKey, string> } & Record<"ko" | "ja", Partial<Record<I18nKey, string>>>;
}

// Globals made by core.ts, store.ts and i18n.ts (and lenses.js, which scripts/build.ts generates).
declare var SourceCore: SourceCoreApi;
declare var SourceStore: SourceStoreApi;
declare var SourceI18n: SourceI18nApi;
declare var SOURCE_LENSES: Lens[] | undefined;

// The extension's background script runs as a service worker (Chrome) or a page (Firefox).
declare function importScripts(...urls: string[]): void;

/** Store and repository links, from config.js (written by scripts/build.ts). */
interface SourcepickLinks {
  chrome?: string;
  firefox?: string;
  edge?: string;
  repo?: string;
}

interface Window {
  SOURCEPICK_WEB_URL?: string;
  SOURCEPICK_LINKS?: SourcepickLinks;
  __sourcepickBar?: boolean;
  __sourcepickRedirecting?: boolean;
}
