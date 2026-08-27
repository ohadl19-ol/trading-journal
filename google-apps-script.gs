/**
 * יומן מסחר — Backend ל-Google Apps Script
 * ---------------------------------------------------------
 * מנהל 3 לשוניות בגיליון: "פוזיציות", "פעולות", "סטטיסטיקה".
 * doPost מבצע פעולות (open/add/trim/close/update), doGet מחזיר את כל הנתונים.
 */

var POSITIONS_SHEET_NAME = 'פוזיציות';
var EXECUTIONS_SHEET_NAME = 'פעולות';
var STATS_SHEET_NAME = 'סטטיסטיקה';
var WATCHLIST_SHEET_NAME = 'רשימת מעקב';
var NOTES_SHEET_NAME = 'הערות ותוכנית מסחר';
var AUDIT_LOG_SHEET_NAME = 'יומן שינויים';
var CAPITAL_FLOW_SHEET_NAME = 'תזרים הון';

// כותרות לשונית "רשימת מעקב"
var WATCHLIST_HEADERS = [
  'מזהה מעקב', 'סימול', 'תאריך הוספה', 'מחיר יעד', 'כיוון התראה',
  'הערות', 'מחיר נוכחי', 'התראה הופעלה', 'תאריך הפעלת התראה', 'רשימה',
  'מחיר כניסה מתוכנן', 'סטופ לוס מתוכנן', 'יעד מתוכנן', 'סכום סיכון מתוכנן', 'תבנית מתוכננת',
  'כמות מניות מתוכננת', 'סדר תצוגה',
];

// שם הרשימה שכל פריט ישן (מלפני הוספת התכונה הזו) משתייך אליו כברירת מחדל
var DEFAULT_WATCHLIST_NAME = 'הרשימה שלי';

// כותרות לשונית "פוזיציות" - הסדר קובע את מבנה השורות בכל הקוד
var POSITIONS_HEADERS = [
  'מזהה עסקה', 'תאריך פתיחה', 'סימול', 'סטאטוס', 'סוג הגרף (Pattern)',
  'מחיר כניסה ממוצע', 'כמות מניות נוכחית', 'כמות מניות מקורית', 'מחיר סטופ לוס',
  'מחיר יעד', 'סכום סיכון $', 'גודל פוזיציה נוכחי $', '% פוזיציה מהחשבון',
  '% סיכון מהחשבון', 'יחס R/R מתוכנן', 'יעד 2R', 'יעד 3R', 'יתרת חשבון',
  'רווח/הפסד ממומש $', 'R ממומש', 'תוצאה (Outcome)', 'WIN/LOSS',
  'קטגוריה/תגית', 'תאריך סגירה', 'סיבת כניסה/סטאפ', 'קישור צ\'ארט הפוזיציה',
  'הערות', 'שווי מצטבר (equity)', 'מחיר נוכחי (לא ממומש)', 'עמלות שנצברו $', 'מועדף', 'יעד 4R',
  'סקירת עסקה (לקחים/טעויות/הפרות כלל)', 'התראת סטופ נשלחה',
];

// כותרות לשונית "פעולות"
var EXECUTIONS_HEADERS = [
  'מזהה פעולה', 'מזהה עסקה', 'תאריך ושעה', 'סימול', 'סוג פעולה',
  'מחיר', 'כמות מניות', 'סכום $', 'רווח/הפסד ממומש בפעולה $', 'הערות',
];

var DEFAULT_INITIAL_CAPITAL = 4455;

// ==================== נקודות כניסה ====================

