const { resolve, join } = require('path')
const { readdirSync } = require('fs')
const esbuild = require('esbuild')

// Minify .js files after vite builds

let basePath = resolve(__dirname, './dist')
const filesToMinify = readdirSync(basePath).reduce((acc, filename) => {
  if (filename.endsWith('.js') && !filename.endsWith('.min.js')) {
    acc.push({
      filepath: join(basePath, filename),
      filename,
    })
  }
  return acc
}, [])

/**
 * @type {import('esbuild').BuildOptions[]}
 */
const esbuildConfs = filesToMinify.map(({ filename, filepath }) => {
  let filenameNoExt = filename.split(/\.js$/)[0]
  return {
    minify: true,
    entryPoints: [filepath],
    outfile: join(basePath, `${filenameNoExt}.min.js`),
  }
})

esbuildConfs.forEach(conf => {
  esbuild.buildSync(conf)
})
