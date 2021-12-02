/*
  main 'frame' to host all slides
*/

import React from 'react';

const DEFAULT_CONFIG = 'dev.yaml'

class Display extends React.Component {
  constructor(props) {
    super(props)
    // first we need to grab the slides config yaml, stored in the url path
    // const splitPath = window.location.pathname.split('/')
    // const configName = splitPath.length > 0 ? splitPath[splitPath.length - 1] : null
    const configName = 'dev'

    let config = null
    try {
      config = require(`../slideConfigs/${configName}.yaml`)   
    } catch {
      console.error(`error loading config: ${configName}`)
      config = require(`../slideConfigs/${DEFAULT_CONFIG}`)   
    }

    this.state = {
      config
    }
  }

  render() {
    const {
      config
    } = this.state
    
    return <h2>{JSON.stringify(config)}</h2>
  }
}

export default Display