'use client'

import * as React from 'react'
import { FileSpreadsheet, Download, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { parseExcelFile, downloadTemplate } from '@/lib/excel-utils'
import { toast } from 'sonner'

type ImportStep = 'upload' | 'preview' | 'errors'

interface ImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  templateHeaders: string[]
  templateFilename: string
  templateTitle?: string
  sampleRow?: Record<string, string>
  templateColWidths?: number[]
  columns: { key: string; label: string }[]
  onValidateAndImport: (
    rows: Record<string, unknown>[]
  ) => Promise<{ valid: boolean; errors: string[]; data?: Record<string, unknown>[] }>
  onConfirmImport: (data: Record<string, unknown>[]) => Promise<void>
  onSuccess: () => void
}

export function ImportDialog({
  open,
  onOpenChange,
  title,
  templateHeaders,
  templateFilename,
  templateTitle,
  sampleRow,
  templateColWidths,
  columns,
  onValidateAndImport,
  onConfirmImport,
  onSuccess,
}: ImportDialogProps) {
  const [step, setStep] = React.useState<ImportStep>('upload')
  const [file, setFile] = React.useState<File | null>(null)
  const [rows, setRows] = React.useState<Record<string, unknown>[]>([])
  const [errors, setErrors] = React.useState<string[]>([])
  const [validData, setValidData] = React.useState<Record<string, unknown>[] | null>(null)
  const [importing, setImporting] = React.useState(false)
  const [dragActive, setDragActive] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const handleClose = () => {
    onOpenChange(false)
    setStep('upload')
    setFile(null)
    setRows([])
    setErrors([])
    setValidData(null)
  }

  const handleDownloadTemplate = () => {
    downloadTemplate(templateHeaders, sampleRow, templateFilename, templateTitle, templateColWidths)
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
      const result = await onValidateAndImport(data)
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

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(true)
  }

  const handleDragLeave = () => {
    setDragActive(false)
  }

  const handleConfirmImport = async () => {
    if (!validData || validData.length === 0) return
    setImporting(true)
    try {
      await onConfirmImport(validData)
      onSuccess()
      handleClose()
    } catch (err) {
      console.error('Erro na importação:', err)
      toast.error('Não foi possível concluir a importação. Tente novamente.')
    } finally {
      setImporting(false)
    }
  }

  const getCellValue = (row: Record<string, unknown>, key: string) => {
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
            {title}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 max-h-[60vh] pr-4">
          <div className="space-y-4">
            {/* Step: Upload */}
            {step === 'upload' && (
              <>
                <Button variant="outline" onClick={handleDownloadTemplate} className="w-full gap-2">
                  <Download className="w-4 h-4" />
                  Baixar Template
                </Button>
                <div
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
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
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <Upload className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Arraste o arquivo Excel aqui ou clique para selecionar
                  </p>
                </div>
              </>
            )}

            {/* Step: Preview */}
            {step === 'preview' && validData && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  {validData.length} registro(s) prontos para importação
                </p>
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        {columns.map((col) => (
                          <TableHead key={col.key} className="font-medium">
                            {col.label}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {validData.slice(0, 20).map((row, idx) => (
                        <TableRow key={idx}>
                          {columns.map((col) => (
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

            {/* Step: Errors */}
            {step === 'errors' && errors.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-destructive">Erros de validação:</p>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground max-h-48 overflow-y-auto">
                  {errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
                <Button variant="outline" size="sm" onClick={() => setStep('upload')}>
                  Tentar outro arquivo
                </Button>
              </div>
            )}
          </div>
        </ScrollArea>

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
