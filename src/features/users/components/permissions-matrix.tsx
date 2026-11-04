"use client"

import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  APP_MODULES,
  MODULE_ACTIONS,
  MODULE_LABELS,
  PERMISSION_ACTIONS,
  PERMISSION_ACTION_LABELS,
  type AppModule,
  type PermissionAction,
} from "@/constants/permissions"
import type { ModulePermissions } from "@/lib/permissions"

type PermissionsMatrixProps = {
  value: ModulePermissions
  onChange: (value: ModulePermissions) => void
}

export function PermissionsMatrix({ value, onChange }: PermissionsMatrixProps) {
  // Create, edit and delete need view; removing view removes everything else.
  function toggle(module: AppModule, action: PermissionAction, checked: boolean) {
    const next =
      action === "view" && !checked
        ? { view: false, create: false, edit: false, delete: false }
        : { ...value[module], [action]: checked, view: value[module].view || checked }
    onChange({ ...value, [module]: next })
  }

  return (
    <div className="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead className="px-4 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Module
            </TableHead>
            {PERMISSION_ACTIONS.map((action) => (
              <TableHead
                key={action}
                className="w-20 text-center text-xs font-medium tracking-wide text-muted-foreground uppercase"
              >
                {PERMISSION_ACTION_LABELS[action]}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {/* Inventory is switched off for now, so its row is hidden; remove the filter
              to show it again. */}
          {APP_MODULES.filter((module) => module !== "inventory_adjustments").map((module) => (
            <TableRow key={module}>
              <TableCell className="px-4 font-medium">{MODULE_LABELS[module]}</TableCell>
              {PERMISSION_ACTIONS.map((action) => (
                <TableCell key={action} className="text-center">
                  {MODULE_ACTIONS[module].includes(action) ? (
                    <Checkbox
                      checked={value[module][action]}
                      onCheckedChange={(checked) =>
                        toggle(module, action, checked === true)
                      }
                      aria-label={`${PERMISSION_ACTION_LABELS[action]} ${MODULE_LABELS[module]}`}
                      className="align-middle"
                    />
                  ) : (
                    <span className="text-muted-foreground" aria-hidden="true">
                      —
                    </span>
                  )}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
