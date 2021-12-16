/*
  display backend!
*/

const path = require('path')
const Koa = require('koa')
const serve = require('koa-static')
const cors = require('@koa/cors')
const router = require('./router.js')

const PORT = 8000
const BUILD_DIR = '../display-frontend/build'

const app = new Koa()

const main = async function() {
  app
    .use(serve(path.join(__dirname, BUILD_DIR)))
    .use(cors())
    .use(router.routes(), router.allowedMethods())

  app.listen(PORT)
  console.log(`server listening on http://localhost:${PORT}`)
}

main()
  // .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })