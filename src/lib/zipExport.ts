import JSZip from 'jszip'
import type { Execution, Position } from '@/types'
import { buildExecutionsCsv, buildPositionsCsv } from '@/lib/csvExport'
import { fetchChartImages, type ChartImageResult } from '@/lib/api'

export interface ZipExportResult {
  imagesIncluded: number
  imagesFailed: number
  truncated: boolean
}

function extensionFor(contentType: string | undefined): string {
  if (!contentType) return 'png'
  if (contentType.includes('jpeg') || contentType.includes('jpg')) return 'jpg'
  if (contentType.includes('gif')) return 'gif'
  return 'png'
}

function sanitizeFilename(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, '-')
}

/**
 * מייצא קובץ ZIP אחד שמכיל: CSV של הפוזיציות המסוננות + CSV של הפעולות שלהן +
 * תמונות הצ'ארט האמיתיות (לא רק קישורים) — מוכן להעלאה ישירה ל-ChatGPT או כלי
 * ניתוח אחר. משיכת התמונות עצמה מתבצעת דרך ה-Backend (Apps Script) כדי לעקוף
 * מגבלות CORS על משיכה ישירה מהדפדפן.
 */
export async function exportFilteredZip(
  webAppUrl: string,
  filteredPositions: Position[],
  allExecutions: Execution[],
  onProgress?: (message: string) => void,
): Promise<ZipExportResult> {
  const tradeIds = new Set(filteredPositions.map((p) => p.tradeId))
  const filteredExecutions = allExecutions.filter((e) => tradeIds.has(e.tradeId))

  const zip = new JSZip()
  const date = new Date().toISOString().slice(0, 10)

  zip.file(`פוזיציות-${date}.csv`, buildPositionsCsv(filteredPositions))
  zip.file(`פעולות-${date}.csv`, buildExecutionsCsv(filteredExecutions))

  const withCharts = filteredPositions
    .filter((p) => p.chartUrl)
    .map((p) => ({ tradeId: p.tradeId, symbol: p.symbol, chartUrl: p.chartUrl }))

  let imagesIncluded = 0
  let imagesFailed = 0
  let truncated = false

  if (withCharts.length > 0) {
    onProgress?.(`מוריד ${withCharts.length} תמונות צ'ארט...`)
    const response = await fetchChartImages(webAppUrl, withCharts)
    truncated = response.truncated

    const imagesFolder = zip.folder('צ׳ארטים')
    const usedNames = new Map<string, number>()

    response.images.forEach((img: ChartImageResult) => {
      if (img.error || !img.base64) {
        imagesFailed += 1
        return
      }
      const baseName = sanitizeFilename(`${img.symbol}-${img.tradeId}`)
      const count = usedNames.get(baseName) ?? 0
      usedNames.set(baseName, count + 1)
      const filename = `${baseName}${count > 0 ? `-${count}` : ''}.${extensionFor(img.contentType)}`
      imagesFolder?.file(filename, img.base64, { base64: true })
      imagesIncluded += 1
    })
  }

  onProgress?.('אורז קובץ ZIP...')
  const blob = await zip.generateAsync({ type: 'blob' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `יומן-מסחר-מסונן-עם-תמונות-${date}.zip`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)

  return { imagesIncluded, imagesFailed, truncated }
}