function doGet(e) {
  checkWatchlistAlerts_(); // בדיקה הזדמנותית בכל טעינה - שולחת מייל אם מניה חצתה יעד
  checkStopLossAlerts_(); // בדיקה הזדמנותית בכל טעינה - שולחת מייל אם פוזיציה פתוחה חצתה סטופ

  var params = (e && e.parameter) || {};
  var scope = params.scope;
  var payload;

  try {
    if (scope === 'summary') {
      // תקציר קומפקטי (לשימוש כלים חיצוניים כמו Custom GPT Actions, שיש להם מגבלת גודל תשובה)
      payload = buildSummaryView_();
    } else if (scope === 'trades') {
      payload = buildTradesView_(params);
    } else if (scope === 'trade') {
      payload = buildTradeDetailView_(params.tradeId);
    } else if (scope === 'capitalFlows') {
      payload = { capitalFlows: readCapitalFlows_() };
    } else if (scope === 'chart') {
      payload = fetchChartData_(params.symbol, params.interval);
    } else {
      // ברירת מחדל: כל הנתונים המלאים — משמש את האפליקציה עצמה, לא לשנות!
      payload = {
        trades: readPositions_(),
        executions: readExecutions_(),
        watchlist: readWatchlist_(),
        notes: readGeneralNotes_(),
        settings: getAppSettings_(),
        capitalFlows: readCapitalFlows_(),
      };
    }
  } catch (err) {
    payload = { status: 'error', message: err.message };
  }

  if (params.callback) {
    return ContentService
      .createTextOutput(params.callback + '(' + JSON.stringify(payload) + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

// ==================== "views" קומפקטיים לצריכה חיצונית (Custom GPT Actions וכד') ====================
// כלים חיצוניים (כמו Custom GPT) מגבילים את גודל תשובת ה-API בקריאה אחת. לכן, בנוסף
// לתשובה המלאה (ברירת המחדל, ל-doGet רגיל) יש כאן שלושה "views" קומפקטיים בהרבה.

/** תקציר סטטיסטי בלבד — הכי קטן, לשאלות כלליות ("איך אני מתפקד?") */
function buildSummaryView_() {
  var trades = readPositions_();
  var closed = trades.filter(function (t) { return t.status === 'סגורה'; });
  var open = trades.filter(function (t) { return t.status !== 'סגורה'; });

  var winCount = 0, lossCount = 0, totalRealizedPnl = 0;
  var winSum = 0, lossSum = 0;
  var byPattern = {}, byCategory = {};

  closed.forEach(function (t) {
    totalRealizedPnl += t.realizedPnl;
    if (t.winLoss === 'WIN') { winCount++; winSum += t.realizedPnl; }
    if (t.winLoss === 'LOSS') { lossCount++; lossSum += t.realizedPnl; }

    var pat = t.pattern || 'לא צוין';
    if (!byPattern[pat]) byPattern[pat] = { count: 0, pnl: 0 };
    byPattern[pat].count++;
    byPattern[pat].pnl += t.realizedPnl;

    var cat = t.category || 'ללא קטגוריה';
    if (!byCategory[cat]) byCategory[cat] = { count: 0, pnl: 0 };
    byCategory[cat].count++;
    byCategory[cat].pnl += t.realizedPnl;
  });

  var initialCapital = getInitialCapital_();
  var currentEquity = initialCapital + totalRealizedPnl;

  var openSummary = open.map(function (t) {
    return {
      tradeId: t.tradeId, symbol: t.symbol, status: t.status, pattern: t.pattern,
      avgEntryPrice: t.avgEntryPrice, currentPrice: t.currentPrice, stopLoss: t.stopLoss,
      currentShares: t.currentShares, openDate: t.openDate, isFavorite: t.isFavorite,
    };
  });

  return {
    initialCapital: initialCapital,
    totalRealizedPnl: totalRealizedPnl,
    currentEquity: currentEquity,
    closedTradesCount: closed.length,
    winCount: winCount,
    lossCount: lossCount,
    winRate: (winCount + lossCount) > 0 ? winCount / (winCount + lossCount) : null,
    avgWin: winCount > 0 ? winSum / winCount : null,
    avgLoss: lossCount > 0 ? -(lossSum / lossCount) : null,
    patternBreakdown: byPattern,
    categoryBreakdown: byCategory,
    openPositions: openSummary,
    watchlist: readWatchlist_(),
    notes: readGeneralNotes_(),
  };
}

/**
 * רשימת עסקאות מסוננת (בלי שדות "כבדים" כמו הערות/קישור צ'ארט, כדי לשמור על גודל קטן).
 * פרמטרים אפשריים: year, month (1-12), status, symbol, limit (ברירת מחדל 50).
 */
function buildTradesView_(params) {
  var trades = readPositions_();

  if (params.year) {
    trades = trades.filter(function (t) {
      return new Date(t.openDate).getFullYear() === Number(params.year);
    });
  }
  if (params.month) {
    trades = trades.filter(function (t) {
      return new Date(t.openDate).getMonth() + 1 === Number(params.month);
    });
  }
  if (params.status) {
    trades = trades.filter(function (t) { return t.status === params.status; });
  }
  if (params.symbol) {
    var sym = String(params.symbol).toUpperCase();
    trades = trades.filter(function (t) { return t.symbol === sym; });
  }

  trades.sort(function (a, b) { return new Date(b.openDate) - new Date(a.openDate); });

  var limit = params.limit ? Number(params.limit) : 50;
  var truncated = trades.length > limit;
  trades = trades.slice(0, limit);

  var trimmed = trades.map(function (t) {
    return {
      tradeId: t.tradeId, openDate: t.openDate, symbol: t.symbol, status: t.status,
      pattern: t.pattern, avgEntryPrice: t.avgEntryPrice, currentShares: t.currentShares,
      stopLoss: t.stopLoss, targetPrice: t.targetPrice, riskAmount: t.riskAmount,
      realizedPnl: t.realizedPnl, realizedR: t.realizedR, outcome: t.outcome,
      winLoss: t.winLoss, category: t.category, closeDate: t.closeDate,
      currentPrice: t.currentPrice, isFavorite: t.isFavorite,
    };
  });

  return { trades: trimmed, count: trimmed.length, truncated: truncated };
}

/** פרטים מלאים על עסקה בודדת (כולל הערות/קישור צ'ארט/כל הפעולות שלה) */
function buildTradeDetailView_(tradeId) {
  if (!tradeId) return { error: 'חסר tradeId' };
  var trades = readPositions_();
  var trade = trades.filter(function (t) { return t.tradeId === tradeId; })[0];
  if (!trade) return { error: 'עסקה לא נמצאה: ' + tradeId };

  var executions = readExecutions_().filter(function (e) { return e.tradeId === tradeId; });

  // בנוסף לקישור המקורי (עמוד HTML), פותרים גם קישור ישיר לקובץ התמונה עצמו —
  // כדי שכלי חיצוני עם יכולת ראייה (כמו Custom GPT) יוכל לצפות בצ'ארט ישירות
  var chartImageUrl = trade.chartUrl ? resolveChartImageUrl_(trade.chartUrl) : null;

  return { trade: trade, executions: executions, chartImageUrl: chartImageUrl };
}

/** מחלץ מעמוד ה-snapshot של TradingView את קישור התמונה הישיר (og:image) */
function resolveChartImageUrl_(chartUrl) {
  try {
    var resp = UrlFetchApp.fetch(chartUrl, { muteHttpExceptions: true });
    if (resp.getResponseCode() !== 200) return null;
    var match = resp.getContentText().match(/property="og:image" content="([^"]+)"/);
    return match ? match[1] : null;
  } catch (err) {
    return null;
  }
}

// פעולות "כתיבה" בלבד מקבלות idempotency (לא נוגע לקריאה, ואין לה משמעות שם) ומתועדות ביומן שינויים
var WRITE_ACTIONS_ = {
  open: true, add: true, trim: true, close: true, update: true, delete: true,
  watchlistAdd: true, watchlistUpdate: true, watchlistDelete: true,
  saveNotes: true, updateSettings: true,
  addCapitalFlow: true, deleteCapitalFlow: true,
};

function doPost(e) {
  var result;
  try {
    var body = JSON.parse(e.postData.contents);
    var isWrite = !!WRITE_ACTIONS_[body.action];

    // idempotency: אם כבר ביצענו בקשה עם אותו idempotencyKey (למשל retry כפול בטעות),
    // מחזירים את אותה תוצאה בלי לבצע את הפעולה פעם נוספת
    var cache = isWrite && body.idempotencyKey ? CacheService.getScriptCache() : null;
    var cacheKey = cache ? 'idem_' + body.action + '_' + body.idempotencyKey : null;
    if (cacheKey) {
      var cached = cache.get(cacheKey);
      if (cached !== null) {
        return ContentService
          .createTextOutput(JSON.stringify({ status: 'ok', result: JSON.parse(cached), deduped: true }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }

    switch (body.action) {
      case 'open':
        result = handleOpen_(body);
        break;
      case 'add':
        result = handleAdd_(body);
        break;
      case 'trim':
        result = handleTrim_(body);
        break;
      case 'close':
        result = handleClose_(body);
        break;
      case 'update':
        result = handleUpdate_(body);
        break;
      case 'delete':
        result = handleDelete_(body);
        break;
      case 'watchlistAdd':
        result = handleWatchlistAdd_(body);
        break;
      case 'watchlistUpdate':
        result = handleWatchlistUpdate_(body);
        break;
      case 'watchlistDelete':
        result = handleWatchlistDelete_(body);
        break;
      case 'saveNotes':
        result = handleSaveNotes_(body);
        break;
      case 'updateSettings':
        result = handleUpdateSettings_(body);
        break;
      case 'addCapitalFlow':
        result = handleAddCapitalFlow_(body);
        break;
      case 'deleteCapitalFlow':
        result = handleDeleteCapitalFlow_(body);
        break;
      case 'fetchChartImages':
        result = handleFetchChartImages_(body);
        break;
      case 'setApiKey':
        result = handleSetApiKey_(body);
        break;
      default:
        throw new Error('פעולה לא ידועה: ' + body.action);
    }
    ensureStatsSheet_();

    if (cacheKey) {
      // עד 6 שעות (המקסימום של CacheService) — מספיק בהחלט כדי לתפוס retry כפול
      cache.put(cacheKey, JSON.stringify(result), 21600);
    }
    if (isWrite) {
      logAudit_(body.action, body, result);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ status: 'ok', result: result }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ==================== פעולות ====================

function handleOpen_(body) {
  var sheet = getPositionsSheet_();
  var now = body.openDate || new Date().toISOString();
  // מזהה עסקה: הלקוח (האפליקציה) תמיד יוצר ושולח אחד, אבל קריאה חיצונית (כמו GPT) לא
  // בהכרח יודעת לעשות זאת — אם לא נשלח, מייצרים אחד כאן כדי שהעסקה תמיד תהיה בת-איתור
  var tradeId = body.tradeId || ('T-' + new Date().getTime());

  // אם לא נשלחו שדות נגזרים (positionSize/אחוזים/R-targets) — למשל קריאה מ-GPT שמעביר
  // רק את השדות הגולמיים — מחשבים אותם כאן מהמחירים הגולמיים, באותה נוסחה כמו במחשבון
  var riskPerShare = Number(body.entryPrice) - Number(body.stopLoss);
  var positionSize = numOrNull_(body.positionSize, Number(body.shares) * Number(body.entryPrice));
  var accountBalanceNum = body.accountBalance !== undefined && body.accountBalance !== null ? Number(body.accountBalance) : null;
  var accountPercentage = numOrNull_(
    body.accountPercentage,
    accountBalanceNum ? (positionSize / accountBalanceNum) * 100 : null
  );
  var riskPercentage = numOrNull_(
    body.riskPercentage,
    accountBalanceNum ? (Number(body.riskAmount) / accountBalanceNum) * 100 : null
  );
  var plannedRR = numOrNull_(
    body.plannedRR,
    body.targetPrice && riskPerShare > 0 ? (Number(body.targetPrice) - Number(body.entryPrice)) / riskPerShare : null
  );
  var target2R = numOrNull_(body.target2R, riskPerShare > 0 ? Number(body.entryPrice) + 2 * riskPerShare : null);
  var target3R = numOrNull_(body.target3R, riskPerShare > 0 ? Number(body.entryPrice) + 3 * riskPerShare : null);
  var target4R = numOrNull_(body.target4R, riskPerShare > 0 ? Number(body.entryPrice) + 4 * riskPerShare : null);

  var row = buildEmptyRow_();
  setByHeader_(row, 'מזהה עסקה', tradeId);
  setByHeader_(row, 'תאריך פתיחה', now);
  setByHeader_(row, 'סימול', body.symbol);
  setByHeader_(row, 'סטאטוס', 'פתוחה');
  setByHeader_(row, 'סוג הגרף (Pattern)', body.pattern);
  setByHeader_(row, 'מחיר כניסה ממוצע', body.entryPrice);
  setByHeader_(row, 'כמות מניות נוכחית', body.shares);
  setByHeader_(row, 'כמות מניות מקורית', body.shares);
  setByHeader_(row, 'מחיר סטופ לוס', body.stopLoss);
  setByHeader_(row, 'מחיר יעד', body.targetPrice);
  setByHeader_(row, 'סכום סיכון $', body.riskAmount);
  setByHeader_(row, 'גודל פוזיציה נוכחי $', positionSize);
  setByHeader_(row, '% פוזיציה מהחשבון', accountPercentage);
  setByHeader_(row, '% סיכון מהחשבון', riskPercentage);
  setByHeader_(row, 'יחס R/R מתוכנן', plannedRR);
  setByHeader_(row, 'יעד 2R', target2R);
  setByHeader_(row, 'יעד 3R', target3R);
  setByHeader_(row, 'יעד 4R', target4R);
  setByHeader_(row, 'יתרת חשבון', body.accountBalance);
  setByHeader_(row, 'רווח/הפסד ממומש $', 0);
  setByHeader_(row, 'סיבת כניסה/סטאפ', body.setupReason);
  setByHeader_(row, 'קישור צ\'ארט הפוזיציה', body.chartUrl);
  // עמלת הכניסה נצברת ותסולק בפועל רק כשהפוזיציה תיסגר סופית
  setByHeader_(row, 'עמלות שנצברו $', Number(body.commissionPerAction) || 0);
  setByHeader_(row, 'מועדף', false);

  appendRow_(sheet, POSITIONS_HEADERS, row);
  setLivePriceFormula_(sheet, sheet.getLastRow());

  addExecutionRow_({
    execId: 'E-' + Utilities.getUuid().slice(0, 8),
    tradeId: tradeId,
    timestamp: now,
    symbol: body.symbol,
    actionType: 'כניסה',
    price: body.entryPrice,
    shares: body.shares,
    amount: positionSize,
    realizedPnlInAction: 0,
    notes: body.setupReason || '',
  });

  recalcEquity_();
  return { tradeId: tradeId };
}

/** מחזיר את value אם הוא לא undefined/null, אחרת את הערך שחושב כברירת מחדל (יכול גם הוא להיות null) */
function numOrNull_(value, fallback) {
  return value !== undefined && value !== null ? Number(value) : fallback;
}

function handleAdd_(body) {
  var sheet = getPositionsSheet_();
  var rowIndex = findPositionRow_(sheet, body.tradeId);
  if (rowIndex === -1) throw new Error('פוזיציה לא נמצאה: ' + body.tradeId);

  var current = readRowByIndex_(sheet, rowIndex);
  var currentShares = Number(current['כמות מניות נוכחית']) || 0;
  var avgEntry = Number(current['מחיר כניסה ממוצע']) || 0;
  var addShares = Number(body.shares) || 0;
  var addPrice = Number(body.price) || 0;

  var newShares = currentShares + addShares;
  var newAvg = (currentShares * avgEntry + addShares * addPrice) / newShares;
  var now = body.timestamp || new Date().toISOString();

  var newAccruedCommission = (Number(current['עמלות שנצברו $']) || 0) + (Number(body.commissionPerAction) || 0);

  updateCell_(sheet, rowIndex, 'כמות מניות נוכחית', newShares);
  updateCell_(sheet, rowIndex, 'כמות מניות מקורית', (Number(current['כמות מניות מקורית']) || 0) + addShares);
  updateCell_(sheet, rowIndex, 'מחיר כניסה ממוצע', newAvg);
  updateCell_(sheet, rowIndex, 'גודל פוזיציה נוכחי $', newShares * newAvg);
  updateCell_(sheet, rowIndex, 'עמלות שנצברו $', newAccruedCommission);

  addExecutionRow_({
    execId: 'E-' + Utilities.getUuid().slice(0, 8),
    tradeId: body.tradeId,
    timestamp: now,
    symbol: current['סימול'],
    actionType: 'חיזוק',
    price: addPrice,
    shares: addShares,
    amount: addShares * addPrice,
    realizedPnlInAction: 0,
    notes: body.notes || '',
  });

  return { tradeId: body.tradeId };
}

function handleTrim_(body) {
  var sheet = getPositionsSheet_();
  var rowIndex = findPositionRow_(sheet, body.tradeId);
  if (rowIndex === -1) throw new Error('פוזיציה לא נמצאה: ' + body.tradeId);

  var current = readRowByIndex_(sheet, rowIndex);
  var currentShares = Number(current['כמות מניות נוכחית']) || 0;
  var avgEntry = Number(current['מחיר כניסה ממוצע']) || 0;
  var sellShares = Number(body.shares) || 0;
  var sellPrice = Number(body.price) || 0;

  if (sellShares >= currentShares) throw new Error('כמות המכירה חייבת להיות קטנה מהכמות הנוכחית');

  // מכירה חלקית מנכה רק את עמלת הפעולה הזו עצמה; מה שנצבר מהכניסה/חיזוקים
  // נשאר ב"עמלות שנצברו" ויסולק במלואו בסגירה הסופית
  var commission = Number(body.commissionPerAction) || 0;
  var pnlInAction = sellShares * (sellPrice - avgEntry) - commission;
  var newRealizedPnl = (Number(current['רווח/הפסד ממומש $']) || 0) + pnlInAction;
  var newShares = currentShares - sellShares;
  var now = body.timestamp || new Date().toISOString();

  updateCell_(sheet, rowIndex, 'כמות מניות נוכחית', newShares);
  updateCell_(sheet, rowIndex, 'רווח/הפסד ממומש $', newRealizedPnl);
  updateCell_(sheet, rowIndex, 'סטאטוס', 'פתוחה חלקית');
  updateCell_(sheet, rowIndex, 'גודל פוזיציה נוכחי $', newShares * avgEntry);

  addExecutionRow_({
    execId: 'E-' + Utilities.getUuid().slice(0, 8),
    tradeId: body.tradeId,
    timestamp: now,
    symbol: current['סימול'],
    actionType: 'מכירה חלקית',
    price: sellPrice,
    shares: sellShares,
    amount: sellShares * sellPrice,
    realizedPnlInAction: pnlInAction,
    notes: body.notes || '',
  });

  return { tradeId: body.tradeId };
}

function handleClose_(body) {
  var sheet = getPositionsSheet_();
  var rowIndex = findPositionRow_(sheet, body.tradeId);
  if (rowIndex === -1) throw new Error('פוזיציה לא נמצאה: ' + body.tradeId);

  var current = readRowByIndex_(sheet, rowIndex);
  var currentShares = Number(current['כמות מניות נוכחית']) || 0;
  var avgEntry = Number(current['מחיר כניסה ממוצע']) || 0;
  var closePrice = Number(body.price) || 0;
  var riskAmount = Number(current['סכום סיכון $']) || 0;

  // הסגירה הסופית מסלקת גם את עמלת הסגירה עצמה וגם את כל העמלות שנצברו לאורך
  // חיי הפוזיציה (כניסה + כל חיזוק) שעדיין לא נוכו ע"י מכירות חלקיות קודמות
  var commission = Number(body.commissionPerAction) || 0;
  var accruedCommission = Number(current['עמלות שנצברו $']) || 0;
  var pnlInAction = currentShares * (closePrice - avgEntry) - commission - accruedCommission;
  var totalRealizedPnl = (Number(current['רווח/הפסד ממומש $']) || 0) + pnlInAction;
  var realizedR = riskAmount > 0 ? totalRealizedPnl / riskAmount : '';
  var now = body.timestamp || new Date().toISOString();

  updateCell_(sheet, rowIndex, 'כמות מניות נוכחית', 0);
  updateCell_(sheet, rowIndex, 'רווח/הפסד ממומש $', totalRealizedPnl);
  updateCell_(sheet, rowIndex, 'R ממומש', realizedR);
  updateCell_(sheet, rowIndex, 'סטאטוס', 'סגורה');
  updateCell_(sheet, rowIndex, 'WIN/LOSS', totalRealizedPnl >= 0 ? 'WIN' : 'LOSS');
  updateCell_(sheet, rowIndex, 'תוצאה (Outcome)', body.outcome || '');
  updateCell_(sheet, rowIndex, 'קטגוריה/תגית', body.category || '');
  updateCell_(sheet, rowIndex, 'תאריך סגירה', now);
  updateCell_(sheet, rowIndex, 'גודל פוזיציה נוכחי $', 0);
  updateCell_(sheet, rowIndex, 'מחיר נוכחי (לא ממומש)', ''); // אין עוד רלוונטיות אחרי סגירה
  updateCell_(sheet, rowIndex, 'עמלות שנצברו $', 0); // סולקו במלואן
  if (body.notes) {
    var prevNotes = current['הערות'] || '';
    updateCell_(sheet, rowIndex, 'הערות', prevNotes ? prevNotes + ' | ' + body.notes : body.notes);
  }

  addExecutionRow_({
    execId: 'E-' + Utilities.getUuid().slice(0, 8),
    tradeId: body.tradeId,
    timestamp: now,
    symbol: current['סימול'],
    actionType: 'סגירה',
    price: closePrice,
    shares: currentShares,
    amount: currentShares * closePrice,
    realizedPnlInAction: pnlInAction,
    notes: body.notes || '',
  });

  recalcEquity_();
  return { tradeId: body.tradeId };
}

function handleUpdate_(body) {
  var sheet = getPositionsSheet_();
  var rowIndex = findPositionRow_(sheet, body.tradeId);
  if (rowIndex === -1) throw new Error('פוזיציה לא נמצאה: ' + body.tradeId);

  if (body.pattern !== undefined && body.pattern !== null) {
    updateCell_(sheet, rowIndex, 'סוג הגרף (Pattern)', body.pattern);
  }
  if (body.setupReason !== undefined && body.setupReason !== null) {
    updateCell_(sheet, rowIndex, 'סיבת כניסה/סטאפ', body.setupReason);
  }
  if (body.notes !== undefined && body.notes !== null) {
    updateCell_(sheet, rowIndex, 'הערות', body.notes);
  }
  if (body.chartUrl !== undefined && body.chartUrl !== null) {
    updateCell_(sheet, rowIndex, 'קישור צ\'ארט הפוזיציה', body.chartUrl);
  }
  if (body.currentPrice !== undefined) {
    if (body.currentPrice === 'LIVE') {
      // הופך את המחיר לחי (GOOGLEFINANCE) — משמש בעיקר למיגרציה חד-פעמית של עסקאות פתוחות ישנות
      setLivePriceFormula_(sheet, rowIndex);
    } else {
      // currentPrice=null מנקה את הערך (למשל אחרי סגירת עסקה); מספר = עדכון ידני חד-פעמי שדורס את הנוסחה החיה
      updateCell_(sheet, rowIndex, 'מחיר נוכחי (לא ממומש)', body.currentPrice === null ? '' : body.currentPrice);
    }
  }
  if (body.stopLoss !== undefined && body.stopLoss !== null) {
    updateCell_(sheet, rowIndex, 'מחיר סטופ לוס', body.stopLoss);
    // סטופ הוזז (למשל טריילינג סטופ) — מאפסים את דגל ההתראה כדי שתישלח שוב אם המחיר יחצה את הסטופ החדש
    updateCell_(sheet, rowIndex, 'התראת סטופ נשלחה', false);
  }
  if (body.accruedCommission !== undefined && body.accruedCommission !== null) {
    // תיקון/מיגרציה חד-פעמית לעמלות שנצברו — משמש בעיקר לפוזיציות שנפתחו לפני שהתחלנו לעקוב אחרי עמלות
    updateCell_(sheet, rowIndex, 'עמלות שנצברו $', body.accruedCommission);
  }
  if (body.isFavorite !== undefined && body.isFavorite !== null) {
    updateCell_(sheet, rowIndex, 'מועדף', body.isFavorite);
  }
  if (body.tradeReview !== undefined && body.tradeReview !== null) {
    updateCell_(sheet, rowIndex, 'סקירת עסקה (לקחים/טעויות/הפרות כלל)', body.tradeReview);
  }

  return { tradeId: body.tradeId };
}

/**
 * מוחק לצמיתות פוזיציה מלשונית "פוזיציות" וכל הפעולות שלה מלשונית "פעולות".
 */
function handleDelete_(body) {
  var sheet = getPositionsSheet_();
  var rowIndex = findPositionRow_(sheet, body.tradeId);
  if (rowIndex === -1) throw new Error('פוזיציה לא נמצאה: ' + body.tradeId);

  sheet.deleteRow(rowIndex);
  deleteExecutionsForTrade_(body.tradeId);
  recalcEquity_();

  return { tradeId: body.tradeId };
}

function deleteExecutionsForTrade_(tradeId) {
  var sheet = getExecutionsSheet_();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  var ids = sheet.getRange(2, 2, lastRow - 1, 1).getValues(); // עמודה ב' = מזהה עסקה
  // מוחקים מלמטה למעלה כדי לא לשבש אינדקסים של שורות
  for (var i = ids.length - 1; i >= 0; i--) {
    if (ids[i][0] === tradeId) {
      sheet.deleteRow(i + 2);
    }
  }
}

/**
 * מזין בעמודת "מחיר נוכחי (לא ממומש)" נוסחת GOOGLEFINANCE חיה שמצביעה על עמודת הסימול
 * באותה שורה. משמש רק לעסקאות פתוחות — נקרא בפתיחת עסקה, ומנוקה (לערך ריק) בסגירה,
 * כדי שעסקאות סגורות לעולם לא יתעדכנו יותר.
 */
function setLivePriceFormula_(sheet, rowIndex) {
  var symbolCol = POSITIONS_HEADERS.indexOf('סימול') + 1;
  var priceCol = POSITIONS_HEADERS.indexOf('מחיר נוכחי (לא ממומש)') + 1;
  var symbolA1 = sheet.getRange(rowIndex, symbolCol).getA1Notation();
  sheet.getRange(rowIndex, priceCol).setFormula('=IFERROR(GOOGLEFINANCE(' + symbolA1 + ',"price"),"")');
}

// ==================== רשימת מעקב ====================

function getWatchlistSheet_() {
  return ensureSheetWithHeaders_(WATCHLIST_SHEET_NAME, WATCHLIST_HEADERS);
}

function findWatchlistRow_(sheet, watchId) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (ids[i][0] === watchId) return i + 2;
  }
  return -1;
}

function handleWatchlistAdd_(body) {
  var sheet = getWatchlistSheet_();
  // כמו tradeId ב-handleOpen_: הלקוח בד"כ שולח מזהה משלו, אבל אם לא (למשל קריאה מ-GPT) מייצרים אחד
  var watchId = body.watchId || ('W-' + new Date().getTime());
  var row = [
    watchId,
    body.symbol,
    body.addedDate || new Date().toISOString(),
    body.targetPrice === undefined || body.targetPrice === null ? '' : body.targetPrice,
    body.alertDirection || 'above',
    body.notes || '',
    '', // מחיר נוכחי - יוזן כנוסחה חיה למטה
    false,
    '',
    body.listName || DEFAULT_WATCHLIST_NAME,
    body.plannedEntryPrice === undefined || body.plannedEntryPrice === null ? '' : body.plannedEntryPrice,
    body.plannedStopLoss === undefined || body.plannedStopLoss === null ? '' : body.plannedStopLoss,
    body.plannedTargetPrice === undefined || body.plannedTargetPrice === null ? '' : body.plannedTargetPrice,
    body.plannedRiskAmount === undefined || body.plannedRiskAmount === null ? '' : body.plannedRiskAmount,
    body.plannedPattern || '',
    body.plannedShares === undefined || body.plannedShares === null ? '' : body.plannedShares,
    body.sortOrder === undefined || body.sortOrder === null ? 0 : body.sortOrder,
  ];
  sheet.appendRow(row);

  var symbolCol = WATCHLIST_HEADERS.indexOf('סימול') + 1;
  var priceCol = WATCHLIST_HEADERS.indexOf('מחיר נוכחי') + 1;
  var lastRow = sheet.getLastRow();
  var symbolA1 = sheet.getRange(lastRow, symbolCol).getA1Notation();
  sheet.getRange(lastRow, priceCol).setFormula('=IFERROR(GOOGLEFINANCE(' + symbolA1 + ',"price"),"")');

  return { watchId: watchId };
}

function handleWatchlistUpdate_(body) {
  var sheet = getWatchlistSheet_();
  var rowIndex = findWatchlistRow_(sheet, body.watchId);
  if (rowIndex === -1) throw new Error('פריט מעקב לא נמצא: ' + body.watchId);

  function setCell(header, value) {
    var col = WATCHLIST_HEADERS.indexOf(header) + 1;
    sheet.getRange(rowIndex, col).setValue(value);
  }

  if (body.targetPrice !== undefined) {
    setCell('מחיר יעד', body.targetPrice === null ? '' : body.targetPrice);
  }
  if (body.alertDirection !== undefined && body.alertDirection !== null) {
    setCell('כיוון התראה', body.alertDirection);
  }
  if (body.notes !== undefined && body.notes !== null) {
    setCell('הערות', body.notes);
  }
  if (body.listName !== undefined && body.listName !== null) {
    setCell('רשימה', body.listName);
  }
  if (body.plannedEntryPrice !== undefined) {
    setCell('מחיר כניסה מתוכנן', body.plannedEntryPrice === null ? '' : body.plannedEntryPrice);
  }
  if (body.plannedStopLoss !== undefined) {
    setCell('סטופ לוס מתוכנן', body.plannedStopLoss === null ? '' : body.plannedStopLoss);
  }
  if (body.plannedTargetPrice !== undefined) {
    setCell('יעד מתוכנן', body.plannedTargetPrice === null ? '' : body.plannedTargetPrice);
  }
  if (body.plannedRiskAmount !== undefined) {
    setCell('סכום סיכון מתוכנן', body.plannedRiskAmount === null ? '' : body.plannedRiskAmount);
  }
  if (body.plannedPattern !== undefined && body.plannedPattern !== null) {
    setCell('תבנית מתוכננת', body.plannedPattern);
  }
  if (body.plannedShares !== undefined) {
    setCell('כמות מניות מתוכננת', body.plannedShares === null ? '' : body.plannedShares);
  }
  if (body.sortOrder !== undefined && body.sortOrder !== null) {
    setCell('סדר תצוגה', body.sortOrder);
  }
  // שינוי יעד/כיוון מאפס את מצב ההתראה, כדי שתקבל התראה חדשה אם המחיר יחצה שוב
  if (body.targetPrice !== undefined || body.alertDirection !== undefined) {
    setCell('התראה הופעלה', false);
    setCell('תאריך הפעלת התראה', '');
  }

  return { watchId: body.watchId };
}

function handleWatchlistDelete_(body) {
  var sheet = getWatchlistSheet_();
  var rowIndex = findWatchlistRow_(sheet, body.watchId);
  if (rowIndex === -1) throw new Error('פריט מעקב לא נמצא: ' + body.watchId);
  sheet.deleteRow(rowIndex);
  return { watchId: body.watchId };
}

function readWatchlist_() {
  var sheet = getWatchlistSheet_();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  var data = sheet.getRange(2, 1, lastRow - 1, WATCHLIST_HEADERS.length).getValues();
  return data.map(function (row) {
    return {
      watchId: row[0],
      symbol: row[1],
      addedDate: toIsoString_(row[2]),
      targetPrice: row[3] === '' ? null : Number(row[3]),
      alertDirection: row[4] || 'above',
      notes: row[5],
      currentPrice: row[6] === '' ? null : Number(row[6]),
      alertTriggered: row[7] === true,
      alertTriggeredDate: row[8] ? toIsoString_(row[8]) : null,
      listName: row[9] || DEFAULT_WATCHLIST_NAME,
      plannedEntryPrice: row[10] === '' ? null : Number(row[10]),
      plannedStopLoss: row[11] === '' ? null : Number(row[11]),
      plannedTargetPrice: row[12] === '' ? null : Number(row[12]),
      plannedRiskAmount: row[13] === '' ? null : Number(row[13]),
      plannedPattern: row[14] || '',
      plannedShares: row[15] === '' ? null : Number(row[15]),
      sortOrder: row[16] === '' || row[16] === undefined ? 0 : Number(row[16]),
    };
  });
}

/**
 * בודקת את כל פריטי רשימת המעקב שעדיין לא הופעלו, ואם המחיר החי חצה את היעד
 * (מעל/מתחת, לפי מה שהוגדר) — שולחת מייל לבעל הגיליון ומסמנת כמופעלת כדי לא
 * לשלוח שוב. אפשר לקרוא לפונקציה הזו גם דרך טריגר מתוזמן (זמן) לבדיקה ברקע,
 * לא רק כשהאפליקציה פתוחה.
 */
function checkWatchlistAlerts_() {
  var sheet = getWatchlistSheet_();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  var data = sheet.getRange(2, 1, lastRow - 1, WATCHLIST_HEADERS.length).getValues();
  var triggeredCol = WATCHLIST_HEADERS.indexOf('התראה הופעלה');
  var triggeredDateCol = WATCHLIST_HEADERS.indexOf('תאריך הפעלת התראה');

  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    var symbol = row[1];
    var targetPrice = row[3];
    var direction = row[4] || 'above';
    var currentPrice = row[6];
    var alreadyTriggered = row[triggeredCol] === true;

    if (alreadyTriggered || targetPrice === '' || currentPrice === '') continue;

    var hit = direction === 'above' ? Number(currentPrice) >= Number(targetPrice) : Number(currentPrice) <= Number(targetPrice);
    if (!hit) continue;

    var rowIndex = i + 2;
    var now = new Date().toISOString();
    sheet.getRange(rowIndex, triggeredCol + 1).setValue(true);
    sheet.getRange(rowIndex, triggeredDateCol + 1).setValue(now);

    try {
      var directionText = direction === 'above' ? 'עלה מעל' : 'ירד מתחת ל';
      var subject = '🔔 ' + symbol + ' ' + directionText + ' ' + targetPrice + '$';
      var body = symbol + ' הגיע למחיר ' + currentPrice + '$ (יעד: ' + directionText + ' ' + targetPrice + '$).\n\n' +
        'נבדק אוטומטית ע"י אפליקציית יומן המסחר שלך.';
      MailApp.sendEmail(Session.getActiveUser().getEmail(), subject, body);
    } catch (mailErr) {
      // כשל בשליחת מייל לא אמור לעצור את שאר הבדיקות
    }
  }
}

/**
 * בודקת את כל הפוזיציות הפתוחות ושולחת מייל בפעם הראשונה שהמחיר הנוכחי (החי, מ-
 * GOOGLEFINANCE) חוצה את הסטופ לוס שלהן. מאותת פעם אחת בלבד עד שהסטופ מוזז (טריילינג)
 * או שהעסקה נסגרת — בדיוק כמו מנגנון ה-watchlist alerts, כדי לא להציף במיילים חוזרים.
 */
function checkStopLossAlerts_() {
  var sheet = getPositionsSheet_();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  var data = sheet.getRange(2, 1, lastRow - 1, POSITIONS_HEADERS.length).getValues();
  var statusCol = POSITIONS_HEADERS.indexOf('סטאטוס');
  var symbolCol = POSITIONS_HEADERS.indexOf('סימול');
  var stopCol = POSITIONS_HEADERS.indexOf('מחיר סטופ לוס');
  var priceCol = POSITIONS_HEADERS.indexOf('מחיר נוכחי (לא ממומש)');
  var alertCol = POSITIONS_HEADERS.indexOf('התראת סטופ נשלחה');

  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    if (row[statusCol] === 'סגורה') continue;
    if (row[alertCol] === true) continue;

    var stop = row[stopCol];
    var price = row[priceCol];
    if (stop === '' || price === '' || price === undefined) continue;
    if (Number(price) > Number(stop)) continue; // עדיין מעל הסטופ — בסדר

    var rowIndex = i + 2;
    sheet.getRange(rowIndex, alertCol + 1).setValue(true);

    try {
      var symbol = row[symbolCol];
      var subject = '🛑 ' + symbol + ' חצה את הסטופ לוס';
      var msg = symbol + ' נמצא כרגע במחיר ' + price + '$, מתחת/על הסטופ (' + stop + '$) — שקול לסגור את הפוזיציה.\n\n' +
        'נבדק אוטומטית ע"י אפליקציית יומן המסחר שלך.';
      MailApp.sendEmail(Session.getActiveUser().getEmail(), subject, msg);
    } catch (mailErr) {
      // כשל בשליחת מייל לא אמור לעצור את שאר הבדיקות
    }
  }
}

// ==================== הערות כלליות + כללי מסחר ====================

/**
 * לשונית פשוטה בת 2 שורות: A1/B1 = הערות כלליות, A2/B2 = כללי מסחר (תוכנית מסחר).
 * נוצרת אוטומטית בפעם הראשונה שנשמר משהו.
 */
function getNotesSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(NOTES_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(NOTES_SHEET_NAME);
    sheet.getRange('A1').setValue('הערות כלליות').setFontWeight('bold');
    sheet.getRange('A2').setValue('כללי מסחר (תוכנית מסחר)').setFontWeight('bold');
    sheet.setColumnWidth(1, 200);
    sheet.setColumnWidth(2, 600);
  }
  return sheet;
}

function readGeneralNotes_() {
  var sheet = getNotesSheet_();
  return {
    generalNotes: sheet.getRange('B1').getValue() || '',
    tradingRules: sheet.getRange('B2').getValue() || '',
  };
}

function handleSaveNotes_(body) {
  var sheet = getNotesSheet_();
  if (body.generalNotes !== undefined && body.generalNotes !== null) {
    sheet.getRange('B1').setValue(body.generalNotes);
  }
  if (body.tradingRules !== undefined && body.tradingRules !== null) {
    sheet.getRange('B2').setValue(body.tradingRules);
  }
  return { status: 'saved' };
}

// ==================== משיכת תמונות צ'ארט (לייצוא עם תמונות) ====================

var CHART_IMAGES_MAX = 15; // מגבלת בטיחות למספר תמונות בקריאה אחת (זמן ריצה + גודל תשובה)

/**
 * מקבל רשימת עסקאות עם קישור צ'ארט (tradeId/symbol/chartUrl), מושך את עמוד ה-
 * snapshot של כל אחת מ-TradingView, מחלץ ממנו את קישור התמונה האמיתי (og:image),
 * ומחזיר את בייטס התמונה מקודדים ב-base64. רץ בצד השרת (לא בדפדפן) כדי לעקוף
 * מגבלות CORS על משיכת תמונות מאתר חיצוני.
 */
function handleFetchChartImages_(body) {
  var items = body.charts || [];
  var truncated = items.length > CHART_IMAGES_MAX;
  var limited = items.slice(0, CHART_IMAGES_MAX);
  var results = [];

  for (var i = 0; i < limited.length; i++) {
    var item = limited[i];
    try {
      var imageUrl = resolveChartImageUrl_(item.chartUrl);
      if (!imageUrl) {
        results.push({ tradeId: item.tradeId, symbol: item.symbol, error: 'לא נמצאה תמונה בעמוד הצ׳ארט' });
        continue;
      }
      var imgResp = UrlFetchApp.fetch(imageUrl, { muteHttpExceptions: true });
      if (imgResp.getResponseCode() !== 200) {
        results.push({ tradeId: item.tradeId, symbol: item.symbol, error: 'שגיאה במשיכת קובץ התמונה' });
        continue;
      }
      var blob = imgResp.getBlob();
      results.push({
        tradeId: item.tradeId,
        symbol: item.symbol,
        base64: Utilities.base64Encode(blob.getBytes()),
        contentType: blob.getContentType(),
      });
    } catch (err) {
      results.push({ tradeId: item.tradeId, symbol: item.symbol, error: err.message });
    }
  }

  return { images: results, truncated: truncated, totalRequested: items.length, limit: CHART_IMAGES_MAX };
}

// ==================== חישוב equity מצטבר ====================

function recalcEquity_() {
  var sheet = getPositionsSheet_();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  var headers = POSITIONS_HEADERS;
  var closeDateCol = headers.indexOf('תאריך סגירה');
  var openDateCol = headers.indexOf('תאריך פתיחה');
  var statusCol = headers.indexOf('סטאטוס');
  var pnlCol = headers.indexOf('רווח/הפסד ממומש $');
  var equityCol = headers.indexOf('שווי מצטבר (equity)');
  var n = lastRow - 1;

  // קוראים רק את העמודות הדרושות לחישוב עצמו — לא את כל השורה — כדי לא לדרוס
  // בטעות נוסחאות חיות (כמו GOOGLEFINANCE במחיר הנוכחי) בעמודות אחרות באותה שורה
  var statusValues = sheet.getRange(2, statusCol + 1, n, 1).getValues();
  var openDateValues = sheet.getRange(2, openDateCol + 1, n, 1).getValues();
  var closeDateValues = sheet.getRange(2, closeDateCol + 1, n, 1).getValues();
  var pnlValues = sheet.getRange(2, pnlCol + 1, n, 1).getValues();

  // ממיינים אינדקסים לפי תאריך סגירה/פתיחה כדי לחשב equity מצטבר כרונולוגית
  var indices = [];
  for (var i = 0; i < n; i++) {
    indices.push(i);
  }
  indices.sort(function (a, b) {
    var da = new Date(closeDateValues[a][0] || openDateValues[a][0]);
    var db = new Date(closeDateValues[b][0] || openDateValues[b][0]);
    return da - db;
  });

  var initialCapital = getInitialCapital_();
  var running = initialCapital;
  var equityOut = [];
  for (var e = 0; e < n; e++) equityOut.push(['']);
  for (var k = 0; k < indices.length; k++) {
    var idx = indices[k];
    if (statusValues[idx][0] === 'סגורה') {
      running += Number(pnlValues[idx][0]) || 0;
      equityOut[idx] = [running];
    }
  }

  sheet.getRange(2, equityCol + 1, n, 1).setValues(equityOut);
}

function getInitialCapital_() {
  var props = PropertiesService.getScriptProperties();
  var val = props.getProperty('initialCapital');
  return val ? Number(val) : DEFAULT_INITIAL_CAPITAL;
}

/**
 * הגדרות אפליקציה ששמורות בצד השרת (PropertiesService — משותף לכל מכשיר/דפדפן שמחובר
 * לאותו גיליון), כדי שערכים כמו "הון התחלתי" ייקבעו פעם אחת ולא בנפרד בכל מכשיר.
 * שדה שמוחזר כ-null פירושו שהוא מעולם לא הוגדר בשרת (למשל גיליון חדש) — הצד-לקוח
 * יודע להתייחס לזה כ"עדיין לא מסונכרן" במקום לדרוס את הערך המקומי בברירת מחדל.
 */
function getAppSettings_() {
  var props = PropertiesService.getScriptProperties();
  function readNum(key) {
    var val = props.getProperty(key);
    return val === null ? null : Number(val);
  }
  return {
    initialCapital: readNum('initialCapital'),
    defaultAccountBalance: readNum('defaultAccountBalance'),
    defaultRiskAmount: readNum('defaultRiskAmount'),
    commissionPerAction: readNum('commissionPerAction'),
  };
}

function handleUpdateSettings_(body) {
  var props = PropertiesService.getScriptProperties();
  var keys = ['initialCapital', 'defaultAccountBalance', 'defaultRiskAmount', 'commissionPerAction'];
  keys.forEach(function (key) {
    if (body[key] !== undefined && body[key] !== null) {
      props.setProperty(key, String(body[key]));
    }
  });
  // "הון התחלתי" משפיע על כל עמודת השווי המצטבר (equity) בגיליון הפוזיציות
  if (body.initialCapital !== undefined && body.initialCapital !== null) {
    recalcEquity_();
  }
  return getAppSettings_();
}

// ==================== יומן שינויים (Audit Log) ====================

var AUDIT_LOG_HEADERS = ['תאריך', 'מקור', 'פעולה', 'ישות', 'בקשה (JSON)', 'תוצאה (JSON)'];

function getAuditLogSheet_() {
  return ensureSheetWithHeaders_(AUDIT_LOG_SHEET_NAME, AUDIT_LOG_HEADERS);
}

/**
 * רושמת שורה ביומן השינויים לכל פעולת כתיבה: מתי, ממי (source — 'chatgpt'/'app'/וכו',
 * ברירת מחדל 'app'), איזו פעולה, על איזו ישות (tradeId/watchId אם יש), והבקשה+התוצאה
 * המלאות כ-JSON. כשל ברישום עצמו לא אמור אף פעם להפיל את הפעולה המקורית — משום כך יש
 * try/catch שקט כאן ולא בקורא.
 */
function logAudit_(action, body, result) {
  try {
    var sheet = getAuditLogSheet_();
    var entity = body.tradeId || body.watchId || body.flowId || '';
    var bodyForLog = {};
    for (var key in body) {
      if (key !== 'idempotencyKey') bodyForLog[key] = body[key];
    }
    sheet.appendRow([
      new Date().toISOString(),
      body.source || 'app',
      action,
      entity,
      JSON.stringify(bodyForLog),
      JSON.stringify(result),
    ]);
  } catch (err) {
    // לא זורקים החוצה — רישום כושל לא אמור לחסום את הפעולה עצמה
  }
}

// ==================== תזרים הון (הפקדות/משיכות) ====================

var CAPITAL_FLOW_HEADERS = ['מזהה', 'תאריך', 'סוג', 'סכום', 'הערות'];

function getCapitalFlowSheet_() {
  return ensureSheetWithHeaders_(CAPITAL_FLOW_SHEET_NAME, CAPITAL_FLOW_HEADERS);
}

function readCapitalFlows_() {
  var sheet = getCapitalFlowSheet_();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  var data = sheet.getRange(2, 1, lastRow - 1, CAPITAL_FLOW_HEADERS.length).getValues();
  return data.map(function (row) {
    return {
      flowId: row[0],
      date: toIsoString_(row[1]),
      type: row[2], // 'deposit' | 'withdrawal'
      amount: Number(row[3]) || 0,
      notes: row[4] || '',
    };
  });
}

function handleAddCapitalFlow_(body) {
  var sheet = getCapitalFlowSheet_();
  var flowId = body.flowId || ('F-' + new Date().getTime());
  sheet.appendRow([
    flowId,
    body.date || new Date().toISOString(),
    body.type === 'withdrawal' ? 'withdrawal' : 'deposit',
    body.amount,
    body.notes || '',
  ]);
  return { flowId: flowId };
}

function handleDeleteCapitalFlow_(body) {
  var sheet = getCapitalFlowSheet_();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) throw new Error('אין רשומות תזרים הון');
  var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (ids[i][0] === body.flowId) {
      sheet.deleteRow(i + 2);
      return { flowId: body.flowId };
    }
  }
  throw new Error('רשומת תזרים הון לא נמצאה: ' + body.flowId);
}

