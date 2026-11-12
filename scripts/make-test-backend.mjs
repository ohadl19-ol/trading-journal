// יוצר עותק של google-apps-script.gs לסביבת בדיקה נפרדת: מחליף את שני מזהי הגיליונות
// במזהים של שני גיליונות פיקטיביים. הקובץ נכתב לנתיב שמבקשים, לא לתוך הפרויקט.
//
// שימוש: node scripts/make-test-backend.mjs <מזהה-גיליון-"אמיתי"-פיקטיבי> <מזהה-גיליון-דמו-פיקטיבי> <קובץ-פלט>
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const [realId, demoId, out] = process.argv.slice(2)
if (!realId || !demoId || !out) {
  console.error('שימוש: node scripts/make-test-backend.mjs <REAL_TEST_ID> <DEMO_TEST_ID> <OUTPUT_FILE>')
  process.exit(1)
}
const src = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'google-apps-script.gs'), 'utf8')
const m = /var SHEET_IDS_ = \{\s*real: '([^']+)',\s*demo: '([^']+)',\s*\};/.exec(src)
if (!m) throw new Error('לא נמצאה הגדרת SHEET_IDS_')
if (realId === demoId || [realId, demoId].some((id) => id === m[1] || id === m[2])) {
  throw new Error('המזהים של סביבת הבדיקה חייבים להיות שונים זה מזה ושונים מהגיליונות האמיתיים')
}
const outSrc = src.replace(m[0], `var SHEET_IDS_ = {\n  // סביבת בדיקה — גיליונות פיקטיביים בלבד\n  real: '${realId}',\n  demo: '${demoId}',\n};`)
fs.writeFileSync(out, outSrc)
console.log('נכתב:', out)
