/*
  Roatating Explore.org livecams
*/


import React from 'react';
import ReactPlayer from "react-player"
import Slide from './Slide.js';
import { randomElement, weightedRandomElement, convertTime, loadGoogleMapsLib } from '../../incl/utils.js'

const MAP_ELEMENT_ID = 'explore-livecam-map'
const MAP_ANIMATION_FREQ = 20 // in Hz
const MAP_ANIMATION_PAUSE = 3 // in seconds, before and after zoom animation

const MAP_STYLES = [
  {
    featureType: 'administrative.province',
    elementType: 'labels',
    stylers: [
      { 'visibility': 'off'}
    ]
  },
  {
    featureType: 'administrative.neighborhood',
    elementType: 'labels',
    stylers: [
      { 'visibility': 'off'}
    ]
  },
  {
    featureType: 'landscape.man_made',
    elementType: 'all',
    stylers: [
      { 'visibility': 'off'}
    ]
  },
  {
    featureType: 'road',
    elementType: 'labels',
    stylers: [
      { 'visibility': 'off'}
    ]
  },
  {
    featureType: 'poi',
    elementType: 'all',
    stylers: [
      { 'visibility': 'off'}
    ]
  }
]

class ExploreLivecam extends Slide {
  static requiredArgs = [
    'feedDuration',
    'detailDuration',
    'startInFactMode',    // start with detail as fact? otherwise starts with map
    'mapMaxZoom',         // min & max zoom are inclusive
    'mapMinZoom',
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
      detailFactMode: false, // true if detail should current show fact, otherwise shows map
      currentFact: null,
      detailInterval: null,
      google: null,
      map: null,
      mapStyles: MAP_STYLES,
      marker: null
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

    const {
      displayed   // recalcuate if displayed after fetch
    } = this.props

    console.log(`ExploreLivecam.fetchLiveFeeds: fetched ${Object.keys(feeds).length} feeds: ${JSON.stringify({ displayed, feeds })}`)

    if (displayed) this.show(feeds)

    this.setState({
      feeds
    })
  }

  iterateFeed(feeds) {
    const {
      google,
      map
    } = this.state

    if (!feeds) feeds = this.state.feeds

    if (!feeds) return

    const currentFeed = weightedRandomElement(Object.values(feeds), Object.values(feeds).map(feed => feed.currentViewers))
    
    if (map && google) this.updateMap(currentFeed.location.lat, currentFeed.location.lng)
    this.createDetailInterval(currentFeed)

    this.setState({
      currentFeed
    })

    return currentFeed
  }

  iterateDetail(currentFeed, prevDetailFactMode) {
    const {
      mapAnimationInterval
    } = this.state

    if (!currentFeed) currentFeed = this.state.currentFeed
    if (prevDetailFactMode === null || prevDetailFactMode === undefined) prevDetailFactMode = this.state.detailFactMode

    // special case: no feed yet loaded
    if (!currentFeed) return

    // special case: feed has no facts
    let detailFactMode, currentFact
    if (!currentFeed.facts || !currentFeed.facts.length) {
      detailFactMode = false
    } else {
      detailFactMode = !prevDetailFactMode

      // next will display fact
      if (detailFactMode) {
        currentFact = randomElement(currentFeed.facts)
        currentFact = currentFact.split('. ')[0]
      }
    }

    if (mapAnimationInterval) clearInterval(mapAnimationInterval)
    if (!detailFactMode) this.createMapAnimationInterval()

    this.setState({
      detailFactMode,
      currentFact
    })
  }

  // zooms out slowly over duration map is shown
  iterateMapAnimation() {
    const {
      detailDuration,
      mapMinZoom,
      mapMaxZoom
    } = this.props
    
    const {
      map,
      mapAnimationInterval
    } = this.state

    const steps = (detailDuration - (2*MAP_ANIMATION_PAUSE))*MAP_ANIMATION_FREQ 
    const stepValue = (mapMaxZoom - mapMinZoom)/steps
    
    let zoom = map.getZoom()
    zoom -= stepValue

    if (zoom <= mapMinZoom) {
      zoom = mapMinZoom
      clearInterval(mapAnimationInterval)
      this.setState({
        mapAnimationInterval: null
      })
    }

    map.setZoom(zoom)
    // console.log(`updated map zoom: ${JSON.stringify({zoom, mapMinZoom, mapMaxZoom })}`)
  }

