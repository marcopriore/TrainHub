'use client'

import * as React from 'react'
import { FileSpreadsheet, Download, Upload, Building2, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { parseExcelFile, downloadTemplate, getExcelValue } from '@/lib/excel-utils'
import { toast } from 'sonner'

type ImportStep = 'upload' | 'preview' | 'errors'
type ImportType = 'parceiro' | 'colaborador'

interface EmpresaParceira {
  id: string
  nome: string
}

interface ColaboradorItem {
  id: string
  nome: string
}

interface TreinamentoImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  empresas: EmpresaParceira[]
  colaboradores: ColaboradorItem[]
  treinamentosExistentes: { nome: string; data_treinamento: string }[]
  onImportParceiro: (data: Record<string, unknown>[]) => Promise<void>
  onImportColaborador: (data: Record<string, unknown>[]) => Promise<void>
  onSuccess: () => void
}

const HEADER_ALIASES_PARCEIRO: Record<string, string[]> = {
  nome: ['Nome do Treinamento', 'nome', 'Nome'],
  conteudo: ['Conteúdo Programático', 'conteudo'],
  objetivo: ['Objetivo', 'objetivo'],
  carga_horaria: ['Carga Horária (horas)', 'carga_horaria'],
  empresa_parceira: ['Empresa Parceira', 'empresa_parceira'],
  quantidade_pessoas: ['Quantidade de Pessoas', 'quantidade_pessoas'],
  data_treinamento: ['Data do Treinamento (DD/MM/AAAA)', 'data_treinamento'],
  indice_satisfacao: ['Índice de Satisfação (%)', 'indice_satisfacao'],
  indice_aprovacao: ['Índice de Aprovação (%)', 'indice_aprovacao'],
}
const HEADER_ALIASES_COLABORADOR: Record<string, string[]> = {
  ...HEADER_ALIASES_PARCEIRO,
  colaboradores: ['Colaboradores (separados por ;)', 'colaboradores'],
}
delete (HEADER_ALIASES_COLABORADOR as Record<string, unknown>).quantidade_pessoas

