/*
  Slide displaying global map of current sun position

  Uses images sniffed from timeanddate.com for map, sunrise-sunset.org for sunrise/sunset
*/


import React from 'react';
import Slide from './Slide.js';
import DynamicImage from '../DynamicImage.js';

const MAP_SOURCE_GUIDE = {
  'timeanddate': {
    baseUrl: 'https://www.timeanddate.com/scripts/sunmap.php', // prospect IP got banned 12/24/21, contacted webmaster
    animate: true,
  },
  'opentopia': {
    baseUrl: 'http://images.opentopia.com/sunlight/world_sunlight_map_rectangular.jpg', // uses die.net
    animate: false
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
    'lat',
    'lng'
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
      animationRestartInterval: null
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

  async getSunData(lat, lng, date) {
    const formatReturnedTime = (returnedTime, date) => {
      const _date = new Date(date)
      const pm = returnedTime.split(' ')[1] === 'PM'
      const [hours, mins, secs] = returnedTime.split(' ')[0].split(':').map(timeComponent => parseInt(timeComponent))
      const adjustedHours = pm && hours !== 12 ? hours + 12 : hours
      _date.setUTCHours(adjustedHours)
      _date.setUTCMinutes(mins)
      _date.setUTCSeconds(secs)

      return _date
    }

    const formattedDate = `${this.formatTime(date.getFullYear(), 4)}-${this.formatTime(date.getMonth() + 1)}-${this.formatTime(date.getDate())}`
    const data = (await fetch(`${SUN_DATA_BASE_URL}?lat=${lat}&lng=${lng}&date=${formattedDate}`).then(response => response.json())).results

    const sunrise = formatReturnedTime(data.sunrise, date)
    const sunset = formatReturnedTime(data.sunset, date)
    return {
      sunrise,
      sunset,
      solarNoon: formatReturnedTime(data.solar_noon, date),
      sunDurationSecs: (sunset.valueOf() - sunrise.valueOf())/1000
    }
  }

  async componentDidMount() {
    const {
      displayed
    } = this.props
    if (displayed) this.show()
    
    const {
      lat,
      lng
    } = this.props

    const today = new Date()
    const yday = new Date(today)
    yday.setDate(today.getDate() - 1)
    const sunDataToday = await this.getSunData(lat, lng, today)
    const sunDataYday = await this.getSunData(lat, lng, yday)

    this.setState({
      sunDataToday,
      sunDataYday
    })
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
      lat,
      lng
    } = this.props

    const {
      mapSource,
      currentlyDisplayedTime,
      realTime,
      sunDataToday,
      sunDataYday
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
    if (sunDataToday && sunDataYday) {
      const today = new Date()
      const formattedDate = `${new Intl.DateTimeFormat('en-US', {month: 'short'}).format(today)} ${today.getDate()}`

      const sunDurationHoursToday = sunDataToday.sunDurationSecs / 60 / 60
      const sunDurationHoursYday = sunDataYday.sunDurationSecs / 60 / 60
      const sunDurationDifferenceHours = sunDurationHoursToday - sunDurationHoursYday
      const moreSun = sunDurationDifferenceHours > 0

      const formatSunDuration = (sunDurationHours) => {
        return `${Math.floor(sunDurationHours)}:${this.formatTime(parseInt((sunDurationHours*60) % 60))}`
      }

      sunDataContent = (
        <div class='sunmap-sundata'>
          <div>{formattedDate}</div>
          <table>
            <tbody>
              <tr>
                <td class='label'>sunrise:</td>
                <td>{sunDataToday.sunrise.toLocaleTimeString('en-US', {timeStyle: 'short'})}</td>
              </tr>
              <tr>
                <td class='label'>solar noon:</td>
                <td>{sunDataToday.solarNoon.toLocaleTimeString('en-US', {timeStyle: 'short'})}</td>
              </tr>
              <tr>
                <td class='label'>sunset:</td>
                <td>{sunDataToday.sunset.toLocaleTimeString('en-US', {timeStyle: 'short'})}</td>
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

    let lngAsFrac, latAsFrac
    const deg2rad = (deg) => parseFloat(deg) * (Math.PI / 180)
    const midCs2BlC2 = (valMidCs) => (valMidCs+1)/2 // Mid CS (x: -1,1, y: -1,1) to Bottom Left CS (x: 0,1, y: 0,1) conversion
    if (mapSource === 'timeanddate') {
      // for Equirectangular projection, see https://en.wikipedia.org/wiki/Equirectangular_projection#Forward
      const standardLat = 0 // this seems to work well enough
      latAsFrac = (parseFloat(lat)/90)
      lngAsFrac = (parseFloat(lng) / 180) * Math.cos(deg2rad(standardLat))
    } else if (mapSource === 'opentopia') {
      // seems to be mercator? can't get it to work so just make sure if offscreen
      latAsFrac = -1
      lngAsFrac = -1
    } else throw Error(`Sunmap.render(): location projections not implemented for mapSource: ${mapSource}`)

    console.log(`sunmap: got window dimensions: ${JSON.stringify({ width: window.innerWidth, height: window.innerHeight })}`)
    return (
      <div>
        <DynamicImage 
          src={sunMapUrl}
          maxWidth={window.innerWidth}
          maxHeight={window.innerHeight}
        >
          <div class='sunmap-point' style={{bottom: `${midCs2BlC2(latAsFrac)*100}%`, left: `${midCs2BlC2(lngAsFrac)*100}%`}}/>
        </DynamicImage>
        {sunDataContent}
        {timeboxContent}
      </div>
    )
  }
}

export default SunMap