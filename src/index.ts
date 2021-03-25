import { normalizePath, Plugin } from 'vite'
import { parse as parseImports } from 'es-module-lexer'
import MagicString from 'magic-string'


const CLIENT_ENTRY = require.resolve('vite/dist/client/client.js')
const normalizedClientEntry = normalizePath(CLIENT_ENTRY)
const polyfillString = `const p = ${polyfill.toString()};p();`


export default function devDynamicImportPolyfillPlugin(): Plugin {
  let shouldSkip = false
  return {
    name: 'vite:dev-dynamic-import-polyfill',

    configResolved(config) {
      shouldSkip = config.command === 'build' || config.isProduction
    },

    transform(code, id) {
      if (id === normalizedClientEntry) {
        const imports = parseImports(code)[0].filter((i) => i.d > -1)
        const s = new MagicString(code)

        for (let index = 0; index < imports.length; index++) {
          const { d: dynamicIndex } = imports[index]
          s.overwrite(dynamicIndex, dynamicIndex + 6, `__import__`)
        }
        s.prepend(polyfillString)
        return s.toString()
      }
    },
  }
}



/**
The following polyfill function is meant to run in the browser and adapted from
https://github.com/GoogleChromeLabs/dynamic-import-polyfill

MIT License

Copyright (c) 2018 uupaa and 2019 Google LLC

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
*/

declare const self: any
declare const location: any
declare const document: any
declare const URL: any
declare const Blob: any

function polyfill(modulePath = '.', importFunctionName = '__import__') {
  try {
    self[importFunctionName] = new Function('u', `return import(u)`)
  } catch (error) {
    const baseURL = new URL(modulePath, location)
    const cleanup = (script: any) => {
      URL.revokeObjectURL(script.src)
      script.remove()
    }

    self[importFunctionName] = (url: string) =>
      new Promise((resolve, reject) => {
        const absURL = new URL(url, baseURL)

        // If the module has already been imported, resolve immediately.
        if (self[importFunctionName].moduleMap[absURL]) {
          return resolve(self[importFunctionName].moduleMap[absURL])
        }

        const moduleBlob = new Blob(
          [
            `import * as m from '${absURL}';`,
            `${importFunctionName}.moduleMap['${absURL}']=m;`
          ],
          { type: 'text/javascript' }
        )

        const script = Object.assign(document.createElement('script'), {
          type: 'module',
          src: URL.createObjectURL(moduleBlob),
          onerror() {
            reject(new Error(`Failed to import: ${url}`))
            cleanup(script)
          },
          onload() {
            resolve(self[importFunctionName].moduleMap[absURL])
            cleanup(script)
          }
        })

        document.head.appendChild(script)
      })

    self[importFunctionName].moduleMap = {}
  }
}
