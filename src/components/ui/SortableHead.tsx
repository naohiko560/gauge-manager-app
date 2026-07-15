'use client'

import { TableHead } from '@/components/ui/table'
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SortDir } from '@/hooks/useSortTable'

interface Props {
  sortKey: string
  currentKey: string
  currentDir: SortDir
  onSort: (key: string) => void
  className?: string
  children: React.ReactNode
}

export function SortableHead({ sortKey, currentKey, currentDir, onSort, className, children }: Props) {
  const active = sortKey === currentKey
  return (
    <TableHead
      className={cn('cursor-pointer select-none', className)}
      onClick={() => onSort(sortKey)}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {active ? (
          currentDir === 'asc'
            ? <ChevronUp className="w-3.5 h-3.5 shrink-0" />
            : <ChevronDown className="w-3.5 h-3.5 shrink-0" />
        ) : (
          <ChevronsUpDown className="w-3.5 h-3.5 shrink-0 opacity-30" />
        )}
      </span>
    </TableHead>
  )
}