// ==================== נתוני שוק (Twelve Data) ====================
// המפתח נשמר ב-Script Properties, בדיוק כמו שאר ההגדרות — אבל בכוונה *לא* נחשף חזרה
// דרך getAppSettings_/doGet, ובכוונה *לא* עובר דרך logAudit_ (ראה doPost: 'setApiKey'
// לא ברשימת WRITE_ACTIONS_), כדי שמפתח ה-API לא ייחשף בשום תשובת JSON או ביומן השינויים.

var TWELVE_DATA_BASE_URL = 'https://api.twelvedata.com';

function getMarketDataApiKey_() {
  return PropertiesService.getScriptProperties().getProperty('twelveDataApiKey');
}

function handleSetApiKey_(body) {
  if (!body.apiKey) throw new Error('apiKey חסר');
  PropertiesService.getScriptProperties().setProperty('twelveDataApiKey', body.apiKey);
  return { ok: true };
}

/**
 * מביאה נרות היסטוריים מ-Twelve Data ומחשבת מהם ממוצעים נעים/ATR/נפח יחסי/שיא-שפל
 * שנתי בעצמנו (ה-tier החינמי של Twelve Data לא כולל אינדיקטורים מחושבים). interval
 * ברירת מחדל '1day'; '1week' נתמך גם כן. מחזירה עד 260 נרות — מספיק בדיוק ל-SMA200.
 */
