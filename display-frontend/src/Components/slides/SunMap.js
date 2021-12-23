/*
  Slide displaying global map of current sun position

  Uses images sniffed from timeanddate.com for map, sunrise-sunset.org for sunrise/sunset
*/


import React from 'react';
import Slide from './Slide.js';
import DynamicImage from '../DynamicImage.js';

const MAP_BASE_URL = 'https://www.timeanddate.com/scripts/sunmap.php'
const SUN_DATA_BASE_URL = 'https://api.sunrise-sunset.org/json'
const ANIMATION_LENGTH_HOURS = 3 // number of hours of sun history to show
const ANIMATION_DURATION_SECS = 5 // number of seconds for animation to real time to last
const ANIMATION_STEP_MINS = 15 // number of minutes to move up with each animation step
const ANIMATION_CYCLE_SECS = 15 // number of secs until animation restarts

class SunMap extends Slide {
  static requiredArgs = [
    'lat',
    'lng'
  ]

  constructor(props) {
    super(props)

    const realTime = new Date()

    this.state = {
      realTime,
      currentAnimationTime: null,
      animationInterval: null,
      animationRestartInterval: null
    }
  }

  show() {}

  hide() {}

  // can pass currentAnimationTime as arg if state not yet set
  triggerAnimation(realTime) {
    if (!realTime) realTime = this.state.realTime

    const currentAnimationTime = new Date(realTime)
    currentAnimationTime.setHours(realTime.getHours() - ANIMATION_LENGTH_HOURS)
    currentAnimationTime.setMinutes(0)

    const animationSteps = ANIMATION_LENGTH_HOURS*60 / ANIMATION_STEP_MINS
    const animationDelay = ANIMATION_DURATION_SECS*1000 / animationSteps
    this.updateAnimation(currentAnimationTime)
    const animationInterval = setInterval(this.updateAnimation.bind(this), animationDelay)

    this.setState({
      currentAnimationTime,
      animationInterval
    })
  }

  // can pass currentAnimationTime as arg if state not yet set
  updateAnimation(currentAnimationTime) {
    const {
      realTime,
      animationInterval
    } = this.state

    if (!currentAnimationTime) currentAnimationTime = this.state.currentAnimationTime

    currentAnimationTime.setMinutes(currentAnimationTime.getMinutes() + ANIMATION_STEP_MINS)

    if (currentAnimationTime > realTime) {
      clearInterval(animationInterval)
      currentAnimationTime = realTime
    }

    const sunMapUrl = this.getSunMap(currentAnimationTime)

    this.setState({
      sunMapUrl,
      currentAnimationTime
    })
  }

  formatTime(value, size=2) {
    return String(value).padStart(size, '0')
  }

  // where time is a date Object  
  getSunMap(time) {
    const formattedDate = `${this.formatTime(time.getUTCFullYear(), 4)}${this.formatTime(time.getUTCMonth() + 1)}${this.formatTime(time.getUTCDate())}`
    const formattedTime = `${this.formatTime(time.getUTCHours())}${this.formatTime(time.getUTCMinutes())}`

    return `${MAP_BASE_URL}?iso=${formattedDate}T${formattedTime}&earth=1`
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
      lat,
      lng
    } = this.props

    this.triggerAnimation()
    const animationRestartInterval = setInterval(this.triggerAnimation.bind(this), ANIMATION_CYCLE_SECS*1000);

    const today = new Date()
    const yday = new Date(today)
    yday.setDate(today.getDate() - 1)
    const sunDataToday = await this.getSunData(lat, lng, today)
    const sunDataYday = await this.getSunData(lat, lng, yday)

    this.setState({
      animationRestartInterval,
      sunDataToday,
      sunDataYday
    })
  }

  content() {
    const {
      lat,
      lng
    } = this.props

    const {
      sunMapUrl,
      currentAnimationTime,
      realTime,
      sunDataToday,
      sunDataYday
    } = this.state

    let timeboxContent = ''
    if (currentAnimationTime) {
      const timeZoneParts = currentAnimationTime.toLocaleString('en-US', {timeZoneName: 'short'}).split(' ')
      const formattedAnimationTime = `${currentAnimationTime.toLocaleTimeString('en-US', {timeStyle: 'short'})} ${timeZoneParts[timeZoneParts.length - 1]}`

      const timeDiffMins = (currentAnimationTime.valueOf() - realTime.valueOf())/1000/60
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
        return `${Math.floor(sunDurationHours)}:${this.formatTime(parseInt(sunDurationHours % 60))}`
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

    

    // for Equirectangular projection, see https://en.wikipedia.org/wiki/Equirectangular_projection#Forward
    const deg2rad = (deg) => parseFloat(deg) * (Math.PI / 180)
    const midCs2BlC2 = (valMidCs) => (valMidCs+1)/2 // Mid CS (x: -1,1, y: -1,1) to Bottom Left CS (x: 0,1, y: 0,1) conversion
    const standardLat = 0 // this seems to work well enough
    const locationBottomFrac = (parseFloat(lat)/90)
    const locationLeftFrac = (parseFloat(lng) / 180) * Math.cos(deg2rad(standardLat))

    return (
      <div class='message-slide'>
        <DynamicImage 
          src={sunMapUrl}
          maxWidth={window.innerWidth}
          maxWeight={window.innerHeight}
        />
        {sunDataContent}
        {timeboxContent}
        <div class='sunmap-point' style={{ bottom: `${midCs2BlC2(locationBottomFrac)*100}%`, left: `${midCs2BlC2(locationLeftFrac)*100}%`}}/>
      </div>
    )
  }
}

export default SunMap