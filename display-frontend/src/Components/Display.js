/*
  main 'frame' to host all slides
*/

import React from 'react';
import { timeDiffInSecs, secsTilNextTimeOccurance } from '../incl/utils.js'

// janky but for each slide must import AND add to SlideComponents
import Message from "./slides/Message.js"
import DrivingMap from "./slides/DrivingMap.js"
import SunMap from "./slides/SunMap.js"
// import FlightRadar from "./slides/FlightRadar.js"
import ExploreLivecam from "./slides/ExploreLivecam.js"
const SlideComponents = {
  Message,
  DrivingMap,
  SunMap,
  // FlightRadar,
  ExploreLivecam
}

const DEFAULT_CONFIG = 'dev.yaml'

class Display extends React.Component {
  constructor(props) {
    super(props)

    const splitPath = window.location.pathname.split('/')
    const configName = splitPath.length > 0 ? splitPath[splitPath.length - 1] : null

    // route requests to actual backend server, not where frontend server from during dev
    const serverUrl = process.env.NODE_ENV === 'development' ? 
      `${window.location.protocol}//${window.location.hostname}:8000` : // just hard coding server port during dev
      `${window.location.protocol}//${window.location.host}`

    this.state = {
      configName,
      serverUrl,
      config: null,
      currentSlideIndex: -1,
      currentSlideDuration: null,
      nextSlideInterval: null,
      fullscreen: false,
      darkMode: false,
      slideWidth: window.innerWidth,
      slideHeight: window.innerHeight,
      darkModeStart: null,
      darkModeEnd: null
    }
  }

  toggleFullscreen() {
    const {
      fullscreen
    } = this.state

    if (fullscreen) {
      document.exitFullscreen()
        .catch(error => { throw Error(`error exiting fullscreen: ${error.name}: ${error.message}`) })
    } else {
      const element = document.getElementsByClassName('display')[0]
      element.requestFullscreen()
        .catch(error => { throw Error(`error opening fullscreen: ${error.name}: ${error.message}`) })
    }

    this.setState({
      fullscreen: !fullscreen
    })
  }

  /*
    params
      recreateSlideInterval: force iterateSlide interval to be recreated, should be true if called on arrow key inputs
      forward: iterate one slide foward? If not then backwards
      config: optional arg to set config instead of reading from state, useful if config not yet set in state
  */
  iterateSlide(recreateSlideInterval=false, forward=true, config=null) {
    let {
      currentSlideIndex,
      currentSlideDuration,
      nextSlideInterval
    } = this.state

    if (!config) config = this.state.config

    if (!config || !config.slides || !config.slides.length) return

    if (forward) {
      currentSlideIndex += 1
      if (currentSlideIndex >= config.slides.length) currentSlideIndex = 0
    } else {
      currentSlideIndex -= 1
      if (currentSlideIndex < 0) currentSlideIndex = config.slides.length - 1
    }

    const nextSlideDuration = config.slides[currentSlideIndex].duration || config.duration
    if (nextSlideDuration !== currentSlideDuration || recreateSlideInterval) {
      clearInterval(nextSlideInterval)
      nextSlideInterval = setInterval(this.iterateSlide.bind(this), nextSlideDuration*1000)
    }

    this.setState({ 
      currentSlideIndex,
      currentSlideDuration: nextSlideDuration,
      nextSlideInterval
    })
  }

  handleKeyDown(event) {
    if (event.keyCode === 39) this.iterateSlide(true, true) // forward arrow
    else if (event.keyCode === 37) this.iterateSlide(true, false) // backward arrow
    
    event.stopPropagation()
  }

  handleResize() {
    this.setState({
      slideWidth: window.innerWidth,
      slideHeight: window.innerHeight
    })
  }

  checkDarkMode(darkModeStart, darkModeEnd) {
    if (!darkModeStart) darkModeStart = this.state.darkModeStart
    if (!darkModeEnd) darkModeEnd = this.state.darkModeEnd

    if (!darkModeStart || !darkModeEnd) return

    const currentTime = new Date()
    const darkMode = timeDiffInSecs(currentTime, darkModeEnd) <= 0 || timeDiffInSecs(currentTime, darkModeStart) >= 0

    console.log(`switching to ${darkMode ? 'darkMode' : 'lightMode'}: ${JSON.stringify({ 
      currentTime: currentTime.toLocaleTimeString(),
      darkModeStart: darkModeStart ? darkModeStart.toLocaleTimeString() : 'null',
      darkModeEnd: darkModeEnd ? darkModeEnd.toLocaleTimeString() : 'null'
    })}`)

    this.setState({
      darkMode
    })
  }

