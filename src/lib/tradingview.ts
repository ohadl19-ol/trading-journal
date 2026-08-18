/** קישור לגרף החי הנוכחי של הסימול ב-TradingView (לא צילום מסך שמור - זה בטאב "קישור צ'ארט") */
export function tradingViewSymbolUrl(symbol: string): string {
  return `https://www.tradingview.com/symbols/${encodeURIComponent(symbol.trim().toUpperCase())}/`
}
