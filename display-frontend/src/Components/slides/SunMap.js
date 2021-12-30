/*
  Slide displaying global map of current sun position

  Uses images sniffed from timeanddate.com for map, sunrise-sunset.org for sunrise/sunset
*/


import React from 'react';
import { Promise as Bluebird } from 'bluebird'
import Slide from './Slide.js';
import DynamicImage from '../DynamicImage.js';
import { convertTime, roundTime, timeDiffInSecs } from '../../incl/utils.js'

const MAP_SOURCE_GUIDE = {
  'timeanddate': {
    baseUrl: 'https://www.timeanddate.com/scripts/sunmap.php', // prospect IP got banned 12/24/21, contacted webmaster
    animate: true,
    projection: 'equirectangular',
    standardLat: 0
  },
  'opentopia': {
    baseUrl: 'http://images.opentopia.com/sunlight/world_sunlight_map_rectangular.jpg', // uses die.net
    animate: false,
    projection: 'mercator',
    northTruncationLat: 75,
    southTruncationLat: -75,
    eastTruncationLng: -170,
    westTruncationLng: 190, // shows entire earth but doesn't split at date line
  },
  // 'die.net': {
  //   baseUrl: 'https://static.die.net/earth/mercator/1000.jpg' // image doesn't render in tag, not yet fully implemented or tested... contacted webmaster on 12/24/21
  // },
  // 'tutiempo': {
  //   baseUrl: // is a canvas, would need to embed, could be complicated
  // } 
}

const SUN_DATA_BASE_URL = 'https://api.sunrise-sunset.org/json'

// animation params, when MAP_SOURCE_GUIDE[mapSource].animate === true
const ANIMATION_LENGTH_HOURS = 3 // number of hours of sun history to show
const ANIMATION_DURATION_SECS = 5 // number of seconds for animation to real time to last
const ANIMATION_STEP_MINS = 5 // number of minutes to move up with each animation step
const ANIMATION_CYCLE_SECS = 30 // number of secs until animation restarts

class SunMap extends Slide {
  static requiredArgs = [
    'mapSource',
    'originLocation',
    'dawnDuskDurationMins'
  ]

  constructor(props) {
    super(props)
    const {
      mapSource
    } = this.props

    if (!MAP_SOURCE_GUIDE[mapSource]) throw Error(`invalid mapSource prop: ${JSON.stringify({ mapSource, availableMapSources: Object.keys(MAP_SOURCE_GUIDE) })}`)

    this.state = {
      mapSource: mapSource, // want this to be state so can dynamically update if needed
      currentlyDisplayedTime: null,
      animationInterval: null,
      animationRestartInterval: null,
      sunDataRefetchTimeout: null // timeout to refetch sundata at midnight local
    }
  }

  // can pass realTime as arg if state not yet set
  triggerAnimation(realTime) {
    let {
      animationInterval
    } = this.state

    if (animationInterval) clearInterval(animationInterval)

    if (!realTime) realTime = this.state.realTime

    const currentlyDisplayedTime = new Date(realTime)
    currentlyDisplayedTime.setHours(realTime.getHours() - ANIMATION_LENGTH_HOURS)
    currentlyDisplayedTime.setMinutes(0)

    console.log(`Sunmap: creating animation starting at ${currentlyDisplayedTime}`)

    const animationSteps = ANIMATION_LENGTH_HOURS*60 / ANIMATION_STEP_MINS
    const animationDelay = ANIMATION_DURATION_SECS*1000 / animationSteps
    animationInterval = setInterval(this.updateAnimation.bind(this), animationDelay)

    this.setState({
      currentlyDisplayedTime,
      animationInterval
    })
  }

  // can pass currentlyDisplayedTime as arg if state not yet set
  updateAnimation(currentlyDisplayedTime) {
    const {
      realTime,
      animationInterval
    } = this.state

    if (!currentlyDisplayedTime) currentlyDisplayedTime = this.state.currentlyDisplayedTime

    currentlyDisplayedTime.setMinutes(currentlyDisplayedTime.getMinutes() + ANIMATION_STEP_MINS)
    console.log(`Sunmap: updating animation to ${currentlyDisplayedTime}`)

    if (currentlyDisplayedTime > realTime) {
      clearInterval(animationInterval)
      currentlyDisplayedTime = realTime
    }

    this.setState({
      currentlyDisplayedTime
    })
  }

  formatTime(value, size=2) {
    return String(value).padStart(size, '0')
  }