function fetchChartData_(symbol, interval) {
  if (!symbol) throw new Error('symbol חסר');
  var apiKey = getMarketDataApiKey_();
  if (!apiKey) throw new Error('לא הוגדר מפתח API לנתוני שוק — יש להגדיר אותו קודם (action: setApiKey)');
  interval = interval || '1day';

  var url = TWELVE_DATA_BASE_URL + '/time_series?symbol=' + encodeURIComponent(symbol) +
    '&interval=' + encodeURIComponent(interval) + '&outputsize=260&apikey=' + encodeURIComponent(apiKey);
  var resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  var data = JSON.parse(resp.getContentText());
  if (data.status === 'error') {
    throw new Error('שגיאה מספק נתוני השוק: ' + (data.message || 'unknown error'));
  }
  var rawValues = data.values || [];
  if (rawValues.length === 0) {
    throw new Error('לא נמצאו נתונים עבור ' + symbol);
  }

  // Twelve Data מחזיר מהחדש לישן — הופכים לכרונולוגי (ישן -> חדש) לצורך חישוב האינדיקטורים
  var candles = rawValues.slice().reverse().map(function (v) {
    return {
      time: v.datetime,
      open: Number(v.open),
      high: Number(v.high),
      low: Number(v.low),
      close: Number(v.close),
      volume: Number(v.volume),
    };
  });

  var closes = candles.map(function (c) { return c.close; });
  var volumes = candles.map(function (c) { return c.volume; });

  function avg(arr) {
    return arr.reduce(function (a, b) { return a + b; }, 0) / arr.length;
  }

  function sma(period) {
    if (closes.length < period) return null;
    return avg(closes.slice(closes.length - period));
  }

  function avgVolume(period) {
    if (volumes.length < period) return null;
    return avg(volumes.slice(volumes.length - period));
  }

  // ATR(period) לפי נוסחת True Range הבסיסית (ממוצע פשוט, לא Wilder smoothing)
  function atr(period) {
    if (candles.length < period + 1) return null;
    var trueRanges = [];
    for (var i = 1; i < candles.length; i++) {
      var cur = candles[i], prev = candles[i - 1];
      trueRanges.push(Math.max(
        cur.high - cur.low,
        Math.abs(cur.high - prev.close),
        Math.abs(cur.low - prev.close)
      ));
    }
    return avg(trueRanges.slice(trueRanges.length - period));
  }

  var last52w = candles.slice(Math.max(0, candles.length - 252));
  var high52Week = last52w.length ? Math.max.apply(null, last52w.map(function (c) { return c.high; })) : null;
  var low52Week = last52w.length ? Math.min.apply(null, last52w.map(function (c) { return c.low; })) : null;
  var lastVolume = volumes.length ? volumes[volumes.length - 1] : null;
  var avgVolume20 = avgVolume(20);

  return {
    symbol: symbol,
    interval: interval,
    currentPrice: closes.length ? closes[closes.length - 1] : null,
    sma20: sma(20),
    sma50: sma(50),
    sma150: sma(150),
    sma200: sma(200),
    atr14: atr(14),
    avgVolume20: avgVolume20,
    avgVolume50: avgVolume(50),
    relativeVolume: (lastVolume !== null && avgVolume20) ? lastVolume / avgVolume20 : null,
    high52Week: high52Week,
    low52Week: low52Week,
    candles: candles,
  };
}

