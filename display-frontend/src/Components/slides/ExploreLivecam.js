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

    this.setState({
      currentFeed
    })

    return currentFeed
  }

  iterateFact(currentFeed) {
    if (!currentFeed) currentFeed = this.state.currentFeed

    if (!currentFeed || !currentFeed.facts) return

    let currentFact = randomElement(currentFeed.facts)
    if (currentFact) currentFact = currentFact.split('. ')[0]

    this.setState({
      currentFact
    })
  }

  createFeedInterval() {
    let {
      feedDuration,
      feedInterval
    } = this.props

    if (feedInterval) clearInterval(feedInterval)

    const currentFeed = this.iterateFeed()
    feedInterval = setInterval(this.iterateFeed.bind(this), feedDuration*1000)

    this.setState({
      feedInterval
    })

    return currentFeed
  }

  createFactInterval(currentFeed) {
    let {
      factDuration,
      factInterval
    } = this.props

    if (factInterval) clearInterval(factInterval)

    this.iterateFact(currentFeed)
    factInterval = setInterval(this.iterateFact.bind(this), factDuration*1000)

    this.setState({
      factInterval
    })
  }

  async componentDidMount() {
    await this.fetchLiveFeeds()

    const {
      displayed
    } = this.props

    if (displayed) this.show()
  }

  show() {
    const currentFeed = this.createFeedInterval()
    this.createFactInterval(currentFeed)
  }

  hide() {
    const {
      feedInterval,
      factInterval
    } = this.state

    clearInterval(feedInterval)
    clearInterval(factInterval)
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
        <div class='explore-livecam-feed'>
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