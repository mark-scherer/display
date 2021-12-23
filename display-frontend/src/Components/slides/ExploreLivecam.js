/*
  Roatating Explore.org livecams
*/


import React from 'react';
import ReactPlayer from "react-player"
import Slide from './Slide.js';
import { randomElement } from '../../incl/utils.js'

class ExploreLivecam extends Slide {
  static requiredArgs = [
    'feedDuration',
    'factDuration'
  ]

  constructor(props) {
    super(props)

    this.state = {
      feeds: null
    }
  }

  show() {}

  hide() {}

  async fetchLiveFeeds() {
    const {
      serverUrl
    } = this.props
    
    const feeds = await fetch(`${serverUrl}/exploreLivecam/livefeeds`).then(response => response.json())

    this.setState({
      feeds
    })
  }

  iterateFeed() {
    const {
      feeds
    } = this.state

    if (!feeds) return

    const currentFeed = randomElement(Object.values(feeds))
    console.log(`iterating current feed: ${JSON.stringify({ currentFeed })}`)

    this.setState({
      currentFeed
    })
  }

  iterateFact() {
    const {
      currentFeed
    } = this.state
    console.log(`trying to iterate fact: ${JSON.stringify({ facts: currentFeed ? currentFeed.facts : null })}`)

    if (!currentFeed || !currentFeed.facts) return

    const currentFact = randomElement(currentFeed.facts).split('.')[0]
    console.log(`iterated fact: ${JSON.stringify({ currentFact })}`)

    this.setState({
      currentFact
    })
  }

  componentDidMount() {
    const {
      feedDuration,
      factDuration
    } = this.props

    this.fetchLiveFeeds()

    this.iterateFeed()
    const feedInterval = setInterval(this.iterateFeed.bind(this), feedDuration*1000)

    this.iterateFact()
    const factInterval = setInterval(this.iterateFact.bind(this), factDuration*1000)

    this.setState({
      feedInterval,
      factInterval
    })
  }

  content() {
    const {
      currentFeed,
      currentFact
    } = this.state

    let feedElement = (
      <div>loading feeds!</div>
    )
    let feedMetadataElement = '', feedFactElement = ''
    if (currentFeed) {
      const feedUrl = `${currentFeed.feedUrl}&mute=1&enablejsapi=1`
      feedElement = (
        <div>
          <ReactPlayer 
            url={feedUrl}
            playing={true}
            muted={true}
            width={window.innerWidth}
            height={window.innerHeight}
          />
        </div>
      )

      feedMetadataElement = (
        <div class='explore-livecam-metadata'>
          <div>{currentFeed.title}</div>
          <div class='explore-livecam-location'>{currentFeed.location}</div>
        </div>
      )
    }
    if (currentFact) {
      feedFactElement = (
        <div class='explore-livecam-fact'>
          <div>{currentFact}</div>
        </div>
      )
    }
    

    return (
      <div class='message-slide'>
        {feedElement}
        {feedMetadataElement}
        {feedFactElement}
      </div>
    )
  }
}

export default ExploreLivecam