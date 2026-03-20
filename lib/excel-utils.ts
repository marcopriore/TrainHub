import * as XLSX from 'xlsx-js-style'

// Cores do sistema TrainHub
const COLORS = {
  teal: '00C9A7',
  azul: '3B82F6',
  headerBg: '0F172A',
  textLight: 'FFFFFF',
  rowAlt: 'F0FDFB',
  rowWhite: 'FFFFFF',
  border: 'E2E8F0',
  textDark: '1E293B',
} as const

// Estilos reutilizáveis
const headerStyle = {
  fill: { fgColor: { rgb: COLORS.headerBg } },
  font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: COLORS.textLight } },
  alignment: { horizontal: 'center' as const, vertical: 'center' as const },
}
const titleStyle = {
  fill: { fgColor: { rgb: COLORS.teal } },
  font: { name: 'Calibri', sz: 13, bold: true, color: { rgb: COLORS.textLight } },
  alignment: { horizontal: 'center' as const, vertical: 'center' as const },
}
const dataRowStyle = (isEven: boolean) => ({
  fill: { fgColor: { rgb: isEven ? COLORS.rowAlt : COLORS.rowWhite } },
  font: { name: 'Calibri', sz: 11, color: { rgb: COLORS.textDark } },
  alignment: { horizontal: 'left' as const, vertical: 'center' as const },
})
const dataRowCenterStyle = (isEven: boolean) => ({
  fill: { fgColor: { rgb: isEven ? COLORS.rowAlt : COLORS.rowWhite } },
  font: { name: 'Calibri', sz: 11, color: { rgb: COLORS.textDark } },
  alignment: { horizontal: 'center' as const, vertical: 'center' as const },
})
const totalRowStyle = {
  fill: { fgColor: { rgb: COLORS.headerBg } },
  font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: COLORS.textLight } },
  alignment: { horizontal: 'center' as const, vertical: 'center' as const },
}

function cell(value: unknown, style: object): XLSX.CellObject {
  return { v: value ?? '', t: typeof value === 'number' ? 'n' : 's', s: style }
}

const WIDTH_MIN = 20
const WIDTH_MAX = 40
const WIDTH_LONG_TITLE = 25
const WIDTH_TEXT_FREE = 40

function getColWidths(
  headers: string[],
  data: Record<string, unknown>[],
  textFreeKeys?: Set<string>,
  longTitleKeys?: Set<string>
): XLSX.ColInfo[] {
  return headers.map((h) => {
    if (textFreeKeys?.has(h)) return { wch: WIDTH_TEXT_FREE }
    const dataMax = data.length ? Math.max(...data.map((r) => String(r[h] ?? '').length)) : 0
    const baseMin = longTitleKeys?.has(h) ? WIDTH_LONG_TITLE : WIDTH_MIN
    const maxLen = Math.max(h.length, dataMax, baseMin)
    return { wch: Math.min(maxLen, WIDTH_MAX) }
  })
}

/**
 * Obtém valor de uma linha por chave (case-insensitive).
 * headerAliases: mapeia chave técnica -> array de nomes possíveis no Excel (ex: nome -> ['Nome do Treinamento', 'Nome'])
 */
export function getExcelValue(
  row: Record<string, unknown>,
  key: string,
  headerAliases?: Record<string, string[]>
): unknown {
  if (headerAliases?.[key]) {
    for (const alias of headerAliases[key]) {
      const k = Object.keys(row).find((k2) => k2.toLowerCase().trim() === alias.toLowerCase())
      if (k) {
        const v = row[k]
        return typeof v === 'string' ? (v as string).trim() : v
      }
    }
  }
  const k = Object.keys(row).find((k2) => k2.toLowerCase().trim() === key.toLowerCase())
  const v = k ? row[k] : undefined
  return typeof v === 'string' ? (v as string).trim() : v
}

export interface ParseExcelOptions {
  /** Se true, ignora a primeira linha (título) e usa a segunda como cabeçalho */
  skipTitleRow?: boolean
}

/**
 * Lê um arquivo Excel e retorna os dados da primeira planilha como array de objetos
 */
