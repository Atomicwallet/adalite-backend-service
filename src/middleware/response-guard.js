// @flow
import { InternalServerError } from 'restify-errors'
import config from '../config'
import { getInstanceHealthStatus } from '../healthcheck'

const {
  disableHealthcheck,
} = config.get('server')

function shouldBlockRequest(req: any): boolean {
  if (disableHealthcheck) {
    return false
  }

  const instanceHealthStatus = getInstanceHealthStatus()

  if (req.url === '/api/v2/healthcheck') {
    return !instanceHealthStatus.healthy
  } else if (['/api/v2/bestBlock', '/api/v2/healthStatus'].includes(req.url)) {
    // these requests are good to inspect the instance when it becomes unhealthy
    return false
  }

  // we give a grace period of 50s to the remaining requests so load balancer has time
  // to disable the instance without downtime
  const currentTime = Math.floor((new Date().getTime()) / 1000)

  if (instanceHealthStatus.healthy) {
    return false
  }

  return currentTime - (instanceHealthStatus.unhealthyFrom || 0) >= 50
}

function responseGuard(req: any, res: any, next: any) {
  if (shouldBlockRequest(req)) {
    return next(new InternalServerError(
      'The instance is unhealthy',
    ))
  }

  return next()
}

export default responseGuard
