import { trace } from '@opentelemetry/api'

const tracer = trace.getTracer('barnard59')

export default tracer
