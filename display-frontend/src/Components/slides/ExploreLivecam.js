/*
  Roatating Explore.org livecams
*/


import React from 'react';
import ReactPlayer from "react-player"
import Slide from './Slide.js';
import { randomElement, weightedRandomElement, convertTime } from '../../incl/utils.js'

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
      serverUrl
    } = this.props

    this.setState({
      feeds: null
    })
    
    const feeds = await fetch(`${serverUrl}/exploreLivecam/livefeeds`).then(response => response.json())
    console.log(`fetched livefeeds: ${JSON.stringify({ feeds })}`)

    const {
      displayed   // recalcuate if displayed after fetch
    } = this.props

    if (displayed) this.show(feeds)

    this.setState({
      feeds
    })
  }

  iterateFeed(feeds) {
    if (!feeds) feeds = this.state.feeds

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

  createFeedInterval(feeds) {
    let {
      feedDuration,
      feedInterval
    } = this.props

    if (feedInterval) clearInterval(feedInterval)

    const currentFeed = this.iterateFeed(feeds)
    feedInterval = setInterval(this.iterateFeed.bind(this), feedDuration*1000)

    this.setState({
      feedInterval,
      currentFeed
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

    // this.createMap()

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

  show(feeds) {
    const currentFeed = this.createFeedInterval(feeds)
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
          <div class='explore-livecam-title'>{currentFeed.title}</div>
          <div class='explore-livecam-location'>{currentFeed.location}</div>
          <div class='explore-livecam-conditions'>
            <div>{convertTime(new Date(), currentFeed.timezone, { timeStyle: 'short' })}</div>
            <div>{parseInt(currentFeed.weather.tempF)}{String.fromCharCode(0xb0)}F & {currentFeed.weather.weatherShort}</div>
          </div>
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