  createFeedInterval(feeds) {
    const {
      feedDuration
    } = this.props

    let {
      feedInterval
    } = this.state

    if (feedInterval) clearInterval(feedInterval)

    const currentFeed = this.iterateFeed(feeds)
    feedInterval = setInterval(this.iterateFeed.bind(this), feedDuration*1000)

    this.setState({
      feedInterval,
      currentFeed
    })

    return currentFeed
  }

  createDetailInterval(currentFeed) {
    const {
      detailDuration,
      startInFactMode,
    } = this.props

    let {
      detailInterval
    } = this.state

    if (detailInterval) clearInterval(detailInterval)
    this.iterateDetail(currentFeed, !startInFactMode)
    detailInterval = setInterval(this.iterateDetail.bind(this), detailDuration*1000)

    this.setState({
      detailInterval
    })
  }

  createMapAnimationInterval() {
    const {
      mapMaxZoom
    } = this.props

    const {
      map
    } = this.state

    if (!map) return

    map.setZoom(mapMaxZoom)

    let mapAnimationInterval
    setTimeout(() => {
      // do this right before recreating interval to minimze potential for async overwrite of mapAnimationInterval
      mapAnimationInterval = this.state.mapAnimationInterval
      if (mapAnimationInterval) clearInterval(mapAnimationInterval)

      mapAnimationInterval = setInterval(this.iterateMapAnimation.bind(this), (1/MAP_ANIMATION_FREQ)*1000)
      
      this.setState({
        mapAnimationInterval
      })
    }, MAP_ANIMATION_PAUSE*1000)
  }

  async createMap() {
    const {
      serverUrl,
    } = this.props

    const {
      mapStyles
    } = this.state
    
    try {
      const google = await loadGoogleMapsLib(serverUrl)
      const map = new google.maps.Map(document.getElementById(MAP_ELEMENT_ID), {
        center: { lat: 37.77, lng: -122.39 },
        zoom: 8,
        mapTypeId: google.maps.MapTypeId.TERRAIN,
        styles: mapStyles,
        disableDefaultUI: true,
        keyboardShortcuts: false,
        isFractionalZoomEnabled: true // fraction zoom only allowed in 'v=beta'
      })

      this.setState({
        google,
        map
      })
    } catch (error) {
      throw Error(`ExploreLivecam: error creating map: ${error}`)
    }
  }

  updateMap(lat, lng) {
    const {
      google,
      map,
      marker: oldMarker
    } = this.state

    if (oldMarker) oldMarker.setMap(null)

    const position = new google.maps.LatLng(lat, lng)
    map.setCenter(position)
    const newMarker = new google.maps.Marker({
      position,
      map
    })

    this.setState({
      marker: newMarker
    })
  }

  async componentDidMount() {
    const {
      feedRefreshDuration
    } = this.props

    this.createMap()

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

  clearIntervals() {
    const {
      feedInterval,
      detailInterval,
      mapAnimationInterval,
    } = this.state

    clearInterval(feedInterval)
    clearInterval(detailInterval)
    clearInterval(mapAnimationInterval)
  }

  show(feeds) {
    this.clearIntervals()
    this.createFeedInterval(feeds)
  }

  hide() {
    const {
      updateFeedsOnHide
    } = this.state

    this.clearIntervals()

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
      detailFactMode,
      currentFact
    } = this.state

    let feedElement = (
      <div>
        <div>loading feeds!</div>
      </div>
    )
    let feedInfoElement = ''
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

      feedInfoElement = (
        <div class='explore-livecam-info'>
          <div class='explore-livecam-title'>{currentFeed.title}</div>
          <div class='explore-livecam-location'>{currentFeed.location.name}</div>
          <div class='explore-livecam-conditions'>
            <div>{convertTime(new Date(), currentFeed.location.timezone, { timeStyle: 'short' })}</div>
            <div>{parseInt(currentFeed.weather.tempF)}{String.fromCharCode(0xb0)}F & {currentFeed.weather.weatherShort}</div>
          </div>
        </div>
      )
    }

    let feedFactElement
    if (currentFact) {
      feedFactElement = (
        <div 
          className={`explore-livecam-fact feed-livecam-details ${detailFactMode ? '' : 'hidden'}`}
        >
          <div>{currentFact}</div>
        </div>
      )
    }
    const feedDetailElement = (
      <div>
        <div 
          id={MAP_ELEMENT_ID}
          className={`feed-livecam-details ${!currentFeed || detailFactMode ? 'hidden' : ''}`}
        ></div>
        {feedFactElement}
      </div>
    )

    return (
      <div class='slide'>
        {feedElement}
        {feedInfoElement}
        {feedDetailElement}
      </div>
    )
  }
}

export default ExploreLivecam