"use client"

import { CircleCheck, Download, TriangleAlert } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"

import { FormError } from "@/components/shared/form-error"
import { ListActionsMenu } from "@/components/shared/list-actions-menu"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"
import { Spinner } from "@/components/ui/spinner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { ListConfig } from "@/constants/list"
import { toCsv } from "@/lib/csv"
import type { CsvImportResult, CsvReadResult, ImportProblem } from "@/lib/csv-import"
import { cn } from "@/lib/utils"
import type { ActionResult } from "@/types/actions"

const MAX_FILE_BYTES = 10 * 1024 * 1024
// Problems listed in the dialog; the full list is in the downloadable report.
const PROBLEMS_SHOWN = 50

const numberFormat = new Intl.NumberFormat("en-IN")

type Totals = Omit<CsvImportResult, "failed"> & { failed: ImportProblem[] }

export type CsvImportState =
  | { stage: "idle" }
  | { stage: "reading"; fileName: string }
  | { stage: "importing"; fileName: string; done: number; total: number }
  | {
      stage: "done"
      fileName: string
      totals: Totals
      // Rows of the file that couldn't be imported (read problems and server failures).
      problems: ImportProblem[]
      error?: string
    }

// How one list imports: reads the file in the browser, then sends rows in batches.
export type CsvImporter<Row> = {
  // "items", "customers": used in messages.
  entityPlural: string
  // The name column in the report of rows not imported, e.g. "Item Name".
  nameColumn: string
  read: (content: string) => CsvReadResult<Row>
  importBatch: (rows: Row[]) => Promise<ActionResult<CsvImportResult>>
  batchSize: number
  // Shown when every row went in, e.g. what the file has that isn't imported.
  note?: string
}

