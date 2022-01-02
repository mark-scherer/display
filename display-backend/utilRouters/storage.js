/*
  weather specific endpoints
*/

const Router = require('@koa/router')
const Bluebird = require('bluebird')
const {Storage} = require('@google-cloud/storage')

const storage = new Storage({keyFilename: '/etc/keys/displayGoogleSA.json'})

const router = new Router({ prefix: '/storage' })

router.get('/:bucket/:dir', async (ctx, next) => {
    console.log(`got request for storage contents at: ${ctx.params.bucket}/${ctx.params.dir}`)
  
    const signedUrlOptions = {
      version: 'v2', // v4 allows at most a 7 day expiration
      action: 'read',
      expires: Date.now() + 365*24*60*60*1000 // valid for 1 year
    }
  
    const [files] = await storage.bucket(ctx.params.bucket).getFiles({prefix: ctx.params.dir})
    let urls = {}
    await Bluebird.map(files, async file => {
      if (file.name[file.name.length - 1] !== '/') urls[file.name] = (await file.getSignedUrl(signedUrlOptions))[0]
    })
  
    ctx.body = {files: urls}
    await next()
  })

module.exports = router