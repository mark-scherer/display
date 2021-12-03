/*
  main 'frame' to host all slides
*/

import React from 'react';

// janky but for each slide must import AND add to SlideComponents
import Message from "./slides/Message.js"
const SlideComponents = {
  Message
}

const DEFAULT_CONFIG = 'dev.yaml'

class Display extends React.Component {
  constructor(props) {
    super(props)

    // first we need to grab the slides config yaml, stored in the url path
    // const splitPath = window.location.pathname.split('/')
    // const configName = splitPath.length > 0 ? splitPath[splitPath.length - 1] : null
    const configName = 'dev' // for now just hardcode config

    let config = null
    try {
      config = require(`../slideConfigs/${configName}.yaml`)   
    } catch {
      config = require(`../slideConfigs/${DEFAULT_CONFIG}`)   
    }

    if (config.slides === null || config.slides === undefined) throw Error(`config ${configName} missing required field: duration`)
    if (config.slides === null || config.slides === undefined) throw Error(`config ${configName} missing required field: slides`)
    if (!config.slides.length) throw Error(`config ${configName} has no slides`)
    config.slides.forEach((slideConfig, index) => {
      if (!SlideComponents[slideConfig.type]) throw Error(`config ${configName} specifies invalid slide type for slide #${index}: ${JSON.stringify({ type: slideConfig.type })}`)
    })

    const nextSlideInterval = setInterval(() => {
      let {
        config,
        currentSlideIndex
      } = this.state

      currentSlideIndex += 1
      if (currentSlideIndex >= config.slides.length) currentSlideIndex = 0

      this.setState({ currentSlideIndex })
    }, config.duration*1000)

    this.state = {
      configName,
      config,
      currentSlideIndex: 0,
      nextSlideInterval
    }
  }

  render() {
    const {
      configName,
      config,
      currentSlideIndex
    } = this.state

    const slideElements = config.slides.map((slideConfig, index) => {
      return React.createElement(SlideComponents[slideConfig.type], {
        ...slideConfig,
        displayed: currentSlideIndex === index
      })
    })
    
    return (
      <div class='display'>
        
        <div class='title'>
          {configName}
        </div>

        <div class='slide-container'>
          {slideElements}
        </div>
      </div>
    )
  }
}

export default Display