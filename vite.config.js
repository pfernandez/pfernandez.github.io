import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { defineConfig, searchForWorkspaceRoot } from 'vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const elementsRoot = path.resolve(__dirname, '../elements')

export default defineConfig({
  server: {
    fs: {
      allow: [searchForWorkspaceRoot(process.cwd()), elementsRoot]
    }
  },
  assetsInclude: ['**/*.md']
})

