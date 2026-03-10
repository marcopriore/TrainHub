import * as XLSX from 'xlsx'

/**
 * Obtém valor de uma linha por chave (case-insensitive)
 */
export function getExcelValue(row: Record<string, unknown>, key: string): unknown {
  const k = Object.keys(row).find((k) => k.toLowerCase().trim() === key.toLowerCase())
  const v = k ? row[k] : undefined
  return typeof v === 'string' ? v.trim() : v
}

/**
 * Lê um arquivo Excel e retorna os dados da primeira planilha como array de objetos
 * (chaves = primeira linha, valores = demais linhas)
 */
export function parseExcelFile(file: File): Promise<Record<string, unknown>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = e.target?.result
        if (!data) {
          reject(new Error('Falha ao ler o arquivo.'))
          return
        }
        const workbook = XLSX.read(data, { type: 'binary' })
        const sheetName = workbook.SheetNames[0]
        const sheet = workbook.Sheets[sheetName]
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
          raw: false,
          defval: '',
        })
        resolve(json)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = () => reject(new Error('Falha ao ler o arquivo.'))
    reader.readAsBinaryString(file)
  })
}

/**
 * Gera e faz download de um arquivo Excel template
 */
export function downloadTemplate(
  headers: string[],
  sampleRow?: Record<string, string>,
  filename = 'template.xlsx'
) {
  const wsData = [headers]
  if (sampleRow) {
    wsData.push(headers.map((h) => sampleRow[h] ?? ''))
  }
  const ws = XLSX.utils.aoa_to_sheet(wsData)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Planilha1')
  XLSX.writeFile(wb, filename)
}
