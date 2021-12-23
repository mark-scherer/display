const path = require('path')
const fs = require('fs')
const YAML = require('js-yaml')
const _ = require('lodash')
const Bluebird = require('bluebird')
const Router = require('@koa/router')
const {Storage} = require('@google-cloud/storage')

// router name: loaded router file
const slideRouters = {
  exploreLivecam: require('./slideRouters/exploreLivecam.js')
}

const router = new Router()
const storage = new Storage({keyFilename: '/etc/keys/displayGoogleSA.json'})

const API_KEYS = require('/etc/keys/displayApis.json')
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

router.get('/storage/:bucket/:dir', async (ctx, next) => {
  console.log(`got request for storage contents at: ${ctx.params.bucket}/${ctx.params.dir}`)

  const signedUrlOptions = {
    version: 'v4',
    action: 'read',
    expires: Date.now() + 604800 // max allowes expiration is 7 days
  }

  const [files] = await storage.bucket(ctx.params.bucket).getFiles({prefix: ctx.params.dir})
  console.log(`got ${files.length} files`)
  let urls = {}
  await Bluebird.map(files, async file => {
    if (file.name[file.name.length - 1] !== '/') urls[file.name] = (await file.getSignedUrl(signedUrlOptions))[0]
  })

  ctx.body = {files: urls}
  await next()
})

router.get('/apiKey/:service', (ctx, next) => {
  if (!API_KEYS[ctx.params.service]) ctx.throw(404, 'unsupported service')
  ctx.body = {key: API_KEYS[ctx.params.service]}
})

_.forEach(slideRouters, (slideRouter, prefix) => {
  router.use(
    slideRouter.routes(),
    slideRouter.allowedMethods()
  )
})

module.exports = router