// ==================== קריאת נתונים ל-doGet ====================

function readPositions_() {
  var sheet = getPositionsSheet_();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  var data = sheet.getRange(2, 1, lastRow - 1, POSITIONS_HEADERS.length).getValues();
  return data.map(function (row) {
    return {
      tradeId: row[0],
      openDate: toIsoString_(row[1]),
      symbol: row[2],
      status: row[3],
      pattern: row[4],
      avgEntryPrice: Number(row[5]) || 0,
      currentShares: Number(row[6]) || 0,
      originalShares: Number(row[7]) || 0,
      stopLoss: Number(row[8]) || 0,
      targetPrice: row[9] === '' ? null : Number(row[9]),
      riskAmount: Number(row[10]) || 0,
      currentPositionSize: Number(row[11]) || 0,
      accountPercentage: row[12] === '' ? null : Number(row[12]),
      riskPercentage: row[13] === '' ? null : Number(row[13]),
      plannedRR: row[14] === '' ? null : Number(row[14]),
      target2R: row[15] === '' ? null : Number(row[15]),
      target3R: row[16] === '' ? null : Number(row[16]),
      accountBalance: row[17] === '' ? null : Number(row[17]),
      realizedPnl: Number(row[18]) || 0,
      realizedR: row[19] === '' ? null : Number(row[19]),
      outcome: row[20],
      winLoss: row[21],
      category: row[22],
      closeDate: row[23] ? toIsoString_(row[23]) : null,
      setupReason: row[24],
      chartUrl: row[25],
      notes: row[26],
      equity: row[27] === '' ? null : Number(row[27]),
      currentPrice: row[28] === '' || row[28] === undefined ? null : Number(row[28]),
      accruedCommission: Number(row[29]) || 0,
      isFavorite: row[30] === true,
      target4R: row[31] === '' || row[31] === undefined ? null : Number(row[31]),
      tradeReview: row[32] || '',
    };
  });
}

