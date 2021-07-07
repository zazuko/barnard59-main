import { createWriteStream } from 'fs'
import { dirname, resolve } from 'path'
import { promisify } from 'util'
import { SpanStatusCode } from '@opentelemetry/api'
import rdf from 'rdf-ext'
import fromFile from 'rdf-utils-fs/fromFile.js'
import { finished } from 'readable-stream'
import findPipeline from './findPipeline.js'
import bufferDebug from './lib/bufferDebug.js'
import tracer from './lib/tracer.js'
import runner from './runner.js'

async function fileToDataset (filename) {
  return rdf.dataset().import(fromFile(filename))
}

function createOutputStream (output) {
  if (output === '-') {
    return process.stdout
  }

  return createWriteStream(output)
}

async function run (filename, { output, pipeline: iri, variable: variables, variableAll, verbose, enableBufferMonitor } = {}) {
  await tracer.startActiveSpan('barnard59 run', async span => {
    try {
      const level = ['error', 'info', 'debug'][verbose] || 'error'

      const dataset = await fileToDataset(filename)
      const ptr = findPipeline(dataset, iri)

      if (variableAll) {
        for (const [key, value] of Object.entries(process.env)) {
          variables.set(key, value)
        }
      }

      span.setAttribute('iri', ptr.value)

      const outputStream = createOutputStream(output)
      const { finished: runFinished, pipeline } = await runner(ptr, {
        basePath: resolve(dirname(filename)),
        level,
        outputStream,
        variables
      })

      if (enableBufferMonitor) {
        bufferDebug(pipeline)
      }

      await runFinished
      // TODO: this has some issues
      await promisify(finished)(outputStream)
    } catch (err) {
      span.recordException(err)
      span.setStatus({ code: SpanStatusCode.ERROR, message: err.message })
      throw err
    } finally {
      span.end()
    }
  })
}

export { run }
