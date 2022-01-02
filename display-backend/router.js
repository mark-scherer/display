const path = require('path')
const fs = require('fs')
const YAML = require('js-yaml')
const _ = require('lodash')
const Router = require('@koa/router')
const { getApiKey } = require('./incl/utils.js')

// router name: loaded router file
const slideRouters = {
  exploreLivecam: require('./slideRouters/exploreLivecam.js')
}

// router name: loaded router file
const utilRouters = {
  storage: require('./utilRouters/storage.js'),
  weather: require('./utilRouters/weather.js')
}

const router = new Router()

const CONFIG_DIR = path.join(__dirname, 'slideConfigs')

const CONFIGS = _.fromPairs(_.map(fs.readdirSync(CONFIG_DIR), fullFilename => {
  const splitFilename = fullFilename.split('.')
  const filename = splitFilename.slice(0, splitFilename.length - 1)
  return [filename, path.join(CONFIG_DIR, fullFilename)]
}))

router.use(async (ctx, next) => {
  const start = new Date()
  console.log(`${start.toString()}: got request: ${JSON.stringify(_.pick(ctx, ['method', 'path', 'query']))}`)

  try {
    await next()
  } catch (error) {
    console.log(`koa-router throwing error: ${error}`)
    ctx.throw(error)
  }

  const end = new Date()
  console.log(`${end.toString()}: finished processing request: ${JSON.stringify({
    ..._.pick(ctx, ['method', 'path', 'query']),
    elapsedTime: `${end - start}ms`
  })}`)
})

router.get('/config/:config', async (ctx, next) => {
  if (CONFIGS[ctx.params.config]) ctx.body = YAML.load(fs.readFileSync(CONFIGS[ctx.params.config]))
  else ctx.throw(404, `config ${ctx.params.config} not found`)
})

router.get('/apiKey/:service', (ctx, next) => {
  let key
  try {
    key = getApiKey(ctx.params.service)
  } catch (error) {
    ctx.throw(404, error)
  }

  ctx.body = { key }
})

// add slideRouters
_.forEach(slideRouters, (subRouter, prefix) => {
  router.use(
    subRouter.routes(),
    subRouter.allowedMethods()
  )
})

// add utilRouters
_.forEach(utilRouters, (subRouter, prefix) => {
  router.use(
    subRouter.routes(),
    subRouter.allowedMethods()
  )
})

module.exports = router