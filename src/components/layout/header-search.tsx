"use client"

import { Search, X } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useId, useRef, useState } from "react"

import { searchRecords } from "@/actions/search"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import { Kbd } from "@/components/ui/kbd"
import { Spinner } from "@/components/ui/spinner"
import { LIST_SEARCH_PARAMS } from "@/constants/list"
import { NAV_ITEMS, type NavItem } from "@/constants/navigation"
import { useUpdateSearchParams } from "@/hooks/use-list-query"
import { cn } from "@/lib/utils"
import type { SearchResult } from "@/types/search"

const SUGGEST_DEBOUNCE_MS = 250

type InputRef = React.RefObject<HTMLInputElement | null>
type ModuleWithSearch = NavItem & { search: NonNullable<NavItem["search"]> }

// Searches the module you are in, like Zoho: typing suggests matching records (click one
// to open it), and Enter shows the module's list filtered by the search (`?q=`).
// Pages outside a module (dashboard, reports) have no search. Press "/" to focus it.
export function HeaderSearch() {
  const pathname = usePathname()
  const inputRef = useRef<HTMLInputElement>(null)
  const currentModule = NAV_ITEMS.find(
    (item): item is ModuleWithSearch =>
      Boolean(item.search) &&
      (pathname === item.href || pathname.startsWith(`${item.href}/`))
  )

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return
      const target = event.target
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
      ) {
        return
      }
      event.preventDefault()
      inputRef.current?.focus()
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [])

  if (!currentModule) return null

  return (
    <div className="w-full max-w-md">
      <ModuleSearch
        key={pathname}
        inputRef={inputRef}
        module={currentModule}
        isListPage={pathname === currentModule.href}
      />
    </div>
  )
}

type Suggestions = { term: string; results: SearchResult[]; failed: boolean }

