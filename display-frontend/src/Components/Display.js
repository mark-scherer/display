/*
  main 'frame' to host all slides
*/

import React from 'react';

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
    // const urlParams = new URLSearchParams(window.location.search)
    // const configName = urlParams.get('who')

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
        slideWidth: window.innerWidth,
        slideHeight: window.innerHeight
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

    this.iterateSlide(true, true, config)

    document.addEventListener('keydown', this.handleKeyDown.bind(this))
    window.addEventListener('resize', this.handleResize.bind(this))

    this.setState({
      config
    })
  }

  render() {
    const {
      configName,
      config,
      currentSlideIndex,
      fullscreen,
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
        displayed: currentSlideIndex === index,
        slideWidth,
        slideHeight
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