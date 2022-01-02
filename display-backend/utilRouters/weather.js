/*
  weather specific endpoints
*/

const Router = require('@koa/router')
const fetch = require('node-fetch')
const _ = require('lodash')
const Bluebird = require('bluebird')
const { getApiKey } = require('../incl/utils.js')

const CURRENT_WEATHER_URL = 'https://api.openweathermap.org/data/2.5/weather'
const WEATHER_CONCURRENCY = 32

const router = new Router({ prefix: '/weather' })

const openWeatherKey = getApiKey('openWeather')

// get current weather for a list of lat/lng points
  // body must include {locations: [{lat, lng}, ...]}
  // response: {requestIndex: {weatherData}, ...}
router.post('/current', async (ctx, next) => {
  console.log(`/weather/current got request!: ${JSON.stringify({ requestBody: ctx.request.body })}`)
  
  const locations = ctx.request.body.locations
  if (!locations) ctx.throw(400, 'no locations field found in request')
  if (!locations.length) ctx.throw(400, 'no locations specified')

  let result = {}
  await Bluebird.map(locations, async (loc, index) => {
    const {lat, lng} = loc
    if (lat === null || lat === undefined) ctx.throw(404, `location missing param: lat: ${JSON.stringify({ index, loc })}`)
    if (lng === null || lng === undefined) ctx.throw(404, `location missing param: lng: ${JSON.stringify({ index, loc })}`)

    const rawData = await fetch(`${CURRENT_WEATHER_URL}?appid=${openWeatherKey}&units=imperial&lat=${lat}&lon=${lng}`).then(response => response.json())
    if (rawData.cod !== 200) ctx.throw(rawData.cod, rawData.message)

    const data = {
      timestamp: (new Date(rawData.dt*1000)).toUTCString(),
      location: {
        city: rawData.name,
        lat: rawData.coord.lat,
        lng: rawData.coord.lon,
      },

      weatherShort: rawData.weather[0].main.toLowerCase(),
      weatherLong: rawData.weather[0].description.toLowerCase(),
      weatherIcon: rawData.weather[0].icon,

      ..._.pick(rawData.main, ['temp', 'pressure', 'humidity']),
      feelsLike: rawData.main.feels_like,

      windSpeed: rawData.wind.speed,
      windDir: rawData.wind.deg,
      windGustSpeed: rawData.wind.gust,

      cloudCover: rawData.clouds.all,

      sunrise: (new Date(rawData.sys.sunrise*1000)).toUTCString(),
      sunset: (new Date(rawData.sys.sunset*1000)).toUTCString(),
    }

    result[index] = data
  }, {concurrency: WEATHER_CONCURRENCY})

  ctx.body = result
})

module.exports = router