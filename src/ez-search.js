import {
  fetchCsv,
  on,
  last,
  splitOnComma,
  safeJsonParse,
  findIndexOfMap,
  log,
  CONSTS,
} from './utils'
import {
  createFiltersTree,
  getCurrentFilterObject,
  getSelectedItem,
} from './filter'
import * as ls from './local-storage'

const { ATTR } = CONSTS
let _FILTER_TREE_CACHE = {}

function validateOptions({
  rootNode,
  fetchData,
  collectionHandle,
  onEvent,
  resetNextSelectsOnChange = false,
  autoSearch = false,
  productTags = null,
  cacheSeconds = 300,
  hasCsvHeaders = false,
  isFitmentWidget = false,
  loadingBtnClass = 'btn--loading',
} = {}) {
  let validated = {}

  if (!(rootNode instanceof HTMLElement))
    throw new Error('rootNode must be specified')
  validated.rootNode = rootNode
  let uid = rootNode.getAttribute(ATTR.id) || ''
  validated.filterSelects = Array.from(
    rootNode.querySelectorAll(`select[${ATTR.filter}]`)
  ).map(sel => {
    sel.setAttribute(ATTR.filter, (sel.getAttribute(ATTR.filter) || '') + uid)
    return sel
  })
  validated.filterKeys = validated.filterSelects
    .map(sel => sel.getAttribute(ATTR.filter))
    .filter(Boolean)

  if (
    validated.filterKeys.length < 1 ||
    validated.filterSelects.length !== validated.filterKeys.length
  ) {
    throw new Error('Filter keys/selects mismatch')
  }
  validated.filterKeysSortBy = validated.filterSelects.map(select => {
    let desc = select.getAttribute(ATTR.sort_by) === 'desc'
    return { desc, asc: !desc }
  })

  let url = rootNode.getAttribute(ATTR.csv_url)
  if (typeof url !== 'string' && !fetchData)
    throw new Error('URL or `fetchData` must be specified')

  validated.collectionHandle =
    typeof collectionHandle === 'string'
      ? collectionHandle
      : rootNode.getAttribute(ATTR.coll_handle) || 'all'

  validated.onEvent = typeof onEvent === 'function' ? onEvent : null
  validated.autoSearch = !!autoSearch || rootNode.hasAttribute(ATTR.auto_search)
  validated.resetNextSelectsOnChange =
    !!resetNextSelectsOnChange ||
    rootNode.hasAttribute(ATTR.rest_next_selects_on_change)
  validated.hasCsvHeaders =
    !!hasCsvHeaders || rootNode.hasAttribute(ATTR.csv_headers)
  validated.isFitmentWidget =
    !!isFitmentWidget || rootNode.hasAttribute(ATTR.fitment_widget)
  validated.loadingBtnClass = (
    typeof loadingBtnClass == 'string'
      ? loadingBtnClass
      : rootNode.getAttribute(ATTR.loading_btn_class) || ''
  )
    .split(' ')
    .filter(Boolean)
  if (validated.loadingBtnClass.length === 0) validated.loadingBtnClass = null

  validated.filteredLinks = Array.from(
    rootNode.querySelectorAll(`a[${ATTR.filtered_link}]`)
  )
  validated.filteredTitle = Array.from(
    rootNode.querySelectorAll(`[${ATTR.filtered_title}]`)
  )
  validated.triggerVerifyBtns = Array.from(
    rootNode.querySelectorAll(`[${ATTR.filter_trigger_verify}]`)
  )
  validated.toggleOpenBtns = Array.from(
    rootNode.querySelectorAll(`[${ATTR.toggle_open}]`)
  )

  Array.from(rootNode.querySelectorAll(`[${ATTR.loading_on_click}]`)).forEach(
    el => {
      el.__ezs_loadable = true
    }
  )

  // reset `selects` - (maybe Clear cache as well)
  validated.gotoPendingBtns = Array.from(
    rootNode.querySelectorAll(`[${ATTR.goto_pending}]`)
  ).map(btn => {
    let clearCache = btn.hasAttribute(ATTR.clear_cache)
    if (clearCache) btn.__ezs_clear_cache = true

    return btn
  })

  validated.gotoBaseCollectionBtns = Array.from(
    rootNode.querySelectorAll(`[${ATTR.goto_base_collection}]`)
  ).map(btn => {
    let clearCache = btn.hasAttribute(ATTR.clear_cache)
    if (clearCache) btn.__ezs_clear_cache = true

    return btn
  })

  validated.productTags =
    typeof productTags === 'string'
      ? splitOnComma(productTags)
      : Array.isArray(productTags)
      ? productTags
      : null

  if (validated.productTags == null && rootNode.hasAttribute(ATTR.prod_tags)) {
    let tags = rootNode.getAttribute(ATTR.prod_tags)
    validated.productTags = safeJsonParse(tags) || splitOnComma(tags)
  }

  cacheSeconds = rootNode.getAttribute(ATTR.cache_seconds) || cacheSeconds
  if (typeof cacheSeconds === 'string') {
    cacheSeconds = Number(cacheSeconds) || 300
  }
  validated.cacheSeconds =
    typeof cacheSeconds === 'number' ? Math.max(Math.trunc(cacheSeconds), 0) : 0
  validated.preClearCache = rootNode.hasAttribute(ATTR.pre_clear_cache)

  if (typeof url === 'string') validated.url = url
  if (typeof fetchData === 'function') validated.fetchData = fetchData

  let filterForm = rootNode.querySelector('form[data-ezs-form]')
  if (filterForm) {
    validated.filterForm = filterForm
    validated.filterFormSubmitBtn = filterForm.querySelector('[type="submit"]')
  }

  return validated
}