function readExecutions_() {
  var sheet = getExecutionsSheet_();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  var data = sheet.getRange(2, 1, lastRow - 1, EXECUTIONS_HEADERS.length).getValues();
  return data.map(function (row) {
    return {
      execId: row[0],
      tradeId: row[1],
      timestamp: toIsoString_(row[2]),
      symbol: row[3],
      actionType: row[4],
      price: Number(row[5]) || 0,
      shares: Number(row[6]) || 0,
      amount: Number(row[7]) || 0,
      realizedPnlInAction: Number(row[8]) || 0,
      notes: row[9],
    };
  });
}

function toIsoString_(value) {
  if (value instanceof Date) return value.toISOString();
  return value;
}

// ==================== עוזרי גיליון ====================

function getPositionsSheet_() {
  return ensureSheetWithHeaders_(POSITIONS_SHEET_NAME, POSITIONS_HEADERS);
}

function getExecutionsSheet_() {
  return ensureSheetWithHeaders_(EXECUTIONS_SHEET_NAME, EXECUTIONS_HEADERS);
}

function getStatsSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(STATS_SHEET_NAME);
}

function ensureSheetWithHeaders_(name, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  } else {
    // מיגרציה: אם נוספו כותרות חדשות לקוד אחרי שהגיליון כבר נוצר (למשל עדכון גרסה),
    // משלימים אותן בסוף שורת הכותרות בלי לפגוע בנתונים קיימים.
    var existingLastCol = sheet.getLastColumn();
    if (existingLastCol < headers.length) {
      var missing = headers.slice(existingLastCol);
      sheet.getRange(1, existingLastCol + 1, 1, missing.length).setValues([missing]);
      sheet.getRange(1, existingLastCol + 1, 1, missing.length).setFontWeight('bold');
    }
  }
  return sheet;
}