  // where time is a date Object  
  getSunMapUrl(time) {
    const {
      mapSource
    } = this.state

    const formattedDate = `${this.formatTime(time.getUTCFullYear(), 4)}${this.formatTime(time.getUTCMonth() + 1)}${this.formatTime(time.getUTCDate())}`
    const formattedTime = `${this.formatTime(time.getUTCHours())}${this.formatTime(time.getUTCMinutes())}`

    let url, baseUrl = MAP_SOURCE_GUIDE[mapSource].baseUrl
    if (mapSource === 'timeanddate') url = `${baseUrl}?iso=${formattedDate}T${formattedTime}&earth=1`
    else if (mapSource === 'die.net') url = baseUrl
    else if (mapSource === 'opentopia') url = baseUrl
    else throw Error(`SunMap.getSunMapUrl(): did not implement for mapSource: ${mapSource}`)

    return url
  }

  // get sun data for a single day at a single point 
  async getOneSunData(lat, lng, date) {
    const formatReturnedTime = (returnedTime, date) => {
      const _date = new Date(date)
      const pm = returnedTime.split(' ')[1] === 'PM'
      const [hours, mins, secs] = returnedTime.split(' ')[0].split(':').map(timeComponent => parseInt(timeComponent))

      let adjustedHours
      if (!pm && hours === 12) adjustedHours = 0
      if (!pm && hours !== 12) adjustedHours = hours
      if (pm && hours === 12) adjustedHours = 12
      if (pm && hours !== 12) adjustedHours = hours + 12

      _date.setUTCHours(adjustedHours)
      _date.setUTCMinutes(mins)
      _date.setUTCSeconds(secs)

      return _date
    }

    const formattedDate = `${this.formatTime(date.getFullYear(), 4)}-${this.formatTime(date.getMonth() + 1)}-${this.formatTime(date.getDate() + 1)}`
    const data = (await fetch(`${SUN_DATA_BASE_URL}?lat=${lat}&lng=${lng}&date=${formattedDate}`).then(response => response.json())).results

    const sunrise = formatReturnedTime(data.sunrise, date)
    const sunset = formatReturnedTime(data.sunset, date)

    return {
      sunrise: roundTime(sunrise, 'min'),
      sunset: roundTime(sunset, 'min'),
      solarNoon: roundTime(formatReturnedTime(data.solar_noon, date), 'min'),
      sunDurationSecs: (sunset.valueOf() - sunrise.valueOf()) / 1000
    }
  }

  async getAllSunData() {
    const {
      originLocation,
      otherLocations
    } = this.props

    const today = new Date()
    const yday = new Date(today)
    yday.setDate(today.getDate() - 1)

    let sunData = {
      originLocation: {
        today: await this.getOneSunData(originLocation.lat, originLocation.lng, today),
        yday: await this.getOneSunData(originLocation.lat, originLocation.lng, yday)
      }
    }
    await Bluebird.map(otherLocations, async locationInfo => {
      sunData[locationInfo.name] = await this.getOneSunData(locationInfo.lat, locationInfo.lng, today)
    })

    this.setState({
      sunData
    })
  }