export async function hydrateEZSearch(options) {
  const {
    filterSelects: selects,
    filterKeys,
    url,
    fetchData,
    collectionHandle: baseColHandle,
    filterForm,
    filterFormSubmitBtn,
    rootNode,
    onEvent,
    autoSearch,
    productTags,
    cacheSeconds,
    preClearCache,
    gotoPendingBtns,
    gotoBaseCollectionBtns,
    loadingBtnClass,
    toggleOpenBtns,
    filteredLinks,
    filteredTitle,
    hasCsvHeaders,
    triggerVerifyBtns,
    isFitmentWidget,
    filterKeysSortBy,
    resetNextSelectsOnChange,
  } = validateOptions(options)

  if (rootNode.__ezs_hydrated) {
    log('Already hydrated')
    return
  }

  rootNode.__ezs_hydrated = true
  const onDestroyListeners = [
    () => {
      rootNode.__ezs_hydrated = false
    },
  ]

  const baseColPath = `/collections/${baseColHandle}`
  const canCache = cacheSeconds && cacheSeconds > 0
  const prodcutTagsLookup =
    productTags && productTags.length > 0
      ? productTags.reduce((lookup, tag) => {
          lookup[tag] = true
          return lookup
        }, {})
      : null

  const activeFilters = new Map(
    Array.from({ length: filterKeys.length }, (_, i) => [
      filterKeys[i],
      !canCache || preClearCache ? '' : ls.get(filterKeys[i]) || '',
    ])
  )

  let filterTree = null // {}

  function updateOptions({
    selectIndex,
    updateSelectValue = false,
    forcePending = false,
  } = {}) {
    let activeFiltersList = [...activeFilters]
    activeFiltersList.forEach(([label, filterValue], idx) => {
      const filterObject = getCurrentFilterObject({
        selectedValues: activeFiltersList,
        index: idx,
        filterTree: filterTree,
      })

      // Reset the current filter value if next options does not contain the current value
      if (!filterObject?.[filterValue]) activeFilters.set(label, '')

      const isNextSelect = idx > selectIndex

      const select = selects[idx]

      const filterOptions = filterObject?._keys_ || []
      const hasFilterOptions =
        Array.isArray(filterOptions) && filterOptions.length > 0
      select.disabled = !hasFilterOptions

      if (canCache) {
        if (filterValue) {
          ls.set(label, filterValue, cacheSeconds)
        } else {
          ls.remove(label)
        }
      }

      let sameOptions =
        selectIndex === -1 || updateSelectValue
          ? false
          : !isNextSelect
          ? true
          : resetNextSelectsOnChange
          ? false
          : filterOptions.length === select.options.length - 1 &&
            filterOptions.every((opt, i) => opt === select.options[i + 1].value)

      if (!sameOptions) {
        select.options.length = 1

        requestAnimationFrame(() => {
          filterOptions.forEach((opt, i) => {
            select.options[i + 1] = new Option(opt, opt)
          })

          select.value = activeFilters.get(label)
        })
      }
    })

    if (autoSearch || forcePending || selectIndex === -1) {
      afterOptionsUpdate({
        forcePending,
        preventAutosearch: selectIndex === -1,
        activeFiltersList,
      })
    }
    onEvent?.('SELECTION_UPDATE', {
      index: selectIndex,
      select: selects[selectIndex],
    })
  }

  function afterOptionsUpdate({
    forcePending = false,
    fromCache = false,
    preventAutosearch = false,
  } = {}) {
    let allSelected = [...activeFilters].every(
      ([, filterValue]) => !!filterValue
    )
    rootNode.setAttribute(
      'data-ezs-selected-filters',
      allSelected ? 'all' : 'partial'
    )

    // Check if there is any valid selection
    let selectedItem = forcePending
      ? null
      : fromCache
      ? safeJsonParse(ls.get('selectedItem'), 'null')
      : getSelectedItem({ keys: filterKeys, activeFilters, filterTree })
    let finalHref = selectedItem?._path

    if (prodcutTagsLookup) {
      let tag = selectedItem?._tag
      let hasTag = prodcutTagsLookup[tag]

      rootNode.setAttribute(
        'data-ezs-state',
        !selectedItem ? 'pending' : hasTag ? 'valid' : 'invalid'
      )
    }

    if (filterForm) {
      if (finalHref) {
        filterForm.action = finalHref
        if (filterFormSubmitBtn) filterFormSubmitBtn.disabled = false
      } else {
        filterForm.removeAttribute('action')
        if (filterFormSubmitBtn) filterFormSubmitBtn.disabled = true
      }
    }

    if (selectedItem) {
      onEvent?.('SELECTION_COMPLETE', { selected: selectedItem })

      rootNode.dispatchEvent(
        new CustomEvent('EZSearch_Selected', {
          detail: {
            selected: selectedItem,
          },
          bubbles: false,
          cancelable: false,
        })
      )
    }

    filteredLinks.forEach(anchor => {
      if (finalHref) {
        anchor.setAttribute('href', selectedItem?._path)
        anchor.disabled = true
      } else {
        anchor.removeAttribute('href')
        anchor.disabled = true
      }
    })

    let selectedItemTitle = selectedItem
      ? filterKeys.map(key => activeFilters.get(key)).join(' ')
      : ''
    filteredTitle.forEach(el => {
      el.textContent = selectedItemTitle
    })

    selectedItem
      ? ls.set('selectedItem', JSON.stringify(selectedItem))
      : ls.remove('selectedItem')

    let canSubmit = finalHref && filterForm && autoSearch && !preventAutosearch
    if (canSubmit) {
      document.body.setAttribute('data-ezs-navigating', '')
      canSubmit && filterForm.submit()
    }
  }

  function handleChange(event) {
    let index = event?.target?.__ezs_index
    if (typeof index !== 'number') {
      log.warn('no `__ezs_index` found')
      return
    }

    const label = filterKeys[index]
    let select = selects[index]

    const v = select.value
    v ? activeFilters.set(label, v) : activeFilters.set(label, '')

    if (resetNextSelectsOnChange) {
      ;[...activeFilters].forEach(([_label], idx) => {
        if (idx > index) activeFilters.set(_label, '')
      })
    }

    updateOptions({ selectIndex: index })
  }

  function updateFilterValue(label, value) {
    let hasFilter = activeFilters.has(label)
    if (!hasFilter) return

    if (typeof value === 'string') value = value.trim()
    else value = ''

    let filterIndex = findIndexOfMap(label, activeFilters)
    if (filterIndex == null) return

    activeFilters.set(label, value)

    updateOptions({
      selectIndex: filterIndex,
      updateSelectValue: true,
      forcePending: true,
    })
  }

  function clearAllCache() {
    ls.remove('selectedItem')
    filterKeys.forEach(key => ls.remove(key))
  }

  // -------------------------------------------------

  function setupListeners(selects) {
    let firstOptions = selects.map((select, idx) => {
      select.__ezs_index = idx

      let firstOption = select.options[0]
      if (firstOption) {
        firstOption.value = ''
        return firstOption
      }

      firstOption = new Option('All', '', true, true)
      return firstOption
    })

    selects.forEach((select, idx) => {
      let removeListener = on(select, 'change', handleChange)
      onDestroyListeners.push(removeListener)

      select.options.length = 1
      select.options[0] = firstOptions[idx]
    })

    onDestroyListeners.push(
      ...triggerVerifyBtns.map(btn => {
        if (btn.disabled) btn.disabled = false

        return on(btn, 'click', () => {
          afterOptionsUpdate()
        })
      }),

      ...gotoPendingBtns.map(btn => {
        if (btn.disabled) btn.disabled = false

        return on(btn, 'click', () => {
          let clearCache = btn.__ezs_clear_cache
          if (clearCache) {
            clearAllCache()
            updateFilterValue(filterKeys[0], '')
          }

          afterOptionsUpdate({ forcePending: true })
          selects[0].focus()
        })
      }),

      ...gotoBaseCollectionBtns.map(btn => {
        if (btn.disabled) btn.disabled = false

        return on(btn, 'click', () => {
          btn.disabled = true

          let clearCache = btn.__ezs_clear_cache
          if (clearCache) {
            clearAllCache()
            // updateFilterValue(filterKeys[0], '')
          }

          if (filterForm) {
            filterForm.action = baseColPath
            filterForm.submit()
          } else {
            window.location.href = baseColPath
          }
        })
      }),

      ...toggleOpenBtns.map(btn => {
        return on(btn, 'click', () => {
          rootNode.classList.toggle('is-open')
        })
      }),

      on(rootNode, 'click', e => {
        let target = e?.target
        if (target && target.__ezs_loadable) {
          loadingBtnClass?.forEach(clx => {
            target.classList.add(clx)
          })
        }
      })
    )

    updateOptions({ selectIndex: -1 })
  }

  async function prepareFilterTree() {
    let cachedPromiseTree = _FILTER_TREE_CACHE[url]
    if (cachedPromiseTree) {
      return cachedPromiseTree
    }

    let fetchPromise = fetchCsv(url, fetchData).then(listOfArrays => {
      if (listOfArrays.length === 0) return listOfArrays

      // If has csv headers, then remove them
      if (hasCsvHeaders || filterKeys.every((k, i) => listOfArrays[0][i] === k))
        listOfArrays = listOfArrays.slice(1)

      let allValid = true
      let filterKeysCount = filterKeys.length

      let parsed = listOfArrays.map(list => {
        if (allValid && list.length - 1 !== filterKeysCount) {
          log.error('CSV data and `filterKeys` mismatch', {
            filterKeys,
            line: list,
          })

          allValid = false
        }

        if (!allValid) return []

        let item = list.reduce((acc, v, idx) => {
          let label = filterKeys[idx]

          if (label) {
            acc[label] = v
          } else {
            acc._path = baseColHandle
              ? v.replace('/all/', `/${baseColHandle}/`)
              : v
            acc._tag = last(v.split('/'))
          }

          return acc
        }, {})

        return item
      })

      if (!allValid) {
        throw new Error('CSV data and `filterKeys` mismatch')
      }

      let tree = createFiltersTree({
        data: parsed,
        activeFilters: [...activeFilters],
        path: [],
        keys: filterKeys,
        keysSort: filterKeysSortBy,
        getValue: (csvLineArray, key, keyIndex) => csvLineArray[keyIndex],
      })

      return tree
    })

    _FILTER_TREE_CACHE[url] = fetchPromise

    return fetchPromise
  }

  function updateTagValidityEarly() {
    if (isFitmentWidget) {
      afterOptionsUpdate({ fromCache: true })
    }
  }

  function afterHydrate() {
    rootNode.setAttribute('data-ezs-loaded', 'true')
  }

  // -------------------------------------------------

  // const sleep = (ms = 2500) => new Promise(fulfil => setTimeout(fulfil, ms))

  async function main() {
    if (preClearCache) {
      clearAllCache()
    }

    updateTagValidityEarly()

    return prepareFilterTree()
      .then(async tree => {
        filterTree = tree

        // await sleep()
        setupListeners(selects)
      })
      .then(() => {
        afterHydrate()
      })
  }

  return main().then(() => {
    return {
      filterTree,
      getActiveFilters() {
        return [...activeFilters]
      },
      updateFilterValue,
      clearAllCache,
      prodcutTagsLookup,
      destory() {
        selects.forEach(select => {
          select.options.length = 1
        })

        onDestroyListeners.forEach(f => f())
        onDestroyListeners.length = 1
      },
    }
  })
}