export function parseExcelFile(
  file: File,
  options?: ParseExcelOptions
): Promise<Record<string, unknown>[]> {
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
        const sheetOptions: XLSX.JSON2SheetOpts & { range?: string } = {
          raw: false,
          defval: '',
        }
        if (options?.skipTitleRow) {
          const ref = (sheet['!ref'] as string) || 'A1:Z100'
          const match = ref.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/)
          if (match) {
            const startRow = parseInt(match[2], 10) + 1
            sheetOptions.range = `${match[1]}${startRow}:${match[3]}${match[4]}`
          }
        }
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, sheetOptions)
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
 * colWidths: largura por coluna em caracteres (padrão 20; use 25 para títulos longos, 40 para texto livre)
 */
export function downloadTemplate(
  headers: string[],
  sampleRow?: Record<string, string>,
  filename = 'template.xlsx',
  title?: string,
  colWidths?: number[]
) {
  const wb = XLSX.utils.book_new()
  const hasTitle = !!title

  const aoa: (string | number | XLSX.CellObject)[][] = []
  if (hasTitle) {
    aoa.push([{ v: title, t: 's', s: titleStyle }])
  }
  aoa.push(headers.map((h) => ({ v: h, t: 's', s: headerStyle })))
  if (sampleRow) {
    aoa.push(headers.map((h) => ({ v: sampleRow[h] ?? '', t: 's', s: dataRowStyle(false) })))
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa)

  if (hasTitle) {
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } }]
  }
  const rowHeights = [
    ...(hasTitle ? [{ hpt: 27 }] : []),
    { hpt: 24 },
    ...(sampleRow ? Array(1).fill({ hpt: 17 }) : []),
  ]
  ws['!rows'] = rowHeights
  ws['!cols'] = headers.map((_, i) => ({
    wch: colWidths?.[i] ?? Math.max(headers[i]?.length ?? WIDTH_MIN, WIDTH_MIN),
  }))
  ws['!sheetViews'] = [{ showGridLines: false }]

  XLSX.utils.book_append_sheet(wb, ws, 'Planilha1')
  XLSX.writeFile(wb, filename)
}

export interface ParseExcelTwoSheetsResult {
  treinamentos: Record<string, unknown>[]
  participantes: Record<string, unknown>[]
}

/**
 * Lê um arquivo Excel e retorna dados da primeira e segunda planilha.
 * A segunda planilha é opcional — se não existir, retorna array vazio.
 */
export function parseExcelFileWithTwoSheets(
  file: File,
  options?: ParseExcelOptions
): Promise<ParseExcelTwoSheetsResult> {
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
        const sheet0 = workbook.Sheets[workbook.SheetNames[0]!]
        const sheet1 = workbook.SheetNames[1]
          ? workbook.Sheets[workbook.SheetNames[1]!]
          : null

        const sheetOptions: XLSX.JSON2SheetOpts & { range?: string } = {
          raw: false,
          defval: '',
        }
        if (options?.skipTitleRow && sheet0) {
          const ref = (sheet0['!ref'] as string) || 'A1:Z100'
          const match = ref.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/)
          if (match) {
            const startRow = parseInt(match[2], 10) + 1
            sheetOptions.range = `${match[1]}${startRow}:${match[3]}${match[4]}`
          }
        }

        const treinamentos = sheet0
          ? XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet0, sheetOptions)
          : []

        let participantes: Record<string, unknown>[] = []
        if (sheet1) {
          participantes = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet1, {
            raw: false,
            defval: '',
          })
        }

        resolve({ treinamentos, participantes })
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = () => reject(new Error('Falha ao ler o arquivo.'))
    reader.readAsBinaryString(file)
  })
}

/**
 * Gera template de importação com duas abas: Treinamentos e Participantes
 */
