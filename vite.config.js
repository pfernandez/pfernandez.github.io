import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { createLogger, defineConfig, searchForWorkspaceRoot } from 'vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const elementsRoot = path.resolve(__dirname, '../elements')
const logger = createLogger()
const warn = logger.warn

logger.warn = (message, options) => {
  if (message.includes('externalized for browser compatibility')) return
  warn(message, options)
}

export default defineConfig({
  customLogger: logger,
  server: {
    fs: {
      allow: [searchForWorkspaceRoot(process.cwd()), elementsRoot]
    }
  },
  assetsInclude: ['**/*.md'],
  build: {
    rollupOptions: {
      external: [
        /node:test/,
        /\.test\.js$/,
        /\.\.\/elements\/.*\.test\.js$/
      ]
    }
  }
})
