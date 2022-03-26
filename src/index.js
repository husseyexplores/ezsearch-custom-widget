import { domReady } from './utils'
import { hydrateEZSearch } from './ez-search'
import './styles.scss'

const IS_PROD = import.meta.env.MODE !== 'development'

window.EZSearchDefaultInstances = []

function initializeEZSearch() {
  const searchRoots = Array.from(
    document.querySelectorAll('[data-ezs="search"]:not([data-ezs-auto-initialize="false"])'),
  )

  searchRoots.forEach(rootNode => {
    document.dispatchEvent(
      new CustomEvent('EZSearch_Loading', {
        detail: rootNode,
      }),
    )

    hydrateEZSearch({
      rootNode,
      autoSearch: false,
      cacheSeconds: 300,
      hasCsvHeaders: false,
      onEvent: IS_PROD
        ? null
        : (ev, data) => {
            let value = data?.select?.value
            value ? console.log(ev, data, value) : console.log(ev, data)
          },
    }).then(instance => {
      window.EZSearchDefaultInstances.push(instance)

      document.dispatchEvent(
        new CustomEvent('EZSearch_Loaded', {
          detail: rootNode,
        }),
      )
    })
  })
}

domReady().then(initializeEZSearch)

export default {
  hydrate: hydrateEZSearch,
}
