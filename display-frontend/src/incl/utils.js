import { Loader } from "@googlemaps/js-api-loader"
import * as chroma from "chroma-js"

// cause I hate JS for loops
  // start inclusive, end exclusive
const range = function(start, end) {
  return Array(end - start).map((element, index) => start + index)
}

const randomIndex = function(list) {
  return Math.floor(Math.random() * list.length)
}

const randomElement = function(list) {
  return list[randomIndex(list)]
}

// weights do not need to add to 1
const weightedRandomElement = function(list, weights) {
  if (list.length !== weights.length) throw Error(`weightedRandomElement: list and weights must be same length: ${JSON.stringify({ listLength: list.length, weightsLength: weights.length })}`)
  if (list.length === 0) return null

  let runningTotal = 0
  const cumulativeWeights = weights.map(w => {
    runningTotal += w
    return runningTotal
  })

  // special case where all proabilities equal 0
  if (runningTotal === 0) return randomElement(list)

  const r = Math.random() * runningTotal

  let pickedIndex
  cumulativeWeights.forEach((cw, index) => {
    if ((pickedIndex === null || pickedIndex === undefined) && cw > r) {
      pickedIndex = index
      // break
    }
  })

  return list[pickedIndex]
}

const chunk = function(list, chunkSize, repeatSplitElements=false) {
  let result = []
  let chunkStart = 0
  while (chunkStart < list.length) {
    if (repeatSplitElements && chunkStart > 0) chunkStart -= 1
    
    result.push(list.slice(chunkStart, chunkStart + chunkSize))
    chunkStart += chunkSize
  }

  return result
}

/* 
  returns datetime converted to timezone formated with formatOptions
  - for formatOptions docs: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat/DateTimeFormat
*/
const convertTime = function(datetime, timezone, formatOptions) {
  const locationFormatter = new Intl.DateTimeFormat([], { timeZone: timezone, ...formatOptions })
  return locationFormatter.format(datetime)
}

/*
  round datetime to specified precison
*/
const roundTime = function(datetime, precision) {
  const result = new Date(datetime)

  if (precision === 'min') {
    if (result.getSeconds() >= 30) result.setMinutes(result.getMinutes() + 1)
    result.setSeconds(0)
  } else throw Error(`roundTime: specified precison not yet supported: ${precision}`)

  return result
}

/*
  returns time differences in seconds of datetimeA - datetimeB ignoring date portion, accounting for timezone differences
*/
const timeDiffInSecs = function(datetimeA, datetimeB) {
  // note this Date ctor needs inputs in local time not utc
  const _timeA = new Date(0, 0, 1, datetimeA.getHours(), datetimeA.getMinutes(), datetimeA.getSeconds())
  const _timeB = new Date(0, 0, 1, datetimeB.getHours(), datetimeB.getMinutes(), datetimeB.getSeconds())
  
  return (_timeA.valueOf() - _timeB.valueOf()) / 1000
}

/*
  ignoring date components, returns time in seconds starting at startDatetime's time until next occurance of targetDatetime's time accounting for timezone differences
*/
const secsTilNextTimeOccurance = function(startDatetime, targetDatetime) {
  let result = timeDiffInSecs(targetDatetime, startDatetime)
  if (result < 0) result = (60*60*24) + result // assume next occurance of datetimeB's time is 24 hours ahead of last occurance
  
  return result
}

const colorScale = function(colors, frac) {
  const scale = chroma.scale(colors)
  return scale(frac).hex()
}

const loadGoogleMapsLib = async function(serverUrl, version='weekly') {

  let google
  try {
    const {
      key: mapsApiKey
    } = await fetch(`${serverUrl}/apiKey/mapsApi`).then(response => response.json())

    const loader = new Loader({ 
      apiKey: mapsApiKey,
      version
    })
    google = await loader.load()
  } catch (error) {
    throw Error(`error loading google maps lib: ${JSON.stringify({ error: String(error), serverUrl })}`)
  }

  return google
}

export {
  range,
  randomIndex,
  randomElement,
  weightedRandomElement,
  chunk,

  convertTime,
  roundTime,
  timeDiffInSecs,
  secsTilNextTimeOccurance,

  colorScale,

  loadGoogleMapsLib
}