export function downloadImportTreinamentosTemplate(
  sheet1Name: string,
  treinamentosHeaders: string[],
  treinamentosSample: Record<string, string>,
  treinamentosColWidths: number[],
  participantesSampleRows: (string | number)[][],
  filename: string,
  title: string
) {
  const wb = XLSX.utils.book_new()

  const aoa1: (string | number | XLSX.CellObject)[][] = []
  aoa1.push([{ v: title, t: 's', s: titleStyle }])
  aoa1.push(treinamentosHeaders.map((h) => ({ v: h, t: 's', s: headerStyle })))
  aoa1.push(treinamentosHeaders.map((h) => ({ v: treinamentosSample[h] ?? '', t: 's', s: dataRowStyle(false) })))

  const ws1 = XLSX.utils.aoa_to_sheet(aoa1)
  ws1['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: treinamentosHeaders.length - 1 } }]
  ws1['!cols'] = treinamentosColWidths.map((w) => ({ wch: w }))
  XLSX.utils.book_append_sheet(wb, ws1, sheet1Name)

  const partHeaders = ['Treinamento #', 'Nome', 'E-mail']
  const aoa2: (string | number | XLSX.CellObject)[][] = []
  aoa2.push(partHeaders.map((h) => ({ v: h, t: 's', s: headerStyle })))
  participantesSampleRows.forEach((row, idx) => {
    aoa2.push(row.map((v) => ({ v, t: typeof v === 'number' ? 'n' : 's', s: dataRowStyle(idx % 2 === 1) })))
  })
  const ws2 = XLSX.utils.aoa_to_sheet(aoa2)
  ws2['!cols'] = [{ wch: 15 }, { wch: 30 }, { wch: 30 }]
  XLSX.utils.book_append_sheet(wb, ws2, 'Participantes')

  XLSX.writeFile(wb, filename)
}

/**
 * Exporta relatório para Excel com múltiplas abas
 * headerLabels: mapeia chave técnica -> label legível (ex: mes -> Mês)
 */
export function exportReportToExcel(
  sheets: { name: string; data: Record<string, unknown>[]; headerLabels?: Record<string, string> }[]
) {
  const wb = XLSX.utils.book_new()
  const hoje = new Date().toISOString().slice(0, 10)

  for (const { name, data, headerLabels } of sheets) {
    const headers = data.length > 0 ? Object.keys(data[0]!) : ['(sem dados)']
    const headerLabelsMap = headerLabels ?? {}
    const displayHeaders = headers.map((h) => headerLabelsMap[h] ?? h)
    const aoa: (string | number | XLSX.CellObject)[][] = []

    // Cabeçalho (labels legíveis)
    aoa.push(displayHeaders.map((h) => cell(h, headerStyle)))

    // Dados
    const numericKeys = new Set([
      'horasParceiro', 'horasColaborador', 'totalHoras', 'qtdTreinamentos',
      'mediaSatisfacao', 'mediaAprovacao', 'posicao',
    ])
    data.forEach((row, idx) => {
      const isEven = idx % 2 === 1
      aoa.push(
        headers.map((h) => {
          const val = row[h]
          const isNum = numericKeys.has(h) || typeof val === 'number'
          return cell(val, isNum ? dataRowCenterStyle(isEven) : dataRowStyle(isEven))
        })
      )
    })

    // Linha de totais (para abas com soma de horas)
    const sheetsWithTotals = ['Horas por Empresa', 'Horas por Setor', 'Ranking Colaboradores', 'Ranking Empresas']
    if (sheetsWithTotals.includes(name) && data.length > 0) {
      const totalHorasIdx = headers.indexOf('totalHoras')
      const totalHoras = totalHorasIdx >= 0
        ? data.reduce((sum, r) => sum + (Number(r[headers[totalHorasIdx]]) || 0), 0)
        : null
      const totalQtdIdx = headers.indexOf('qtdTreinamentos')
      const totalQtd = totalQtdIdx >= 0
        ? data.reduce((sum, r) => sum + (Number(r[headers[totalQtdIdx]]) || 0), 0)
        : null

      const totalRow: XLSX.CellObject[] = headers.map((h, i) => {
        if (i === 0) return cell('Total', totalRowStyle)
        if (h === 'totalHoras' && totalHoras != null) return cell(totalHoras, totalRowStyle)
        if (h === 'qtdTreinamentos' && totalQtd != null) return cell(totalQtd, totalRowStyle)
        if (h === 'mediaSatisfacao' || h === 'mediaAprovacao') {
          const vals = data.map((r) => Number(r[h])).filter((n) => !isNaN(n))
          const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
          return cell(avg != null ? avg.toFixed(1) : '', totalRowStyle)
        }
        return cell('', totalRowStyle)
      })
      aoa.push(totalRow)
    }

    if (data.length === 0) {
      aoa.push(headers.map((h) => cell(h === headers[0] ? 'Nenhum dado para o período selecionado' : '', dataRowStyle(false))))
    }

    const ws = XLSX.utils.aoa_to_sheet(aoa)
    ws['!rows'] = [
      { hpt: 24 },
      ...Array.from({ length: Math.max(aoa.length - 1, 1) }, () => ({ hpt: 17 })),
    ]
    const longTitleSet = new Set(displayHeaders.filter((h) => h.length >= 20))
    ws['!cols'] = getColWidths(displayHeaders, data.map((r) => {
      const o: Record<string, unknown> = {}
      headers.forEach((h, i) => { o[displayHeaders[i]!] = r[h] })
      return o
    }), undefined, longTitleSet)
    ws['!sheetViews'] = [{ showGridLines: false }]

    const sheetName = name.replace(/[\\/*?:[\]]/g, '').slice(0, 31)
    XLSX.utils.book_append_sheet(wb, ws, sheetName || 'Planilha')
  }

  XLSX.writeFile(wb, `trainhub-relatorio-${hoje}.xlsx`)
}

const instructionStyle = {
  fill: { fgColor: { rgb: 'F8FAFC' } },
  font: { name: 'Calibri', sz: 11, color: { rgb: COLORS.textDark } },
  alignment: { wrapText: true as const, vertical: 'top' as const },
}
const instructionTitleStyle = {
  fill: { fgColor: { rgb: 'F8FAFC' } },
  font: { name: 'Calibri', sz: 12, bold: true, color: { rgb: COLORS.textDark } },
  alignment: { vertical: 'top' as const },
}

/**
 * Gera e faz download do template de importação de usuários
 */
export function downloadUserImportTemplate(perfilNames: string[]): void {
  const wb = XLSX.utils.book_new()
  const headers = ['Nome Completo', 'E-mail', 'Perfil']
  const title = 'Importação de Usuários — TrainHub'

  const aoa: (string | number | XLSX.CellObject)[][] = [
    [cell(title, titleStyle)],
    headers.map((h) => cell(h, headerStyle)),
  ]
  for (let i = 0; i < 10; i++) {
    aoa.push(
      headers.map(() => cell('', dataRowStyle(i % 2 === 1)))
    )
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }]
  ws['!rows'] = [
    { hpt: 27 },
    { hpt: 24 },
    ...Array(10).fill({ hpt: 17 }),
  ]
  ws['!cols'] = [{ wch: 30 }, { wch: 35 }, { wch: 20 }]
  ws['!sheetViews'] = [{ showGridLines: false }]

  const instrucoes: string[][] = [
    ['Instruções para importação de usuários'],
    [''],
    ['• Perfil: deve ser exatamente um dos perfis cadastrados no tenant.'],
    ['  Perfis disponíveis: ' + (perfilNames.length ? perfilNames.join(', ') : '(nenhum cadastrado)')],
    [''],
    ['• E-mail: deve ser único no sistema. Não use e-mails já cadastrados.'],
    [''],
    ['• Não altere os cabeçalhos da planilha (Nome Completo, E-mail, Perfil).'],
    [''],
    ['• Após preencher, faça o upload na Etapa 2 do assistente.'],
  ]
  const wsInstrucoes = XLSX.utils.aoa_to_sheet(
    instrucoes.map((row, ri) =>
      row.map((val) => cell(val, ri === 0 ? instructionTitleStyle : instructionStyle))
    )
  )
  wsInstrucoes['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }]
  wsInstrucoes['!cols'] = [{ wch: 80 }]
  wsInstrucoes['!sheetViews'] = [{ showGridLines: false }]

  XLSX.utils.book_append_sheet(wb, ws, 'Usuários')
  XLSX.utils.book_append_sheet(wb, wsInstrucoes, 'Instruções')
  XLSX.writeFile(wb, 'template-importacao-usuarios.xlsx')
}
