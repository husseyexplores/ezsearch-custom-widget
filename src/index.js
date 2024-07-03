import { domReady } from './utils'
import { hydrateEZSearch } from './ez-search'
import './styles.scss'

const IS_PROD = import.meta.env.MODE !== 'development'

window.EZSearchDefaultInstances = []

async function initializeEZSearch() {
  const searchRoots = Array.from(
    document.querySelectorAll(
      '[data-ezs="search"]:not([data-ezs-auto-initialize="false"])'
    )
  )

  searchRoots.forEach(async rootNode => {
    document.dispatchEvent(
      new CustomEvent('EZSearch_Loading', {
        detail: rootNode,
      })
    )

    const configUrl = rootNode.getAttribute('data-ezs-config-url')
    let dburl = rootNode.getAttribute('data-ezs-csv-url') || ''
    if (configUrl) {
      const result = await fetch(configUrl).then(res => res.json()).catch(e => null)
      if (result?.settings?.form?.db) {
        dburl = result.settings.form.db
      }
    }

    hydrateEZSearch({
      url: dburl,
      rootNode,
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
        })
      )
    })
  })
}

domReady().then(initializeEZSearch)

export default {
  hydrate: hydrateEZSearch,
}
