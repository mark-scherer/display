/*
  Roatating Explore.org livecams
*/


import React from 'react';
import ReactPlayer from "react-player"
import Slide from './Slide.js';
import { randomElement, weightedRandomElement } from '../../incl/utils.js'

class ExploreLivecam extends Slide {
  static requiredArgs = [
    'feedDuration',
    'factDuration',
    'feedRefreshDuration'
  ]

  constructor(props) {
    super(props)

    this.state = {
      feeds: null,
      refreshFeedInterval: null,
      updateFeedsOnHide: null,
      currentFeed: null,
      feedInterval: null,
      currentFact: null,
      factInterval: null
    }
  }

  async fetchLiveFeeds() {
    const {
      serverUrl,
      displayed
    } = this.props

    this.setState({
      feeds: null
    })
    
    const feeds = await fetch(`${serverUrl}/exploreLivecam/livefeeds`).then(response => response.json())

    if (displayed) this.show()

    this.setState({
      feeds
    })
  }

  iterateFeed() {
    const {
      feeds
    } = this.state

    if (!feeds) return

    const currentFeed = weightedRandomElement(Object.values(feeds), Object.values(feeds).map(feed => feed.currentViewers))

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
    const {
      feedRefreshDuration
    } = this.props

    await this.fetchLiveFeeds()

    const refreshFeedInterval = setInterval(() => {
      this.setState({
        updateFeedsOnHide: true
      })
    }, feedRefreshDuration*1000);

    this.setState({
      refreshFeedInterval
    })
  }

  show() {
    const currentFeed = this.createFeedInterval()
    this.createFactInterval(currentFeed)
  }

  hide() {
    const {
      feedInterval,
      factInterval,
      updateFeedsOnHide
    } = this.state

    clearInterval(feedInterval)
    clearInterval(factInterval)

    if (updateFeedsOnHide) {
      this.fetchLiveFeeds()
      this.setState({
        updateFeedsOnHide: false
      })
    }
  }

  content() {
    const {
      currentFeed,
      currentFact
    } = this.state

    let feedElement = (
      <div class='slide'>
        <div>loading feeds!</div>
      </div>
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
      <div class='slide'>
        {feedElement}
        {feedMetadataElement}
        {feedFactElement}
      </div>
    )
  }
}

export default ExploreLivecam