function buildEmptyRow_() {
  var row = {};
  for (var i = 0; i < POSITIONS_HEADERS.length; i++) {
    row[POSITIONS_HEADERS[i]] = '';
  }
  return row;
}

function setByHeader_(rowObj, header, value) {
  rowObj[header] = value === undefined || value === null ? '' : value;
}

function appendRow_(sheet, headers, rowObj) {
  var values = headers.map(function (h) {
    return rowObj[h];
  });
  sheet.appendRow(values);
}

function findPositionRow_(sheet, tradeId) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (ids[i][0] === tradeId) return i + 2; // מספר שורה בגיליון (1-based, + כותרת)
  }
  return -1;
}

function readRowByIndex_(sheet, rowIndex) {
  var values = sheet.getRange(rowIndex, 1, 1, POSITIONS_HEADERS.length).getValues()[0];
  var obj = {};
  for (var i = 0; i < POSITIONS_HEADERS.length; i++) {
    obj[POSITIONS_HEADERS[i]] = values[i];
  }
  return obj;
}

function updateCell_(sheet, rowIndex, header, value) {
  var colIndex = POSITIONS_HEADERS.indexOf(header) + 1;
  sheet.getRange(rowIndex, colIndex).setValue(value === undefined || value === null ? '' : value);
}