function parseDateDDMMYYYY(str: string): Date | null {
  const match = String(str || '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!match) return null
  const [, d, m, y] = match
  const day = parseInt(d!, 10)
  const month = parseInt(m!, 10) - 1
  const year = parseInt(y!, 10)
  const date = new Date(year, month, day)
  if (isNaN(date.getTime())) return null
  if (date.getDate() !== day || date.getMonth() !== month || date.getFullYear() !== year) return null
  return date
}

function formatDateForDB(date: Date): string {
  return date.toISOString().split('T')[0]!
}

export function TreinamentoImportDialog({
  open,
  onOpenChange,
  empresas,
  colaboradores,
  treinamentosExistentes,
  onImportParceiro,
  onImportColaborador,
  onSuccess,
}: TreinamentoImportDialogProps) {
  const [importType, setImportType] = React.useState<ImportType>('parceiro')
  const [step, setStep] = React.useState<ImportStep>('upload')
  const [file, setFile] = React.useState<File | null>(null)
  const [rows, setRows] = React.useState<Record<string, unknown>[]>([])
  const [errors, setErrors] = React.useState<string[]>([])
  const [validData, setValidData] = React.useState<Record<string, unknown>[] | null>(null)
  const [importing, setImporting] = React.useState(false)
  const [dragActive, setDragActive] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const empresasMap = React.useMemo(
    () => new Map(empresas.map((e) => [e.nome.toLowerCase(), e])),
    [empresas]
  )
  const colaboradoresMap = React.useMemo(
    () => new Map(colaboradores.map((c) => [c.nome.toLowerCase(), c])),
    [colaboradores]
  )
  const existentesSet = React.useMemo(
    () =>
      new Set(
        treinamentosExistentes.map((t) => `${t.nome.toLowerCase()}|${t.data_treinamento}`)
      ),
    [treinamentosExistentes]
  )

  const handleClose = () => {
    onOpenChange(false)
    setStep('upload')
    setFile(null)
    setRows([])
    setErrors([])
    setValidData(null)
  }

  const handleTypeChange = (t: ImportType) => {
    setImportType(t)
    setStep('upload')
    setFile(null)
    setRows([])
    setErrors([])
    setValidData(null)
  }

  const handleDownloadTemplate = () => {
    if (importType === 'parceiro') {
      const headers = [
        'Nome do Treinamento',
        'Conteúdo Programático',
        'Objetivo',
        'Carga Horária (horas)',
        'Empresa Parceira',
        'Quantidade de Pessoas',
        'Data do Treinamento (DD/MM/AAAA)',
        'Índice de Satisfação (%)',
        'Índice de Aprovação (%)',
      ]
      downloadTemplate(
        headers,
        {
          'Nome do Treinamento': 'Gestão de Projetos',
          'Conteúdo Programático': 'Módulos 1 a 5',
          'Objetivo': 'Capacitar equipe',
          'Carga Horária (horas)': '8',
          'Empresa Parceira': 'Empresa ABC',
          'Quantidade de Pessoas': '25',
          'Data do Treinamento (DD/MM/AAAA)': '15/03/2025',
          'Índice de Satisfação (%)': '90',
          'Índice de Aprovação (%)': '95',
        },
        'template_treinamentos_parceiro.xlsx',
        'TrainHub — Template de Importação: Treinamentos Parceiro',
        [25, 40, 40, 25, 25, 25, 28, 22, 22]
      )
    } else {
      const headers = [
        'Nome do Treinamento',
        'Conteúdo Programático',
        'Objetivo',
        'Carga Horária (horas)',
        'Empresa Parceira',
        'Data do Treinamento (DD/MM/AAAA)',
        'Índice de Satisfação (%)',
        'Índice de Aprovação (%)',
        'Colaboradores (separados por ;)',
      ]
      downloadTemplate(
        headers,
        {
          'Nome do Treinamento': 'Treinamento Interno',
          'Conteúdo Programático': 'Conteúdo do treinamento',
          'Objetivo': 'Objetivo',
          'Carga Horária (horas)': '4',
          'Empresa Parceira': 'Empresa XYZ',
          'Data do Treinamento (DD/MM/AAAA)': '20/03/2025',
          'Índice de Satisfação (%)': '85',
          'Índice de Aprovação (%)': '90',
          'Colaboradores (separados por ;)': 'João Silva;Maria Santos',
        },
        'template_treinamentos_colaborador.xlsx',
        'TrainHub — Template de Importação: Treinamentos Colaborador',
        [25, 40, 40, 25, 25, 28, 22, 22, 40]
      )
    }
  }

  const headerAliases = importType === 'parceiro' ? HEADER_ALIASES_PARCEIRO : HEADER_ALIASES_COLABORADOR

  const validateAndProcess = (dataRows: Record<string, unknown>[]) => {
    const errs: string[] = []

    if (importType === 'parceiro') {
      const data: Record<string, unknown>[] = []
      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i]!
        const linha = i + 2
        const nome = String(getExcelValue(row, 'nome', headerAliases) ?? '').trim()
        const conteudo = String(getExcelValue(row, 'conteudo', headerAliases) ?? '').trim()
        const objetivo = String(getExcelValue(row, 'objetivo', headerAliases) ?? '').trim()
        const cargaHoraria = Number(getExcelValue(row, 'carga_horaria', headerAliases))
        const empresaNome = String(getExcelValue(row, 'empresa_parceira', headerAliases) ?? '').trim()
        const quantidadePessoas = Number(getExcelValue(row, 'quantidade_pessoas', headerAliases))
        const dataStr = String(getExcelValue(row, 'data_treinamento', headerAliases) ?? '').trim()
        const indiceSatisfacao = Number(getExcelValue(row, 'indice_satisfacao', headerAliases))
        const indiceAprovacao = Number(getExcelValue(row, 'indice_aprovacao', headerAliases))

        if (!nome) {
          errs.push(`Linha ${linha}: Campo 'nome' obrigatório`)
          continue
        }
        const empresa = empresasMap.get(empresaNome.toLowerCase())
        if (!empresa) {
          errs.push(`Linha ${linha}: Empresa parceira "${empresaNome}" não encontrada`)
          continue
        }
        if (isNaN(cargaHoraria) || cargaHoraria <= 0) {
          errs.push(`Linha ${linha}: Campo 'carga_horaria' deve ser maior que 0`)
          continue
        }
        if (isNaN(quantidadePessoas) || quantidadePessoas < 1) {
          errs.push(`Linha ${linha}: Campo 'quantidade_pessoas' deve ser >= 1`)
          continue
        }
        const dataObj = parseDateDDMMYYYY(dataStr)
        if (!dataObj) {
          errs.push(`Linha ${linha}: Campo 'data_treinamento' deve estar no formato DD/MM/AAAA`)
          continue
        }
        const dataFormatted = formatDateForDB(dataObj)
        if (
          isNaN(indiceSatisfacao) ||
          indiceSatisfacao < 0 ||
          indiceSatisfacao > 100
        ) {
          errs.push(`Linha ${linha}: 'indice_satisfacao' deve ser entre 0 e 100`)
          continue
        }
        if (
          isNaN(indiceAprovacao) ||
          indiceAprovacao < 0 ||
          indiceAprovacao > 100
        ) {
          errs.push(`Linha ${linha}: 'indice_aprovacao' deve ser entre 0 e 100`)
          continue
        }
        const dupKey = `${nome.toLowerCase()}|${dataFormatted}`
        if (existentesSet.has(dupKey)) {
          errs.push(`Linha ${linha}: Treinamento "${nome}" na data ${dataStr} já existe`)
          continue
        }
        existentesSet.add(dupKey)
        data.push({
          tipo: 'parceiro',
          nome,
          conteudo,
          objetivo,
          carga_horaria: cargaHoraria,
          empresa_parceira_id: empresa.id,
          quantidade_pessoas: quantidadePessoas,
          data_treinamento: dataFormatted,
          indice_satisfacao: indiceSatisfacao,
          indice_aprovacao: indiceAprovacao,
        })
      }
      if (errs.length > 0) return { valid: false, errors: errs }
      return { valid: true, errors: [], data }
    } else {
      const data: Record<string, unknown>[] = []
      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i]!
        const linha = i + 2
        const nome = String(getExcelValue(row, 'nome', headerAliases) ?? '').trim()
        const conteudo = String(getExcelValue(row, 'conteudo', headerAliases) ?? '').trim()
        const objetivo = String(getExcelValue(row, 'objetivo', headerAliases) ?? '').trim()
        const cargaHoraria = Number(getExcelValue(row, 'carga_horaria', headerAliases))
        const empresaNome = String(getExcelValue(row, 'empresa_parceira', headerAliases) ?? '').trim()
        const dataStr = String(getExcelValue(row, 'data_treinamento', headerAliases) ?? '').trim()
        const indiceSatisfacao = Number(getExcelValue(row, 'indice_satisfacao', headerAliases))
        const indiceAprovacao = Number(getExcelValue(row, 'indice_aprovacao', headerAliases))
        const colaboradoresStr = String(getExcelValue(row, 'colaboradores', headerAliases) ?? '').trim()

        if (!nome) {
          errs.push(`Linha ${linha}: Campo 'nome' obrigatório`)
          continue
        }
        const empresa = empresasMap.get(empresaNome.toLowerCase())
        if (!empresa) {
          errs.push(`Linha ${linha}: Empresa parceira "${empresaNome}" não encontrada`)
          continue
        }
        if (isNaN(cargaHoraria) || cargaHoraria <= 0) {
          errs.push(`Linha ${linha}: Campo 'carga_horaria' deve ser maior que 0`)
          continue
        }
        const dataObj = parseDateDDMMYYYY(dataStr)
        if (!dataObj) {
          errs.push(`Linha ${linha}: Campo 'data_treinamento' deve estar no formato DD/MM/AAAA`)
          continue
        }
        const dataFormatted = formatDateForDB(dataObj)
        if (
          isNaN(indiceSatisfacao) ||
          indiceSatisfacao < 0 ||
          indiceSatisfacao > 100
        ) {
          errs.push(`Linha ${linha}: 'indice_satisfacao' deve ser entre 0 e 100`)
          continue
        }
        if (
          isNaN(indiceAprovacao) ||
          indiceAprovacao < 0 ||
          indiceAprovacao > 100
        ) {
          errs.push(`Linha ${linha}: 'indice_aprovacao' deve ser entre 0 e 100`)
          continue
        }
        if (!colaboradoresStr) {
          errs.push(`Linha ${linha}: Campo 'colaboradores' obrigatório`)
          continue
        }
        const nomesColab = colaboradoresStr
          .split(';')
          .map((n) => n.trim())
          .filter(Boolean)
        const nomesUnicos = new Set(nomesColab.map((n) => n.toLowerCase()))
        if (nomesUnicos.size !== nomesColab.length) {
          errs.push(`Linha ${linha}: colaboradores com nomes duplicados na mesma linha`)
          continue
        }
        const colabIds: string[] = []
        for (const n of nomesColab) {
          const col = colaboradoresMap.get(n.toLowerCase())
          if (!col) {
            errs.push(`Linha ${linha}: Colaborador "${n}" não encontrado`)
            break
          }
          colabIds.push(col.id)
        }
        if (errs.length > 0 && errs[errs.length - 1]?.includes(`Linha ${linha}`)) continue
        if (colabIds.length === 0) {
          errs.push(`Linha ${linha}: Informe ao menos um colaborador válido`)
          continue
        }
        const dupKey = `${nome.toLowerCase()}|${dataFormatted}`
        if (existentesSet.has(dupKey)) {
          errs.push(`Linha ${linha}: Treinamento "${nome}" na data ${dataStr} já existe`)
          continue
        }
        existentesSet.add(dupKey)
        data.push({
          tipo: 'colaborador',
          nome,
          conteudo,
          objetivo,
          carga_horaria: cargaHoraria,
          empresa_parceira_id: empresa.id,
          data_treinamento: dataFormatted,
          indice_satisfacao: indiceSatisfacao,
          indice_aprovacao: indiceAprovacao,
          colaborador_ids: colabIds,
          colaboradores: colaboradoresStr,
        })
      }
      if (errs.length > 0) return { valid: false, errors: errs }
      return { valid: true, errors: [], data }
    }
  }

  const processFile = async (f: File) => {
    if (!f.name.match(/\.(xlsx|xls)$/i)) {
      setErrors(['Formato inválido. Use arquivo .xlsx ou .xls'])
      setStep('errors')
      return
    }
    setErrors([])
    try {
      const data = await parseExcelFile(f)
      if (data.length === 0) {
        setErrors(['O arquivo está vazio ou não possui dados válidos.'])
        setStep('errors')
        return
      }
      setRows(data)
      const result = validateAndProcess(data)
      if (result.valid && result.data) {
        setValidData(result.data)
        setStep('preview')
      } else {
        setErrors(result.errors)
        setStep('errors')
      }
    } catch (err) {
      console.error('Erro ao processar arquivo:', err)
      setErrors(['Erro ao ler o arquivo. Verifique se é um Excel válido.'])
      setStep('errors')
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) {
      setFile(f)
      processFile(f)
    }
    e.target.value = ''
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
    const f = e.dataTransfer.files?.[0]
    if (f) {
      setFile(f)
      processFile(f)
    }
  }

  const handleConfirmImport = async () => {
    if (!validData || validData.length === 0) return
    setImporting(true)
    try {
      if (importType === 'parceiro') {
        await onImportParceiro(validData)
      } else {
        await onImportColaborador(validData)
      }
      onSuccess()
      handleClose()
    } catch (err) {
      console.error('Erro na importação:', err)
      toast.error('Não foi possível importar os treinamentos. Tente novamente.')
    } finally {
      setImporting(false)
    }
  }

  const previewColumns =
    importType === 'parceiro'
      ? [
          { key: 'nome', label: 'Nome' },
          { key: 'empresa_parceira_id', label: 'Empresa' },
          { key: 'quantidade_pessoas', label: 'Qtd Pessoas' },
          { key: 'data_treinamento', label: 'Data' },
        ]
      : [
          { key: 'nome', label: 'Nome' },
          { key: 'empresa_parceira_id', label: 'Empresa' },
          { key: 'colaboradores', label: 'Colaboradores' },
          { key: 'data_treinamento', label: 'Data' },
        ]

  const getCellValue = (row: Record<string, unknown>, key: string): string => {
    if (key === 'empresa_parceira_id') {
      const id = row[key]
      const emp = empresas.find((e) => e.id === id)
      return emp?.nome ?? String(id ?? '—')
    }
    const val = row[key]
    if (val == null) return '—'
    return String(val)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            Importar Treinamentos
          </DialogTitle>
        </DialogHeader>

        <Tabs value={importType} onValueChange={(v) => handleTypeChange(v as ImportType)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="parceiro" className="gap-2">
              <Building2 className="w-4 h-4" />
              Parceiro
            </TabsTrigger>
            <TabsTrigger value="colaborador" className="gap-2">
              <Users className="w-4 h-4" />
              Colaborador
            </TabsTrigger>
          </TabsList>

          <TabsContent value="parceiro" className="mt-4">
            <ImportContent
              step={step}
              dragActive={dragActive}
              fileInputRef={fileInputRef}
              onFileChange={handleFileChange}
              onDrop={handleDrop}
              onDragOver={(e) => {
                e.preventDefault()
                setDragActive(true)
              }}
              onDragLeave={() => setDragActive(false)}
              onDownloadTemplate={handleDownloadTemplate}
              errors={errors}
              validData={validData}
              previewColumns={previewColumns}
              getCellValue={getCellValue}
              onBack={() => setStep('upload')}
            />
          </TabsContent>
          <TabsContent value="colaborador" className="mt-4">
            <ImportContent
              step={step}
              dragActive={dragActive}
              fileInputRef={fileInputRef}
              onFileChange={handleFileChange}
              onDrop={handleDrop}
              onDragOver={(e) => {
                e.preventDefault()
                setDragActive(true)
              }}
              onDragLeave={() => setDragActive(false)}
              onDownloadTemplate={handleDownloadTemplate}
              errors={errors}
              validData={validData}
              previewColumns={previewColumns}
              getCellValue={getCellValue}
              onBack={() => setStep('upload')}
            />
          </TabsContent>
        </Tabs>

        <DialogFooter>
          {step === 'upload' && (
            <Button variant="outline" onClick={handleClose}>
              Fechar
            </Button>
          )}
          {step === 'preview' && (
            <>
              <Button variant="outline" onClick={() => setStep('upload')}>
                Voltar
              </Button>
              <Button onClick={handleConfirmImport} disabled={importing}>
                {importing ? 'Importando...' : 'Confirmar Importação'}
              </Button>
            </>
          )}
          {step === 'errors' && (
            <Button variant="outline" onClick={handleClose}>
              Fechar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ImportContent({
  step,
  dragActive,
  fileInputRef,
  onFileChange,
  onDrop,
  onDragOver,
  onDragLeave,
  onDownloadTemplate,
  errors,
  validData,
  previewColumns,
  getCellValue,
  onBack,
}: {
  step: ImportStep
  dragActive: boolean
  fileInputRef: React.RefObject<HTMLInputElement | null>
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onDrop: (e: React.DragEvent) => void
  onDragOver: (e: React.DragEvent) => void
  onDragLeave: () => void
  onDownloadTemplate: () => void
  errors: string[]
  validData: Record<string, unknown>[] | null
  previewColumns: { key: string; label: string }[]
  getCellValue: (row: Record<string, unknown>, key: string) => string
  onBack: () => void
}) {
  return (
    <ScrollArea className="flex-1 max-h-[45vh] pr-4">
      <div className="space-y-4">
        {step === 'upload' && (
          <>
            <Button variant="outline" onClick={onDownloadTemplate} className="w-full gap-2">
              <Download className="w-4 h-4" />
              Baixar Template
            </Button>
            <div
              onDrop={onDrop}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
                dragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={onFileChange}
                className="hidden"
              />
              <Upload className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                Arraste o arquivo Excel aqui ou clique para selecionar
              </p>
            </div>
          </>
        )}

        {step === 'preview' && validData && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {validData.length} registro(s) prontos para importação
            </p>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    {previewColumns.map((col) => (
                      <TableHead key={col.key} className="font-medium">
                        {col.label}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {validData.slice(0, 20).map((row, idx) => (
                    <TableRow key={idx}>
                      {previewColumns.map((col) => (
                        <TableCell key={col.key} className="text-sm">
                          {getCellValue(row, col.key)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {validData.length > 20 && (
              <p className="text-xs text-muted-foreground">
                Mostrando os 20 primeiros de {validData.length} registros
              </p>
            )}
          </div>
        )}

        {step === 'errors' && errors.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-destructive">Erros de validação:</p>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground max-h-48 overflow-y-auto">
              {errors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
            <Button variant="outline" size="sm" onClick={onBack}>
              Tentar outro arquivo
            </Button>
          </div>
        )}
      </div>
    </ScrollArea>
  )
}
