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
        nextSlideInterval: null,
        fullscreen: false
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

  iterateSlide(forward, config) {
    let {
      currentSlideIndex
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

    console.log(`iterating slide: ${JSON.stringify({ forward, currentSlideIndex })}`)

    this.setState({ 
      currentSlideIndex
    })
  }

  handleKeyDown(event) {
    if (event.keyCode === 39) this.iterateSlide(true) // forward arrow
    else if (event.keyCode === 37) this.iterateSlide(false) // backward arrow
    
    event.stopPropagation()
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

    // create slide interval
    this.iterateSlide(true, config)
    const nextSlideInterval = setInterval(this.iterateSlide.bind(this, true), config.duration*1000)

    document.addEventListener('keydown', this.handleKeyDown.bind(this))

    this.setState({
      config,
      // nextSlideInterval
    })
  }

  render() {
    const {
      configName,
      config,
      currentSlideIndex,
      fullscreen,
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
        displayed: currentSlideIndex === index
      })
    })
    
    return (
      <div class='display'>
        {/* <div class='title'>
          {configName}
        </div> */}

        <div class='slide-container'>
          {slideElements}
          <img 
            class='fullscreen' 
            onClick={() => this.toggleFullscreen()}
            src={fullscreen ? 'https://img.icons8.com/windows/32/000000/compress.png' : 'https://img.icons8.com/windows/32/000000/fit-to-width--v1.png'}
          />
        </div>
      </div>
    )
  }
}

export default Display