function addExecutionRow_(exec) {
  var sheet = getExecutionsSheet_();
  var values = EXECUTIONS_HEADERS.map(function (h) {
    switch (h) {
      case 'מזהה פעולה': return exec.execId;
      case 'מזהה עסקה': return exec.tradeId;
      case 'תאריך ושעה': return exec.timestamp;
      case 'סימול': return exec.symbol;
      case 'סוג פעולה': return exec.actionType;
      case 'מחיר': return exec.price;
      case 'כמות מניות': return exec.shares;
      case 'סכום $': return exec.amount;
      case 'רווח/הפסד ממומש בפעולה $': return exec.realizedPnlInAction;
      case 'הערות': return exec.notes;
      default: return '';
    }
  });
  sheet.appendRow(values);
}

// ==================== לשונית סטטיסטיקה (נוסחאות חיות) ====================

/**
 * בונה (או יוצר) את לשונית "סטטיסטיקה" עם נוסחאות חיות (SUMIF/COUNTIF/AVERAGEIF)
 * שמצביעות ללשונית "פוזיציות". לא דורס נתונים בכל קריאה — רק בונה מבנה אם חסר,
 * ומעדכן את טווח הנוסחאות אם נוספו שורות חדשות ל"פוזיציות".
 */
function ensureStatsSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(STATS_SHEET_NAME);
  var isNew = false;
  if (!sheet) {
    sheet = ss.insertSheet(STATS_SHEET_NAME);
    isNew = true;
  }

  var posSheet = getPositionsSheet_();
  var lastRow = Math.max(posSheet.getLastRow(), 2);
  var range = "'" + POSITIONS_SHEET_NAME + "'!";

  // עמודות בלשונית "פוזיציות" (אות בגיליון) - עקביות עם POSITIONS_HEADERS
  var COL_PATTERN = 'E';
  var COL_PNL = 'S';
  var COL_WINLOSS = 'V';
  var COL_CATEGORY = 'W';

  sheet.clear();

  var rows = [];
  rows.push(['סטטיסטיקה — מחושבת אוטומטית מלשונית פוזיציות', '']);
  rows.push(['', '']);
  rows.push(['הון התחלתי', getInitialCapital_()]);
  rows.push(['רווח/הפסד ממומש כולל', '=SUM(' + range + COL_PNL + '2:' + COL_PNL + lastRow + ')']);
  rows.push(['שווי נוכחי', '=B3+B4']);
  rows.push(['רווח/הפסד באחוזים', '=(B5-B3)/B3']);
  rows.push(['', '']);
  rows.push(['כמות עסקאות מנצחות', '=COUNTIF(' + range + COL_WINLOSS + '2:' + COL_WINLOSS + lastRow + ',"WIN")']);
  rows.push(['כמות עסקאות מפסידות', '=COUNTIF(' + range + COL_WINLOSS + '2:' + COL_WINLOSS + lastRow + ',"LOSS")']);
  rows.push(['אחוז מנצחות', '=IFERROR(B8/(B8+B9),0)']);
  rows.push(['אחוז מפסידות', '=IFERROR(B9/(B8+B9),0)']);
  rows.push(['ממוצע רווח לעסקה מנצחת', '=IFERROR(AVERAGEIF(' + range + COL_PNL + '2:' + COL_PNL + lastRow + ',">0"),0)']);
  rows.push(['ממוצע הפסד לעסקה מפסידה', '=IFERROR(-AVERAGEIF(' + range + COL_PNL + '2:' + COL_PNL + lastRow + ',"<0"),0)']);
  rows.push(['תוחלת לעסקה', '=(B10*B12)-(B11*B13)']);
  rows.push(['', '']);
  rows.push(['פילוח לפי סוג הגרף (Pattern)', '']);
  rows.push(['תבנית', 'רווח/הפסד', 'כמות עסקאות']);

  var patternStartRow = rows.length + 1;
  var patterns = ['Breakout', 'Breakout + Retest', 'Bull Flag', 'Cup with Handle', 'VCP', 'LPS', 'Inside Candle', 'FOMO / No Setup', 'אחר'];
  patterns.forEach(function (p) {
    rows.push([
      p,
      '=SUMIF(' + range + COL_PATTERN + '2:' + COL_PATTERN + lastRow + ',"' + p + '",' + range + COL_PNL + '2:' + COL_PNL + lastRow + ')',
      '=COUNTIF(' + range + COL_PATTERN + '2:' + COL_PATTERN + lastRow + ',"' + p + '")',
    ]);
  });

  rows.push(['', '']);
  rows.push(['פילוח לפי קטגוריה/תגית', '']);
  rows.push(['קטגוריה', 'רווח/הפסד', 'כמות עסקאות']);

  var categories = ['עסקה מושלמת', 'עסקה כישלון', 'סטופ קצר / החמצה', 'ניהול טוב', 'כניסה מוקדמת', 'רדיפה / FOMO'];
  categories.forEach(function (c) {
    rows.push([
      c,
      '=SUMIF(' + range + COL_CATEGORY + '2:' + COL_CATEGORY + lastRow + ',"' + c + '",' + range + COL_PNL + '2:' + COL_PNL + lastRow + ')',
      '=COUNTIF(' + range + COL_CATEGORY + '2:' + COL_CATEGORY + lastRow + ',"' + c + '")',
    ]);
  });

  // מיישרים את כל השורות לרוחב 3 עמודות לפני כתיבה
  var maxCols = 3;
  var normalized = rows.map(function (r) {
    while (r.length < maxCols) r.push('');
    return r;
  });

  sheet.getRange(1, 1, normalized.length, maxCols).setValues(normalized);
  sheet.getRange(1, 1).setFontWeight('bold').setFontSize(14);
  sheet.getRange(patternStartRow - 1, 1, 1, maxCols).setFontWeight('bold');
  sheet.autoResizeColumns(1, maxCols);

  if (isNew) {
    ss.setActiveSheet(posSheet); // לא נשארים על לשונית הסטטיסטיקה אחרי יצירה ראשונה
  }
}

/** קריאה ידנית לרענון הגדרות הון התחלתי מ-Script Properties, אופציונלי */
function setInitialCapital(amount) {
  PropertiesService.getScriptProperties().setProperty('initialCapital', String(amount));
  ensureStatsSheet_();
  recalcEquity_();
}