// Runs an import right after a file is picked. Rows matching an existing record are
// skipped by the server, so importing a file again never changes existing records.
export function useCsvImport<Row>(importer: CsvImporter<Row>) {
  const router = useRouter()
  const [state, setState] = useState<CsvImportState>({ stage: "idle" })

  // Leaving the page would stop an import halfway.
  useEffect(() => {
    if (state.stage !== "importing") return
    function warn(event: BeforeUnloadEvent) {
      event.preventDefault()
    }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [state.stage])

  async function run(file: File) {
    const fileName = file.name
    const totals: Totals = { created: 0, updated: 0, skipped: 0, failed: [] }
    const fail = (error: string, problems: ImportProblem[] = []) =>
      setState({ stage: "done", fileName, totals, problems, error })

    if (!/\.csv$/i.test(fileName)) {
      return fail("Choose a .csv file. In Excel, use File → Save As → CSV UTF-8.")
    }
    if (file.size > MAX_FILE_BYTES) {
      return fail("The file is larger than 10 MB. Split it into smaller files.")
    }

    setState({ stage: "reading", fileName })
    let read: CsvReadResult<Row>
    try {
      read = importer.read(await file.text())
    } catch {
      return fail("The file couldn't be read. Make sure it is a CSV file.")
    }
    if (read.missingColumns.length) {
      return fail(
        `The file needs a column named ${read.missingColumns.map((column) => `“${column}”`).join(", ")}.`
      )
    }
    if (read.rows.length === 0) {
      return fail(
        read.totalRows === 0
          ? `The file has no ${importer.entityPlural} in it.`
          : "None of the rows could be imported.",
        read.problems
      )
    }

    const rows = read.rows
    setState({ stage: "importing", fileName, done: 0, total: rows.length })
    for (let start = 0; start < rows.length; start += importer.batchSize) {
      const batch = rows.slice(start, start + importer.batchSize)
      let error: string | undefined
      try {
        const result = await importer.importBatch(batch)
        if (result.success) {
          totals.created += result.data.created
          totals.updated += result.data.updated
          totals.skipped += result.data.skipped
          totals.failed.push(...result.data.failed)
        } else {
          error = result.error
        }
      } catch {
        error = "The connection was lost."
      }
      if (error) {
        // Earlier batches are saved, later ones are not.
        router.refresh()
        return fail(
          `${error} The import stopped after ${numberFormat.format(start)} of ${numberFormat.format(rows.length)} rows; the rest weren't imported.`,
          [...read.problems, ...totals.failed]
        )
      }
      setState({ stage: "importing", fileName, done: start + batch.length, total: rows.length })
    }

    setState({
      stage: "done",
      fileName,
      totals,
      problems: [...read.problems, ...totals.failed].sort((a, b) => a.row - b.row),
    })
    router.refresh()
  }

  return { state, run, reset: () => setState({ stage: "idle" }) }
}

// A list's "⋯" menu with Import (opens the file picker straight away and imports on this
// page) and Export (downloads a CSV from exportHref).
export function CsvListActionsMenu<Row>({
  entityLabel,
  config,
  canImport,
  exportHref,
  importer,
}: {
  entityLabel: string
  config: ListConfig
  canImport: boolean
  exportHref: string
  importer: CsvImporter<Row>
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const { state, run, reset } = useCsvImport(importer)

  return (
    <>
      <ListActionsMenu
        entityLabel={entityLabel}
        config={config}
        onImport={canImport ? () => inputRef.current?.click() : undefined}
        exportHref={exportHref}
      />
      {canImport && (
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          aria-label={`Choose a CSV file of ${importer.entityPlural} to import`}
          className="sr-only"
          tabIndex={-1}
          onChange={(event) => {
            const file = event.target.files?.[0]
            // Cleared so picking the same file again still triggers an import.
            event.target.value = ""
            if (file) void run(file)
          }}
        />
      )}
      <CsvImportDialog state={state} onClose={reset} importer={importer} />
    </>
  )
}

// Progress and results of an import. Can't be closed while rows are being sent.
function CsvImportDialog<Row>({
  state,
  onClose,
  importer,
}: {
  state: CsvImportState
  onClose: () => void
  importer: CsvImporter<Row>
}) {
  const isBusy = state.stage === "reading" || state.stage === "importing"

  return (
    <Dialog open={state.stage !== "idle"} onOpenChange={(open) => !open && !isBusy && onClose()}>
      <DialogContent className="sm:max-w-2xl" showCloseButton={!isBusy}>
        <DialogHeader>
          <DialogTitle>
            {isBusy
              ? `Importing ${importer.entityPlural}`
              : state.stage === "done" && state.error
                ? "Import stopped"
                : "Import finished"}
          </DialogTitle>
          {state.stage !== "idle" && <DialogDescription>{state.fileName}</DialogDescription>}
        </DialogHeader>

        {state.stage === "reading" && (
          <div className="flex items-center gap-3 py-4 text-sm">
            <Spinner />
            Reading the file…
          </div>
        )}

        {state.stage === "importing" && (
          <div className="flex flex-col gap-3 py-2">
            <Progress
              value={Math.round((state.done / state.total) * 100)}
              aria-label="Import progress"
            />
            <p className="text-sm text-muted-foreground">
              {numberFormat.format(state.done)} of {numberFormat.format(state.total)}{" "}
              {importer.entityPlural} done ({Math.round((state.done / state.total) * 100)}%).
              Keep this page open until the import finishes.
            </p>
          </div>
        )}

        {state.stage === "done" && (
          <div className="flex min-w-0 flex-col gap-4">
            <FormError message={state.error} />
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Added" value={state.totals.created} />
              <Stat label="Updated" value={state.totals.updated} />
              <Stat label="Already there (skipped)" value={state.totals.skipped} />
              <Stat
                label="Not imported"
                value={state.problems.length}
                tone={state.problems.length ? "warning" : undefined}
              />
            </dl>
            {state.problems.length > 0 ? (
              <ProblemsTable problems={state.problems} nameColumn={importer.nameColumn} />
            ) : (
              !state.error && (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CircleCheck className="size-4 text-emerald-600" />
                  No rows had problems.{importer.note ? ` ${importer.note}` : ""}
                </p>
              )
            )}
          </div>
        )}

        {state.stage === "done" && (
          <DialogFooter>
            <Button onClick={onClose}>Done</Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "warning" }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={cn("text-xl font-semibold tabular-nums", tone === "warning" && "text-amber-700")}
      >
        {numberFormat.format(value)}
      </dd>
    </div>
  )
}

function downloadReport(problems: ImportProblem[], nameColumn: string) {
  const csv = toCsv([
    ["Row", nameColumn, "Problem"],
    ...problems.map((problem) => [problem.row, problem.name, problem.message]),
  ])
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }))
  const link = document.createElement("a")
  link.href = url
  link.download = "import-problems.csv"
  link.click()
  URL.revokeObjectURL(url)
}

function ProblemsTable({ problems, nameColumn }: { problems: ImportProblem[]; nameColumn: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-medium">
          <TriangleAlert className="size-4 text-amber-600" />
          Rows not imported
        </h3>
        <Button variant="outline" size="sm" onClick={() => downloadReport(problems, nameColumn)}>
          <Download />
          Download list
        </Button>
      </div>
      <div className="max-h-64 overflow-auto rounded-lg border">
        <Table>
          <TableHeader className="sticky top-0 bg-muted">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-16 px-3 text-xs uppercase">Row</TableHead>
              <TableHead className="px-3 text-xs uppercase">{nameColumn}</TableHead>
              <TableHead className="px-3 text-xs uppercase">Problem</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {problems.slice(0, PROBLEMS_SHOWN).map((problem) => (
              <TableRow key={`${problem.row}-${problem.message}`}>
                <TableCell className="px-3 tabular-nums">{problem.row}</TableCell>
                <TableCell className="max-w-48 truncate px-3">{problem.name || "—"}</TableCell>
                <TableCell className="px-3 whitespace-normal">{problem.message}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {problems.length > PROBLEMS_SHOWN && (
        <p className="text-xs text-muted-foreground">
          Showing the first {PROBLEMS_SHOWN} of {numberFormat.format(problems.length)}. Download
          the list to see them all.
        </p>
      )}
    </div>
  )
}