function ModuleSearch({
  inputRef,
  module: { href: listHref, title, search },
  isListPage,
}: {
  inputRef: InputRef
  module: ModuleWithSearch
  isListPage: boolean
}) {
  const router = useRouter()
  const listboxId = useId()
  const { searchParams, update, isPending } = useUpdateSearchParams()
  // On the list page the box shows the search the list is filtered by.
  const q = isListPage ? (searchParams.get(LIST_SEARCH_PARAMS.search) ?? "") : ""
  const [value, setValue] = useState(q)
  const [syncedQ, setSyncedQ] = useState(q)
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [suggestions, setSuggestions] = useState<Suggestions | null>(null)

  // The list's search changed elsewhere (a sidebar link, the back button): show it.
  if (q !== syncedQ) {
    setSyncedQ(q)
    setValue(q)
  }

  const term = value.trim()
  const entity = title.toLowerCase()
  const isCurrent = suggestions?.term === term
  const results = isCurrent ? suggestions.results : []
  const isSearching = Boolean(term) && !isCurrent
  // The last option, after the records: "Search all … for '…'".
  const searchAllIndex = results.length

  useEffect(() => {
    if (!isOpen || !term) return
    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        const found = await searchRecords(search.scope, term)
        if (!cancelled) setSuggestions({ term, results: found, failed: false })
      } catch {
        if (!cancelled) setSuggestions({ term, results: [], failed: true })
      }
    }, SUGGEST_DEBOUNCE_MS)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [isOpen, term, search.scope])

  function close() {
    setIsOpen(false)
    setActiveIndex(-1)
  }

  function openResult(result: SearchResult) {
    close()
    router.push(result.href)
  }

  function searchAll() {
    close()
    if (isListPage) {
      update({ [LIST_SEARCH_PARAMS.search]: term || null, [LIST_SEARCH_PARAMS.page]: null })
      return
    }
    const params = new URLSearchParams({ [LIST_SEARCH_PARAMS.search]: term })
    router.push(term ? `${listHref}?${params}` : listHref)
  }

  function clear() {
    setValue("")
    close()
    if (isListPage && q) {
      update({ [LIST_SEARCH_PARAMS.search]: null, [LIST_SEARCH_PARAMS.page]: null })
    }
    inputRef.current?.focus()
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    const optionCount = term ? results.length + 1 : 0

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault()
      if (!isOpen) setIsOpen(true)
      if (optionCount === 0) return
      const step = event.key === "ArrowDown" ? 1 : -1
      setActiveIndex((index) => (index + step + optionCount) % optionCount)
    } else if (event.key === "Enter") {
      event.preventDefault()
      const result = results[activeIndex]
      if (isOpen && result) openResult(result)
      else searchAll()
    } else if (event.key === "Escape") {
      if (isOpen) close()
      else if (value) clear()
    }
  }

  const showDropdown = isOpen && Boolean(term)

  return (
    <div className="relative">
      <InputGroup className="bg-background">
        <InputGroupAddon>{isPending ? <Spinner /> : <Search />}</InputGroupAddon>
        <InputGroupInput
          ref={inputRef}
          type="text"
          value={value}
          onChange={(event) => {
            setValue(event.target.value)
            setIsOpen(true)
            setActiveIndex(-1)
          }}
          onFocus={() => setIsOpen(true)}
          onBlur={close}
          onKeyDown={handleKeyDown}
          placeholder={search.placeholder}
          aria-label={search.placeholder}
          maxLength={100}
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={
            showDropdown && activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined
          }
          autoComplete="off"
        />
        <InputGroupAddon align="inline-end">
          {value ? (
            <InputGroupButton
              size="icon-xs"
              aria-label="Clear search"
              onClick={clear}
              className="text-destructive hover:text-destructive"
            >
              <X />
            </InputGroupButton>
          ) : (
            <Kbd className="hidden sm:inline-flex">/</Kbd>
          )}
        </InputGroupAddon>
      </InputGroup>

      {showDropdown && (
        <div
          id={listboxId}
          role="listbox"
          aria-label={`${title} suggestions`}
          // Keep focus in the input so a click is not lost to the blur that closes it.
          onMouseDown={(event) => event.preventDefault()}
          className="absolute inset-x-0 top-full z-50 mt-1 max-h-[70vh] overflow-y-auto rounded-lg border bg-popover text-popover-foreground shadow-lg"
        >
          {isSearching && results.length === 0 ? (
            <p className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
              <Spinner /> Searching {entity}…
            </p>
          ) : suggestions?.failed ? (
            <p className="px-3 py-3 text-sm text-destructive">
              Couldn&apos;t search {entity}. Please try again.
            </p>
          ) : results.length === 0 ? (
            <p className="px-3 py-3 text-sm text-muted-foreground">
              No {entity} match &ldquo;{term}&rdquo;.
            </p>
          ) : (
            results.map((result, index) => (
              <SearchResultOption
                key={result.id}
                id={`${listboxId}-${index}`}
                result={result}
                isActive={index === activeIndex}
                onHover={() => setActiveIndex(index)}
                onSelect={() => openResult(result)}
              />
            ))
          )}
          <div
            id={`${listboxId}-${searchAllIndex}`}
            role="option"
            aria-selected={activeIndex === searchAllIndex}
            data-active={activeIndex === searchAllIndex}
            onMouseEnter={() => setActiveIndex(searchAllIndex)}
            onClick={searchAll}
            className="flex cursor-pointer items-center gap-2 border-t px-3 py-2.5 text-sm text-primary data-[active=true]:bg-sidebar-accent"
          >
            <Search className="size-4" />
            <span className="truncate">
              Search all {entity} for &ldquo;{term}&rdquo;
            </span>
            <Kbd className="ml-auto">Enter</Kbd>
          </div>
        </div>
      )}
    </div>
  )
}

const BADGE_TONES = {
  default: "text-muted-foreground",
  success: "text-emerald-700",
  destructive: "text-destructive",
}

function SearchResultOption({
  id,
  result,
  isActive,
  onHover,
  onSelect,
}: {
  id: string
  result: SearchResult
  isActive: boolean
  onHover: () => void
  onSelect: () => void
}) {
  return (
    <div
      id={id}
      role="option"
      aria-selected={isActive}
      data-active={isActive}
      onMouseEnter={onHover}
      onClick={onSelect}
      className="cursor-pointer border-b px-3 py-2.5 last:border-b-0 data-[active=true]:bg-sidebar-accent"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="truncate text-sm font-medium">{result.title}</p>
        {result.badge && (
          <span
            className={cn(
              "shrink-0 text-xs font-medium",
              BADGE_TONES[result.badge.tone ?? "default"]
            )}
          >
            {result.badge.label}
          </span>
        )}
      </div>
      {result.details.length > 0 && (
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
          {result.details.map((detail, index) => (
            <span
              key={`${detail.label}-${detail.value}`}
              className={cn(index > 0 && "border-l pl-2")}
            >
              {detail.label && `${detail.label}: `}
              {detail.value}
            </span>
          ))}
        </p>
      )}
    </div>
  )
}
