export const typeOf = x => Object.prototype.toString.call(x).slice(8, -1)
export const isObject = x => typeOf(x) === 'Object'
export const concatObjects = (x, y) => ({ ...x, ...y })

let IS_PROD = import.meta.env.MODE !== 'development'
let LOG_PREFIX = '[EZSearch] :: '
export function log(...x) {
  return IS_PROD ? console.log(LOG_PREFIX, ...x) : console.log(x)
}
log.warn = (...x) =>
  IS_PROD ? console.warn(LOG_PREFIX, ...x) : console.warn(...x)
log.info = (...x) =>
  IS_PROD ? console.info(LOG_PREFIX, ...x) : console.info(...x)
log.error = (...x) =>
  IS_PROD ? console.error(LOG_PREFIX, ...x) : console.error(...x)

/* prettier-ignore */
function parseCSV(str) {
  let arr = []
  let quote = false  // 'true' means we're inside a quoted field

  // Iterate over each character, keep track of current row and column (of the returned array)
  for (let row = 0, col = 0, c = 0; c < str.length; c++) {
      let cc = str[c], nc = str[c+1]        // Current character, next character
      arr[row] = arr[row] || []             // Create a new row if necessary
      arr[row][col] = arr[row][col] || ''   // Create a new column (start with empty string) if necessary

      // If the current character is a quotation mark, and we're inside a
      // quoted field, and the next character is also a quotation mark,
      // add a quotation mark to the current column and skip the next character
      if (cc == '"' && quote && nc == '"') { arr[row][col] += cc; ++c; continue }

      // If it's just one quotation mark, begin/end quoted field
      if (cc == '"') { quote = !quote; continue }

      // If it's a comma and we're not in a quoted field, move on to the next column
      if (cc == ',' && !quote) { ++col; continue }

      // If it's a newline (CRLF) and we're not in a quoted field, skip the next character
      // and move on to the next row and move to column 0 of that new row
      if (cc == '\r' && nc == '\n' && !quote) { ++row; col = 0; ++c; continue }

      // If it's a newline (LF or CR) and we're not in a quoted field,
      // move on to the next row and move to column 0 of that new row
      if (cc == '\n' && !quote) { ++row; col = 0; continue }
      if (cc == '\r' && !quote) { ++row; col = 0; continue }

      // Otherwise, append the current character to the current column
      arr[row][col] += cc
  }
  return arr
}

export async function fetchCsv(url, fetcherFn) {
  if (typeof fetcherFn === 'function') {
    return fetcherFn({ parseCSV })
  }

  let res = await fetch(url)
  if (!res.ok) {
    log('Unable to fetch CSV')
    return null
  }

  let csvText = await res.text()
  return parseCSV(csvText)
}

export function getCurrentUrl(queryParams) {
  if (!queryParams) {
    return window.location.href
  }

  let searchParams = new URLSearchParams(window.location.search)

  Object.keys(queryParams).forEach(k => {
    let value = queryParams[k]
    value == null ? searchParams.delete(k) : searchParams.set(k, value)
  })

  let newurl =
    window.location.protocol +
    '//' +
    window.location.host +
    window.location.pathname +
    '?' +
    searchParams.toString()
  return newurl
}

export function updateUrlQueryParams(queryParams, replace) {
  if (!queryParams) return

  if (history.pushState) {
    let newurl = getCurrentUrl(queryParams)

    let fn = replace ? 'replaceState' : 'pushState'
    window.history[fn]({ path: newurl }, '', newurl)
  }
}

export function getQueryParams(keys) {
  let searchParams = new URLSearchParams(window.location.search)

  return Array.isArray(keys)
    ? keys.map(k => (typeof k === 'string' ? searchParams.get(k) : null))
    : searchParams.get(keys)
}

export function splitOnComma(text) {
  if (typeof text === 'string') text.split(/,\s*/)
  return null
}

export function safeJsonParse(text, fallbackText = 'null') {
  try {
    return JSON.parse(text || fallbackText)
  } catch (error) {
    return typeof fallbackText === 'string'
      ? JSON.parse(fallbackText)
      : fallbackText
  }
}

export function iterateWithIndex(fn, iterable) {
  let index = 0
  for (const value of iterable) {
    fn(value, index)
    index++
  }

  return iterable
}

export function findIndexOfMap(label, map) {
  let idx = 0
  let matchedIdx = null
  map.forEach((value, key) => {
    if (key === label && matchedIdx == null) matchedIdx = idx
    idx++
  })
  return matchedIdx
}

export const CONSTS = {
  ATTR: {
    id: 'data-ezs-id',
    filter: 'data-ezs-filter',
    csv_url: 'data-ezs-csv-url',
    coll_handle: 'data-ezs-collection-handle',
    auto_search: 'data-ezs-autosearch',
    csv_headers: 'data-ezs-has-csv-headers',
    filtered_link: 'data-ezs-filtered-link',
    filtered_title: 'data-ezs-filtered-title',
    filter_trigger_verify: 'data-ezs-trigger-verify',
    goto_pending: 'data-ezs-goto-pending',
    goto_base_collection: 'data-ezs-goto-base-collection',
    pre_clear_cache: 'data-ezs-clear-cache',
    clear_cache: 'data-ezs-clear-cache',
    cache_seconds: 'data-ezs-cache-seconds',
    prod_tags: 'data-ezs-product-tags',
    fitment_widget: 'data-ezs-fitment',
    sort_by: 'data-ezs-sort', // "desc"
    toggle_open: 'data-ezs-toggle-open',
    loading_on_click: 'data-ezs-load-on-click',
    loading_btn_class: 'data-ezs-loading-class',
  },
}

export function matchObjectTypes(sourceObject, targetObject) {
  Object.keys(sourceObject).forEach(k => {
    let v1 = sourceObject[k]
    let v2 = targetObject[k]

    if (typeOf(v1) !== typeOf(v2)) {
      targetObject[k] = v1
    }
  })

  return targetObject
}

export function last(list) {
  return list[list.length - 1]
}

export const domReady = () =>
  new Promise(fulfil => {
    let ready = document.readyState !== 'loading'
    if (ready) fulfil()
    else document.addEventListener('DOMContentLoaded', () => fulfil())
  })

export function on(
  element,
  eventName,
  handler,
  listenerOptions,
  runImmediately = false
) {
  if (listenerOptions != null)
    element.addEventListener(eventName, handler, listenerOptions)
  else element.addEventListener(eventName, handler)

  if (runImmediately) {
    handler()
  }

  return function cleanup() {
    element.removeEventListener(eventName, handler)
  }
}

export async function tick() {
  return new Promise(f => {
    requestAnimationFrame(f)
  })
}