  /*
    projects lat/lng into usable css bottom/left properties
    lat/lng
      lat: [-90, 90], 0 at equator
      lng: [-180, 180], 0 at prime meridian
    bottom/left
      bottom: [0%, 100%], 0 at bottom
      left: [0%, 100%], 0 at left
    - lat/lng's centered CS referred to as 'mid' or 'middle'
    - bottom/left's CS referred to as 'BL'
  */
  projectLatLng(lat, lng) {
    const deg2rad = (deg) => parseFloat(deg) * (Math.PI / 180)
    const notVisible = { bottom: '-100px', left: '-100px' }

    const {
      mapSource
    } = this.state

    if (!mapSource) return notVisible

    const {
      projection,
      standardLat,
      northTruncationLat,
      southTruncationLat,
      eastTruncationLng,
      westTruncationLng
    } = MAP_SOURCE_GUIDE[mapSource]

    let projectLat, projectLng // these are still using middle CS (liek lat/lng) but range is [-1, 1]
    if (projection === 'equirectangular') {
      // see https://en.wikipedia.org/wiki/Equirectangular_projection#Forward
      projectLat = (lat) => (parseFloat(lat)/90)
      projectLng = (lng) => (parseFloat(lng) / 180) * Math.cos(deg2rad(standardLat))

    } else if (projection === 'mercator') {
      // see https://en.wikipedia.org/wiki/Mercator_projection#Derivation
      projectLat = (lat) => Math.log(Math.tan( (Math.PI/4) + (deg2rad(lat)/2) ))
      projectLng = (lng) => (parseFloat(lng) / 180)
    } else throw Error(`Sunmap.render(): projection specified by mapSource not yet implemented: ${JSON.stringify({ mapSource, projection })}`)

    const nominalLatAsFrac = projectLat(lat)
    const nominalLngAsFrac = projectLng(lng)

    const projectedNorthTruncationLat = projectLat(northTruncationLat)
    const projectedSouthTruncationLat = projectLat(southTruncationLat)
    const projectedEastTruncationLng = projectLng(eastTruncationLng)
    const projectedWestTruncationLng = projectLng(westTruncationLng)

    const latAsFrac = (nominalLatAsFrac - projectedSouthTruncationLat) / (projectedNorthTruncationLat - projectedSouthTruncationLat)
    const lngAsFrac =  (nominalLngAsFrac - projectedEastTruncationLng) / (projectedWestTruncationLng - projectedEastTruncationLng)

    // console.log(`Sumnap.projectLatLng(): ${JSON.stringify({
    //   projection,
    //   lat,
    //   lng,
    //   nominalLatAsFrac,
    //   nominalLngAsFrac,
    //   latAsFrac,
    //   lngAsFrac,
    //   eastTruncationLng,
    //   westTruncationLng,
    //   northTruncationLat,
    //   southTruncationLat,
    //   projectedEastTruncationLng,
    //   projectedWestTruncationLng,
    //   projectedNorthTruncationLat,
    //   projectedSouthTruncationLat
    // })}`)

    return {
      bottom: `${latAsFrac*100}%`,
      left: `${lngAsFrac*100}%`
    }
  }

  // fetch current sundata and setup refetch at next midnight
  fetchAndRefetchSunData() {
    this.getAllSunData()

    const current = new Date(), nextFetch = new Date()
    nextFetch.setDate(current.getDate() + 1)
    nextFetch.setHours(0)
    nextFetch.setMinutes(0)
    nextFetch.setSeconds(0)

    const sunDataRefetchTimeout = setTimeout(this.fetchAndRefetchSunData.bind(this), nextFetch.valueOf() - current.valueOf())

    console.log(`set timeout to refetch sundata ${JSON.stringify({
      nextFetch: nextFetch.toLocaleString(),
      timeoutHours: (nextFetch.valueOf() - current.valueOf())/1000/60/60
    })}`)

    this.setState({
      sunDataRefetchTimeout
    })
  }

  async componentDidMount() {
    const {
      displayed
    } = this.props
    if (displayed) this.show()
    
    this.fetchAndRefetchSunData()
  }

  show() {
    let {
      mapSource,
      animationRestartInterval
    } = this.state

    const realTime = new Date()
    const currentlyDisplayedTime = realTime

    this.setState({
      realTime,
      currentlyDisplayedTime,
      animationRestartInterval,
    })

    if (MAP_SOURCE_GUIDE[mapSource].animate) {
      this.triggerAnimation(realTime)
      animationRestartInterval = setInterval(this.triggerAnimation.bind(this), ANIMATION_CYCLE_SECS*1000)
    }
  }

  hide() {
    const {
      animationRestartInterval
    } = this.state

    clearInterval(animationRestartInterval)
  }

