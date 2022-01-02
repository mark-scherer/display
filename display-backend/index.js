/*
  display backend!
*/

const path = require('path')
const Koa = require('koa')
const serve = require('koa-static')
const cors = require('@koa/cors')
const send = require('koa-send')
const bodyParser = require('koa-bodyparser')
const router = require('./router.js')

const PORT = 8000
const BUILD_DIR = '../display-frontend/build'

const app = new Koa()

const main = async function() {
  app
    .use(cors())
    .use(bodyParser())
    .use(router.routes(), router.allowedMethods())
    .use(serve(path.join(__dirname, BUILD_DIR)))
    .use(async (ctx) => {
      if (ctx.status === 404) await send(ctx, 'index.html', { root: BUILD_DIR }) // send homepage on 404s
    })

  app.listen(PORT)
  console.log(`server listening on http://localhost:${PORT}`)
}

main()
  // .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })