var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    };
    var rejected = (value) => {
      try {
        step(generator.throw(value));
      } catch (e) {
        reject(e);
      }
    };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};
(function(global, factory) {
  typeof exports === "object" && typeof module !== "undefined" ? module.exports = factory() : typeof define === "function" && define.amd ? define(factory) : (global = typeof globalThis !== "undefined" ? globalThis : global || self, global.EZSearch = factory());
})(this, function() {
  "use strict";
  const typeOf = (x) => Object.prototype.toString.call(x).slice(8, -1);
  const isObject = (x) => typeOf(x) === "Object";
  let LOG_PREFIX = "[EZSearch] :: ";
  function log(...x) {
    return console.log(LOG_PREFIX, ...x);
  }
  log.warn = (...x) => console.warn(LOG_PREFIX, ...x);
  log.info = (...x) => console.info(LOG_PREFIX, ...x);
  log.error = (...x) => console.error(LOG_PREFIX, ...x);
  function parseCSV(str) {
    let arr = [];
    let quote = false;
    for (let row = 0, col = 0, c = 0; c < str.length; c++) {
      let cc = str[c], nc = str[c + 1];
      arr[row] = arr[row] || [];
      arr[row][col] = arr[row][col] || "";
      if (cc == '"' && quote && nc == '"') {
        arr[row][col] += cc;
        ++c;
        continue;
      }
      if (cc == '"') {
        quote = !quote;
        continue;
      }
      if (cc == "," && !quote) {
        ++col;
        continue;
      }
      if (cc == "\r" && nc == "\n" && !quote) {
        ++row;
        col = 0;
        ++c;
        continue;
      }
      if (cc == "\n" && !quote) {
        ++row;
        col = 0;
        continue;
      }
      if (cc == "\r" && !quote) {
        ++row;
        col = 0;
        continue;
      }
      arr[row][col] += cc;
    }
    return arr;
  }
  function fetchCsv(url, fetcherFn) {
    return __async(this, null, function* () {
      if (typeof fetcherFn === "function") {
        return fetcherFn({ parseCSV });
      }
      let res = yield fetch(url);
      if (!res.ok) {
        log("Unable to fetch CSV");
        return null;
      }
      let csvText = yield res.text();
      return parseCSV(csvText);
    });
  }
  function splitOnComma(text) {
    if (typeof text === "string")
      text.split(/,\s*/);
    return null;
  }
  function safeJsonParse(text, fallbackText = "null") {
    try {
      return JSON.parse(text || fallbackText);
    } catch (error) {
      return typeof fallbackText === "string" ? JSON.parse(fallbackText) : fallbackText;
    }
  }
  function findIndexOfMap(label, map) {
    let idx = 0;
    let matchedIdx = null;
    map.forEach((value, key) => {
      if (key === label && matchedIdx == null)
        matchedIdx = idx;
      idx++;
    });
    return matchedIdx;
  }
  const CONSTS = {
    ATTR: {
      id: "data-ezs-id",
      filter: "data-ezs-filter",
      csv_url: "data-ezs-csv-url",
      coll_handle: "data-ezs-collection-handle",
      auto_search: "data-ezs-autosearch",
      csv_headers: "data-ezs-has-csv-headers",
      filtered_link: "data-ezs-filtered-link",
      filtered_title: "data-ezs-filtered-title",
      filter_trigger_verify: "data-ezs-trigger-verify",
      goto_pending: "data-ezs-goto-pending",
      goto_base_collection: "data-ezs-goto-base-collection",
      pre_clear_cache: "data-ezs-clear-cache",
      clear_cache: "data-ezs-clear-cache",
      cache_seconds: "data-ezs-cache-seconds",
      prod_tags: "data-ezs-product-tags",
      fitment_widget: "data-ezs-fitment",
      sort_by: "data-ezs-sort",
      toggle_open: "data-ezs-toggle-open",
      loading_on_click: "data-ezs-load-on-click",
      loading_btn_class: "data-ezs-loading-class"
    }
  };
  function last(list) {
    return list[list.length - 1];
  }
  const domReady = () => new Promise((fulfil) => {
    let ready = document.readyState !== "loading";
    if (ready)
      fulfil();
    else
      document.addEventListener("DOMContentLoaded", () => fulfil());
  });
  function on(element, eventName, handler, listenerOptions, runImmediately = false) {
    if (listenerOptions != null)
      element.addEventListener(eventName, handler, listenerOptions);
    else
      element.addEventListener(eventName, handler);
    if (runImmediately) {
      handler();
    }
    return function cleanup() {
      element.removeEventListener(eventName, handler);
    };
  }
  function iterateOverObjectTree(obj, fn, level = 0) {
    if (isObject(obj)) {
      let allKeys = Object.keys(obj);
      allKeys.forEach((k) => {
        let v = obj[k];
        iterateOverObjectTree(v, fn, level + 1);
      });
      fn(obj, allKeys, level);
    }
    if (Array.isArray(obj)) {
      obj.forEach((o) => {
        iterateOverObjectTree(o, fn, level);
      });
    }
    return obj;
  }
  function createFiltersTree({ data, keys = [], path = [], keysSort = [] }) {
    let res = {};
    keys.forEach((k, keyIndex) => {
      let isLastKeyIndex = keyIndex === keys.length - 1;
      data.forEach((item) => {
        if (!item)
          return;
        let obj = path.reduce((x, k2) => x[k2], item);
        if (!obj)
          return;
        let value = obj[k];
        if (typeof value == "number")
          value = value.toString();
        if (typeof value !== "string")
          return;
        let resInnerObj = keys.slice(0, keyIndex).reduce((x, k2) => x[obj[k2]], res);
        if (!resInnerObj)
          return;
        resInnerObj[value] = isLastKeyIndex ? item : {};
      });
    });
    return Object.keys(res).length > 0 ? iterateOverObjectTree(res, (obj, keys2, levelIndex) => {
      var _a;
      if (!obj._tag) {
        const desc = (_a = keysSort[levelIndex]) == null ? void 0 : _a.desc;
        obj._keys_ = keys2.sort((a, b) => desc ? b.localeCompare(a) : a.localeCompare(b));
      }
    }) : res;
  }
  function isFilterSelectable(selectedValues, index2) {
    if (index2 < 0 || index2 >= selectedValues.length)
      return false;
    let slice = selectedValues.slice(0, index2);
    const isTuple = Array.isArray(selectedValues[0]);
    return isTuple ? slice.every(([key, value]) => !!value) : slice.every((v) => !!v);
  }
  function getCurrentFilterObject({ selectedValues, index: index2, filterTree }) {
    let selectable = isFilterSelectable(selectedValues, index2);
    if (!selectable)
      return null;
    if (selectable) {
      const isTuple = Array.isArray(selectedValues[0]);
      let res = selectedValues.slice(0, index2).reduce((x, maybeTuple) => {
        let value = isTuple ? maybeTuple[1] : maybeTuple;
        return x[value];
      }, filterTree);
      return res;
    }
  }
  function getSelectedItem({ keys, filterTree, activeFilters }) {
    return keys.reduce((value, label) => {
      let filterValue = activeFilters.get(label);
      if (!filterValue)
        return null;
      return (value == null ? void 0 : value[filterValue]) || null;
    }, filterTree);
  }
  const getKey = (key) => `ezs_${key}`;
  const expiryKey = (key) => `${key}__expiresIn`;
  function remove(key) {
    const _key = getKey(key);
    window.localStorage.removeItem(_key);
    window.localStorage.removeItem(expiryKey(_key));
    return true;
  }
  function get(key) {
    const _key = getKey(key);
    let now = Date.now();
    let expiresIn = Number(window.localStorage.getItem(expiryKey(_key)) || "0");
    if (expiresIn < now) {
      remove(_key);
      return null;
    } else {
      return window.localStorage.getItem(_key);
    }
  }
  function set(key, value, expires = 60 * 5) {
    const _key = getKey(key);
    expires = Math.abs(expires);
    let now = Date.now();
    let expiry = now + expires * 1e3;
    window.localStorage.setItem(_key, value);
    window.localStorage.setItem(expiryKey(_key), expiry);
    return true;
  }
  const { ATTR } = CONSTS;
  let _FILTER_TREE_CACHE = {};
  function validateOptions({
    rootNode,
    fetchData,
    collectionHandle,
    onEvent,
    autoSearch = false,
    productTags = null,
    cacheSeconds = 300,
    hasCsvHeaders = false,
    isFitmentWidget = false,
    loadingBtnClass = "btn--loading"
  } = {}) {
    let validated = {};
    if (!(rootNode instanceof HTMLElement))
      throw new Error("rootNode must be specified");
    validated.rootNode = rootNode;
    let uid = rootNode.getAttribute(ATTR.id) || "";
    validated.filterSelects = Array.from(rootNode.querySelectorAll(`select[${ATTR.filter}]`)).map((sel) => {
      sel.setAttribute(ATTR.filter, (sel.getAttribute(ATTR.filter) || "") + uid);
      return sel;
    });
    validated.filterKeys = validated.filterSelects.map((sel) => sel.getAttribute(ATTR.filter)).filter(Boolean);
    if (validated.filterKeys.length < 1 || validated.filterSelects.length !== validated.filterKeys.length) {
      throw new Error("Filter keys/selects mismatch");
    }
    validated.filterKeysSortBy = validated.filterSelects.map((select) => {
      let desc = select.getAttribute(ATTR.sort_by) === "desc";
      return { desc, asc: !desc };
    });
    let url = rootNode.getAttribute(ATTR.csv_url);
    if (typeof url !== "string" && !fetchData)
      throw new Error("URL or `fetchData` must be specified");
    validated.collectionHandle = typeof collectionHandle === "string" ? collectionHandle : rootNode.getAttribute(ATTR.coll_handle) || "all";
    validated.onEvent = typeof onEvent === "function" ? onEvent : null;
    validated.autoSearch = !!autoSearch || rootNode.hasAttribute(ATTR.auto_search);
    validated.hasCsvHeaders = !!hasCsvHeaders || rootNode.hasAttribute(ATTR.csv_headers);
    validated.isFitmentWidget = !!isFitmentWidget || rootNode.hasAttribute(ATTR.fitment_widget);
    validated.loadingBtnClass = (typeof loadingBtnClass == "string" ? loadingBtnClass : rootNode.getAttribute(ATTR.loading_btn_class) || "").split(" ").filter(Boolean);
    if (validated.loadingBtnClass.length === 0)
      validated.loadingBtnClass = null;
    validated.filteredLinks = Array.from(rootNode.querySelectorAll(`a[${ATTR.filtered_link}]`));
    validated.filteredTitle = Array.from(rootNode.querySelectorAll(`[${ATTR.filtered_title}]`));
    validated.triggerVerifyBtns = Array.from(rootNode.querySelectorAll(`[${ATTR.filter_trigger_verify}]`));
    validated.toggleOpenBtns = Array.from(rootNode.querySelectorAll(`[${ATTR.toggle_open}]`));
    Array.from(rootNode.querySelectorAll(`[${ATTR.loading_on_click}]`)).forEach((el) => {
      el.__ezs_loadable = true;
    });
    validated.gotoPendingBtns = Array.from(rootNode.querySelectorAll(`[${ATTR.goto_pending}]`)).map((btn) => {
      let clearCache = btn.hasAttribute(ATTR.clear_cache);
      if (clearCache)
        btn.__ezs_clear_cache = true;
      return btn;
    });
    validated.gotoBaseCollectionBtns = Array.from(rootNode.querySelectorAll(`[${ATTR.goto_base_collection}]`)).map((btn) => {
      let clearCache = btn.hasAttribute(ATTR.clear_cache);
      if (clearCache)
        btn.__ezs_clear_cache = true;
      return btn;
    });
    validated.productTags = typeof productTags === "string" ? splitOnComma(productTags) : Array.isArray(productTags) ? productTags : null;
    if (validated.productTags == null && rootNode.hasAttribute(ATTR.prod_tags)) {
      let tags = rootNode.getAttribute(ATTR.prod_tags);
      validated.productTags = safeJsonParse(tags) || splitOnComma(tags);
    }
    cacheSeconds = rootNode.getAttribute(ATTR.cache_seconds) || cacheSeconds;
    if (typeof cacheSeconds === "string") {
      cacheSeconds = Number(cacheSeconds) || 300;
    }
    validated.cacheSeconds = typeof cacheSeconds === "number" ? Math.max(Math.trunc(cacheSeconds), 0) : 0;
    validated.preClearCache = rootNode.hasAttribute(ATTR.pre_clear_cache);
    if (typeof url === "string")
      validated.url = url;
    if (typeof fetchData === "function")
      validated.fetchData = fetchData;
    let filterForm = rootNode.querySelector("form[data-ezs-form]");
    if (filterForm) {
      validated.filterForm = filterForm;
      validated.filterFormSubmitBtn = filterForm.querySelector('[type="submit"]');
    }
    return validated;
  }
  function hydrateEZSearch(options) {
    return __async(this, null, function* () {
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
        filterKeysSortBy
      } = validateOptions(options);
      if (rootNode.__ezs_hydrated) {
        log("Already hydrated");
        return;
      }
      rootNode.__ezs_hydrated = true;
      const onDestroyListeners = [
        () => {
          rootNode.__ezs_hydrated = false;
        }
      ];
      const baseColPath = `/collections/${baseColHandle}`;
      const canCache = cacheSeconds && cacheSeconds > 0;
      const prodcutTagsLookup = productTags && productTags.length > 0 ? productTags.reduce((lookup, tag) => {
        lookup[tag] = true;
        return lookup;
      }, {}) : null;
      const activeFilters = new Map(Array.from({ length: filterKeys.length }, (_, i) => [
        filterKeys[i],
        !canCache || preClearCache ? "" : get(filterKeys[i]) || ""
      ]));
      let filterTree = null;
      function updateOptions({ selectIndex, updateSelectValue = false, forcePending = false } = {}) {
        let activeFiltersList = [...activeFilters];
        activeFiltersList.forEach(([label, filterValue], idx) => {
          const filterObject = getCurrentFilterObject({
            selectedValues: activeFiltersList,
            index: idx,
            filterTree
          });
          if (!(filterObject == null ? void 0 : filterObject[filterValue]))
            activeFilters.set(label, "");
          const isNextSelect = idx > selectIndex;
          const select = selects[idx];
          const filterOptions = (filterObject == null ? void 0 : filterObject._keys_) || [];
          const hasFilterOptions = Array.isArray(filterOptions) && filterOptions.length > 0;
          select.disabled = !hasFilterOptions;
          if (canCache) {
            if (filterValue) {
              set(label, filterValue, cacheSeconds);
            } else {
              remove(label);
            }
          }
          let sameOptions = selectIndex === -1 || updateSelectValue ? false : !isNextSelect ? true : filterOptions.length === select.options.length - 1 && filterOptions.every((opt, i) => opt === select.options[i + 1].value);
          if (!sameOptions) {
            select.options.length = 1;
            requestAnimationFrame(() => {
              filterOptions.forEach((opt, i) => {
                select.options[i + 1] = new Option(opt, opt);
              });
              select.value = activeFilters.get(label);
            });
          }
        });
        if (autoSearch || forcePending || selectIndex === -1) {
          afterOptionsUpdate({ forcePending, preventAutosearch: selectIndex === -1, activeFiltersList });
        }
        onEvent == null ? void 0 : onEvent("SELECTION_UPDATE", { index: selectIndex, select: selects[selectIndex] });
      }
      function afterOptionsUpdate({
        forcePending = false,
        fromCache = false,
        preventAutosearch = false,
        activeFiltersList
      } = {}) {
        let allSelected = (activeFiltersList || [...activeFilters]).every(([, filterValue]) => !!filterValue);
        rootNode.setAttribute("data-ezs-selected-filters", allSelected ? "all" : "partial");
        let selectedItem = forcePending ? null : fromCache ? safeJsonParse(get("selectedItem"), "null") : getSelectedItem({ keys: filterKeys, activeFilters, filterTree });
        let finalHref = selectedItem == null ? void 0 : selectedItem._path;
        if (prodcutTagsLookup) {
          let tag = selectedItem == null ? void 0 : selectedItem._tag;
          let hasTag = prodcutTagsLookup[tag];
          rootNode.setAttribute("data-ezs-state", !selectedItem ? "pending" : hasTag ? "valid" : "invalid");
        }
        if (filterForm) {
          if (finalHref) {
            filterForm.action = finalHref;
            if (filterFormSubmitBtn)
              filterFormSubmitBtn.disabled = false;
          } else {
            filterForm.removeAttribute("action");
            if (filterFormSubmitBtn)
              filterFormSubmitBtn.disabled = true;
          }
        }
        if (selectedItem) {
          onEvent == null ? void 0 : onEvent("SELECTION_COMPLETE", { selected: selectedItem });
          rootNode.dispatchEvent(new CustomEvent("EZSearch_Selected", {
            detail: {
              selected: selectedItem
            },
            bubbles: false,
            cancelable: false
          }));
        }
        filteredLinks.forEach((anchor) => {
          if (finalHref) {
            anchor.setAttribute("href", selectedItem == null ? void 0 : selectedItem._path);
            anchor.disabled = true;
          } else {
            anchor.removeAttribute("href");
            anchor.disabled = true;
          }
        });
        let selectedItemTitle = selectedItem ? filterKeys.map((key) => activeFilters.get(key)).join(" ") : "";
        filteredTitle.forEach((el) => {
          el.textContent = selectedItemTitle;
        });
        selectedItem ? set("selectedItem", JSON.stringify(selectedItem)) : remove("selectedItem");
        let canSubmit = finalHref && filterForm && autoSearch && !preventAutosearch;
        if (canSubmit) {
          document.body.setAttribute("data-ezs-navigating", "");
          canSubmit && filterForm.submit();
        }
      }
      function handleChange(event) {
        var _a;
        let index2 = (_a = event == null ? void 0 : event.target) == null ? void 0 : _a.__ezs_index;
        if (typeof index2 !== "number") {
          log.warn("no `__ezs_index` found");
          return;
        }
        const label = filterKeys[index2];
        let select = selects[index2];
        const v = select.value;
        v ? activeFilters.set(label, v) : activeFilters.set(label, "");
        updateOptions({ selectIndex: index2 });
      }
      function updateFilterValue(label, value) {
        let hasFilter = activeFilters.has(label);
        if (!hasFilter)
          return;
        if (typeof value === "string")
          value = value.trim();
        else
          value = "";
        let filterIndex = findIndexOfMap(label, activeFilters);
        if (filterIndex == null)
          return;
        activeFilters.set(label, value);
        updateOptions({ selectIndex: filterIndex, updateSelectValue: true, forcePending: true });
      }
      function clearAllCache() {
        remove("selectedItem");
        filterKeys.forEach((key) => remove(key));
      }
      function setupListeners(selects2) {
        let firstOptions = selects2.map((select, idx) => {
          select.__ezs_index = idx;
          let firstOption = select.options[0];
          if (firstOption) {
            firstOption.value = "";
            return firstOption;
          }
          firstOption = new Option("All", "", true, true);
          return firstOption;
        });
        selects2.forEach((select, idx) => {
          let removeListener = on(select, "change", handleChange);
          onDestroyListeners.push(removeListener);
          select.options.length = 1;
          select.options[0] = firstOptions[idx];
        });
        onDestroyListeners.push(...triggerVerifyBtns.map((btn) => {
          if (btn.disabled)
            btn.disabled = false;
          return on(btn, "click", () => {
            afterOptionsUpdate();
          });
        }), ...gotoPendingBtns.map((btn) => {
          if (btn.disabled)
            btn.disabled = false;
          return on(btn, "click", () => {
            let clearCache = btn.__ezs_clear_cache;
            if (clearCache) {
              clearAllCache();
              updateFilterValue(filterKeys[0], "");
            }
            afterOptionsUpdate({ forcePending: true });
            selects2[0].focus();
          });
        }), ...gotoBaseCollectionBtns.map((btn) => {
          if (btn.disabled)
            btn.disabled = false;
          return on(btn, "click", () => {
            btn.disabled = true;
            let clearCache = btn.__ezs_clear_cache;
            if (clearCache) {
              clearAllCache();
            }
            if (filterForm) {
              filterForm.action = baseColPath;
              filterForm.submit();
            } else {
              window.location.href = baseColPath;
            }
          });
        }), ...toggleOpenBtns.map((btn) => {
          return on(btn, "click", () => {
            rootNode.classList.toggle("is-open");
          });
        }), on(rootNode, "click", (e) => {
          let target = e == null ? void 0 : e.target;
          if (target && target.__ezs_loadable) {
            loadingBtnClass == null ? void 0 : loadingBtnClass.forEach((clx) => {
              target.classList.add(clx);
            });
          }
        }));
        updateOptions({ selectIndex: -1 });
      }
      function prepareFilterTree() {
        return __async(this, null, function* () {
          let cachedPromiseTree = _FILTER_TREE_CACHE[url];
          if (cachedPromiseTree) {
            return cachedPromiseTree;
          }
          let fetchPromise = fetchCsv(url, fetchData).then((listOfArrays) => {
            if (listOfArrays.length === 0)
              return listOfArrays;
            if (hasCsvHeaders || filterKeys.every((k, i) => listOfArrays[0][i] === k))
              listOfArrays = listOfArrays.slice(1);
            let allValid = true;
            let filterKeysCount = filterKeys.length;
            let parsed = listOfArrays.map((list) => {
              if (allValid && list.length - 1 !== filterKeysCount) {
                log.error("CSV data and `filterKeys` mismatch", {
                  filterKeys,
                  line: list
                });
                allValid = false;
              }
              if (!allValid)
                return [];
              let item = list.reduce((acc, v, idx) => {
                let label = filterKeys[idx];
                if (label) {
                  acc[label] = v;
                } else {
                  acc._path = baseColHandle ? v.replace("/all/", `/${baseColHandle}/`) : v;
                  acc._tag = last(v.split("/"));
                }
                return acc;
              }, {});
              return item;
            });
            if (!allValid) {
              throw new Error("CSV data and `filterKeys` mismatch");
            }
            let tree = createFiltersTree({
              data: parsed,
              activeFilters: [...activeFilters],
              path: [],
              keys: filterKeys,
              keysSort: filterKeysSortBy,
              getValue: (csvLineArray, key, keyIndex) => csvLineArray[keyIndex]
            });
            return tree;
          });
          _FILTER_TREE_CACHE[url] = fetchPromise;
          return fetchPromise;
        });
      }
      function updateTagValidityEarly() {
        if (isFitmentWidget) {
          afterOptionsUpdate({ fromCache: true });
        }
      }
      function afterHydrate() {
        rootNode.setAttribute("data-ezs-loaded", "true");
      }
      function main() {
        return __async(this, null, function* () {
          if (preClearCache) {
            clearAllCache();
          }
          updateTagValidityEarly();
          return prepareFilterTree().then((tree) => __async(this, null, function* () {
            filterTree = tree;
            setupListeners(selects);
          })).then(() => {
            afterHydrate();
          });
        });
      }
      return main().then(() => {
        return {
          filterTree,
          getActiveFilters() {
            return [...activeFilters];
          },
          updateFilterValue,
          clearAllCache,
          destory() {
            selects.forEach((select) => {
              select.options.length = 1;
            });
            onDestroyListeners.forEach((f) => f());
            onDestroyListeners.length = 1;
          }
        };
      });
    });
  }
  var styles = "";
  window.EZSearchDefaultInstances = [];
  function initializeEZSearch() {
    const searchRoots = Array.from(document.querySelectorAll('[data-ezs="search"]:not([data-ezs-auto-initialize="false"])'));
    searchRoots.forEach((rootNode) => {
      document.dispatchEvent(new CustomEvent("EZSearch_Loading", {
        detail: rootNode
      }));
      hydrateEZSearch({
        rootNode,
        onEvent: null
      }).then((instance) => {
        window.EZSearchDefaultInstances.push(instance);
        document.dispatchEvent(new CustomEvent("EZSearch_Loaded", {
          detail: rootNode
        }));
      });
    });
  }
  domReady().then(initializeEZSearch);
  var index = {
    hydrate: hydrateEZSearch
  };
  return index;
});
//# sourceMappingURL=ezsearch.js.map