  content() {
    const {
      originLocation,
      otherLocations,
      dawnDuskDurationMins
    } = this.props

    const {
      mapSource,
      currentlyDisplayedTime,
      realTime,
      sunData
    } = this.state

    let sunMapUrl,  timeboxContent = ''
    if (currentlyDisplayedTime) {
      sunMapUrl = this.getSunMapUrl(currentlyDisplayedTime)

      const timeZoneParts = currentlyDisplayedTime.toLocaleString('en-US', {timeZoneName: 'short'}).split(' ')
      const formattedAnimationTime = `${currentlyDisplayedTime.toLocaleTimeString('en-US', {timeStyle: 'short'})} ${timeZoneParts[timeZoneParts.length - 1]}`

      const timeDiffMins = (currentlyDisplayedTime.valueOf() - realTime.valueOf())/1000/60
      const timeDiffHours = Math.floor(timeDiffMins/60)
      const formattedTimeDiffHours = timeDiffHours < 0 ? `-${this.formatTime(Math.abs(timeDiffHours))}` : this.formatTime(timeDiffHours)
      const formattedTimeDiff = timeDiffMins !== 0 ?
        `${formattedTimeDiffHours}:${this.formatTime(Math.abs(timeDiffMins % 60))}` : null

      const timeDiffContent = formattedTimeDiff ? formattedTimeDiff : ''

      timeboxContent = (
        <div class='sunmap-timebox'>
          <div>{timeDiffContent}</div>
          <div>{formattedAnimationTime}</div>
        </div>
      )
    }

    let sunDataContent = ''
    if (sunData) {
      const today = new Date()
      const formattedDate = `${new Intl.DateTimeFormat('en-US', {month: 'short'}).format(today)} ${today.getDate()}`

      const sunDurationHoursToday = sunData.originLocation.today.sunDurationSecs / 60 / 60
      const sunDurationHoursYday = sunData.originLocation.yday.sunDurationSecs / 60 / 60
      const sunDurationDifferenceHours = sunDurationHoursToday - sunDurationHoursYday
      const moreSun = sunDurationDifferenceHours > 0

      const formatSunDuration = (sunDurationHours) => {
        const hours = Math.floor(sunDurationHours)
        const mins = Math.round(sunDurationHours*60) % 60

        return `${hours}:${this.formatTime(mins)}`
      }

      sunDataContent = (
        <div class='sunmap-sundata'>
          <div>{formattedDate}</div>
          <table>
            <tbody>
              <tr>
                <td class='label'>sunrise:</td>
                <td>{sunData.originLocation.today.sunrise.toLocaleTimeString('en-US', {timeStyle: 'short'})}</td>
              </tr>
              <tr>
                <td class='label'>solar noon:</td>
                <td>{sunData.originLocation.today.solarNoon.toLocaleTimeString('en-US', {timeStyle: 'short'})}</td>
              </tr>
              <tr>
                <td class='label'>sunset:</td>
                <td>{sunData.originLocation.today.sunset.toLocaleTimeString('en-US', {timeStyle: 'short'})}</td>
              </tr>
              <tr>
                <td class='label'>day length:</td>
                <td>{formatSunDuration(sunDurationHoursToday)} <span className={moreSun ? 'positive' : 'negative'}>({moreSun ? '+' : '-'}{formatSunDuration(sunDurationDifferenceHours)})</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      )
    }

    let locationPoints = ''
    if (originLocation && otherLocations && currentlyDisplayedTime && sunData) {
      const getLabelTimeClass = (currentlyDisplayedTime, sunrise, sunset, timezone) => {
        const localDisplayedTime = new Date(currentlyDisplayedTime.toLocaleString('en-US', { timeZone: timezone }))
        const localSunrise = new Date(sunrise.toLocaleString('en-US', { timeZone: timezone }))
        const localSunset = new Date(sunset.toLocaleString('en-US', { timeZone: timezone }))

        let labelTimeClass
        if (Math.abs(timeDiffInSecs(localDisplayedTime, localSunrise)) < (dawnDuskDurationMins * 60)/2) {
          labelTimeClass = 'dawn'
        } else if (Math.abs(timeDiffInSecs(localDisplayedTime, localSunset)) < (dawnDuskDurationMins * 60)/2) {
          labelTimeClass = 'dusk'
        } else if (timeDiffInSecs(localDisplayedTime, localSunrise) > 0 && timeDiffInSecs(localDisplayedTime, localSunset) < 0) {
          labelTimeClass = 'day'
        } else {
          labelTimeClass = 'night'
        }

        return labelTimeClass
      }

      locationPoints = otherLocations.map(location => {
        const locationTimeLabelClass = getLabelTimeClass(currentlyDisplayedTime, sunData[location.name].sunrise, sunData[location.name].sunset, location.timezone)
        return (
          <div 
            className={`sunmap-point secondary ${locationTimeLabelClass}`}
            style={this.projectLatLng(location.lat, location.lng)}
          >
            <div className={`sunmap-point-label ${location.labelLocation}`}>
              <div>{location.name}</div>
              <div>{convertTime(currentlyDisplayedTime, location.timezone, { timeStyle: 'short' })}</div>
            </div>
          </div>
        )
      })
  
      const originTimeLabelClass = getLabelTimeClass(currentlyDisplayedTime, sunData.originLocation.today.sunrise, sunData.originLocation.today.sunset, originLocation.timezone)
      locationPoints.push((
        <div 
          className={`sunmap-point primary ${originTimeLabelClass}`}
          style={this.projectLatLng(originLocation.lat, originLocation.lng)}
        />
      ))
    }

    return (
      <div class='slide'>
        <DynamicImage 
          src={sunMapUrl}
          maxWidth={window.innerWidth}
          maxHeight={window.innerHeight}
        >
          { locationPoints }
        </DynamicImage>
        {sunDataContent}
        {timeboxContent}
      </div>
    )
  }
}

export default SunMap