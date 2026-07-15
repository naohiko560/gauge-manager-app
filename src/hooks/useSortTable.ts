import { useState } from 'react'

export type SortDir = 'asc' | 'desc'

export function useSortTable(defaultKey: string, defaultDir: SortDir = 'asc') {
  const [sortKey, setSortKey] = useState(defaultKey)
  const [sortDir, setSortDir] = useState<SortDir>(defaultDir)

  function handleSort(key: string) {
    if (key === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }

  return { sortKey, sortDir, handleSort }
}

export function sortRows<T>(
  data: T[],
  key: string,
  dir: SortDir,
  getValue: (item: T, key: string) => string | number | null | undefined = (item, k) =>
    (item as any)[k],
): T[] {
  return [...data].sort((a, b) => {
    const av = getValue(a, key)
    const bv = getValue(b, key)
    let cmp = 0
    if (av == null && bv == null) cmp = 0
    else if (av == null) cmp = 1
    else if (bv == null) cmp = -1
    else if (typeof av === 'number' && typeof bv === 'number') cmp = av - bv
    else cmp = String(av).localeCompare(String(bv), 'ja')
    return dir === 'asc' ? cmp : -cmp
  })
}