  /*
    rerun darkMode check, schedule timeout to recheck at next switch time
  */
  checkAndRescheduleDarkModeTimeout(darkModeStart, darkModeEnd) {
    if (!darkModeStart) darkModeStart = this.state.darkModeStart
    if (!darkModeEnd) darkModeEnd = this.state.darkModeEnd

    let {
      darkModeTimeout
    } = this.state

    if (!darkModeStart || !darkModeEnd) return

    this.checkDarkMode(darkModeStart, darkModeEnd)

    const currentTime = new Date()
    clearTimeout(darkModeTimeout)
    const nextDarkModeStart = secsTilNextTimeOccurance(currentTime, darkModeStart)
    const nextDarkModeEnd = secsTilNextTimeOccurance(currentTime, darkModeEnd)
    const nextSwitch = Math.min(nextDarkModeStart, nextDarkModeEnd)  + 1 // delay til slightly after scheduled switch to ensure method run within next window
    darkModeTimeout = setTimeout(this.checkAndRescheduleDarkModeTimeout.bind(this), nextSwitch*1000)

    console.log(`scheduled next darkMode switch for ${(new Date(currentTime.valueOf() + nextSwitch*1000)).toString()} (+${nextSwitch} secs)`)
    this.setState({
      darkModeTimeout
    })
  }

  async componentDidMount() {
    const {
      configName,
      serverUrl
    } = this.state

    // resolve config
    let config
    try {
      config = await fetch(`${serverUrl}/config/${configName}`).then(data => data.json())
    } catch (error) {
      console.error(`error fetching config: ${JSON.stringify({ configName, error: String(error) })}`)
      this.setState({
        config: { notFound: true }
      })
      return
    }
    
    // validate config
    if (config.slides === null || config.slides === undefined) throw Error(`config ${configName} missing required field: duration`)
    if (config.slides === null || config.slides === undefined) throw Error(`config ${configName} missing required field: slides`)
    if (!config.slides.length) throw Error(`config ${configName} has no slides`)
    config.slides.forEach((slideConfig, index) => {
      if (!SlideComponents[slideConfig.type]) throw Error(`config ${configName} specifies invalid slide type for slide #${index}: ${JSON.stringify({ type: slideConfig.type })}`)
    })

    // initate render
    this.iterateSlide(true, true, config)

    // setup darkMode, darkModeTimeout
    const parseDarkModeTime = (input, name) => {
      const inputRegex = new RegExp('^[0-9]{1,2}:[0-9]{1,2}$')
      if (!inputRegex.test(input)) throw Error(`invalid config input: darkMode.${name}: ${input} (should be HH:MM)`)
      const [hours, mins] = input.split(':').map(val => parseInt(val))
      if (!(hours >= 0 && hours <= 23)) throw Error(`invalid config input: darkMode.${name}: ${input} (hours value not 0-23)`)
      if (!(mins >= 0 && mins <= 59)) throw Error(`invalid config input: darkMode.${name}: ${input} (mins value not 0-59)`)

      let result = new Date(0)
      result.setHours(hours)
      result.setMinutes(mins)
      return result
    }

    let darkModeStart, darkModeEnd
    if (config.darkMode) {
      if (!config.darkMode.start) throw Error(`missing config input: darkMode.start (should be HH:MM)`)
      if (!config.darkMode.end) throw Error(`missing config input: darkMode.start (should be HH:MM)`)

      darkModeStart = parseDarkModeTime(config.darkMode.start, 'start')
      darkModeEnd = parseDarkModeTime(config.darkMode.end, 'end')
    }

    this.checkAndRescheduleDarkModeTimeout(darkModeStart, darkModeEnd)

    // display-wide event handlers
    document.addEventListener('keydown', this.handleKeyDown.bind(this))
    window.addEventListener('resize', this.handleResize.bind(this))

    this.setState({
      config,
      darkModeStart,
      darkModeEnd
    })
  }

  render() {
    const {
      configName,
      config,
      currentSlideIndex,
      fullscreen,
      darkMode,
      slideWidth,
      slideHeight,
      serverUrl
    } = this.state

    // handle loading, config not found states
    let errorMsg
    if (!config) errorMsg = `loading ${configName}...`
    else if (config.notFound) errorMsg = `didn't find ${configName}... double check the end of the url?`
    
    if (errorMsg) {
      return (
        <div class='error-msg-container'>
          <div>{errorMsg}</div>
        </div>
      )
    }

    // create slide elements
    const slideElements = config.slides.map((slideConfig, index) => {
      return React.createElement(SlideComponents[slideConfig.type], {
        ...slideConfig,
        serverUrl,
        darkMode,
        slideWidth,
        slideHeight,
        displayed: currentSlideIndex === index,
      })
    })
    
    return (
      <div class='display'>
        <div class='slide-carousel-container'>
          <div 
            class='slide-carousel-content'
            style={{ marginLeft: `-${currentSlideIndex*slideWidth}px` }}
          >
            {slideElements}
          </div>
        </div>
          <img 
            class='fullscreen' 
            onClick={() => this.toggleFullscreen()}
            src={fullscreen ? 'https://img.icons8.com/windows/32/000000/compress.png' : 'https://img.icons8.com/windows/32/000000/fit-to-width--v1.png'}
          />
      </div>
    )
  }
}

export default Display