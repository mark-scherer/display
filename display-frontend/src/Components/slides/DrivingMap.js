/*
  Slide to display basic text message
*/

import React from 'react';
import { Promise as Bluebird } from 'bluebird'
import { randomElement, loadGoogleMapsLib } from '../../incl/utils.js'
import Slide from './Slide.js';
import DynamicImage from '../DynamicImage.js'
// import 'react-responsive-carousel/lib/styles/carousel.min.css'
// import { Carousel } from 'react-responsive-carousel'

// see https://developers.google.com/maps/documentation/javascript/style-reference
const mapStyles = [
  {
    featureType: 'administrative',
    elementType: 'labels',
    stylers: [
      { 'visibility': 'off'}
    ]
  },
  {
    featureType: 'water',
    elementType: 'labels',
    stylers: [
      { 'visibility': 'off'}
    ]
  },
  {
    featureType: 'poi',
    elementType: 'labels',
    stylers: [
      { 'visibility': 'off'}
    ]
  }
]

class DrivingMap extends Slide {
  static requiredArgs = [
    'title',
    'stops',
  ]

  constructor(props) {
    super(props)

    this.state = {
      // include state partially set in base Slide ctor
      ...this.state,

      // rendering controls
      mapStyles,

      // temporarily null rendering objects
      google: null,
      map: null,
      directions: null, // type google.maps.DirectionsResult, probably always want directions.routes[0] (type google.maps.DirectionsRoute)
      markers: null,    // markers[directionsIndex] = type google.maps.Marker <- directionsIndex = stopIndex + 1
      stopPhotos: null, // stopPhotos[stopIndex]: {filename: url}   // where stopIndex is props.stops[stopIndex] <- directionsInde = stopIndex + 1
      spotlightInterval: null,
      photoInterval: null,

      // rendering state variables
      directionsCenter: null,
      directionsZoom: null,
      lowLevelSpotlightState: false, // currently zoomed in or zoomed out spotlight? Always start with zoomed out
      spotlightStopIndex: null,
      spotlightConfig: null,
      spotlightPhotoUrl: null
    }
  }

  // format stop in config to be sent to Directions api
    // waypoint should be true except for origin and destination
  formatStop(stopConfig, waypoint = true) {
    if (waypoint) {
      return {
        location: stopConfig.location,
        stopover: true
      }
    } else {
      return stopConfig.location
    }
  }

  /* create MarkerOptions jsons for custom marker for given stop
    - returns list of jsons to create as markers
    - see MarkOptions docs: https://developers.google.com/maps/documentation/javascript/reference/marker#MarkerOptions
    - notes:
      - paths are drawn w/ center at (0, 0) so label is automatically centered within the icon
      - labelMarker is offset using labelMarkerAnchor
    - stopConfig options:
      - location: textual location to send to directions API
      - labelPosition: cardinal direction from location in which to place label
      - labelText: optional overwrite for default label text
      - locationText: stylized name for location
      - startDate: not currently used
      - endDate: not currently used
      - type: major or minor, controls marker styling
      - labelMarkerMargin: overwrite margin between pointMarker and labelMarker, useful for spacing out labels
  */
  formatMarkerOptions(stopConfig, position, index, spotlight, google) {
    // marker constants
      // distances are in icon.path's coordinate system
    const DEFAULT_LABEL_POSITON = 'north'
    const DEFAULT_TYPE = 'major'
    const MARKER_COLORS = [
      // 'lightblue',
      // 'darkseagreen',
      // 'wheat'
      'lightgray'
    ]

    // these props controlled by marker type
    const TYPE_CONFIGS = {
      major: {
        MIN_LABEL_WIDTH: 50,
        LABEL_PX_PER_CHAR: 10,
        LABEL_MARKER_HEIGHT: 30,
        LABEL_MARKER_MARGIN: 10,
        LABEL_FONT_SIZE: '18px',
        LABEL_FONT_WEIGHT: 'bold',
        POINT_MARKER_RADIUS: 3,
        POINT_MARKER_STROKE_WEIGHT: 3
      },
      minor: {
        MIN_LABEL_WIDTH: 50,
        LABEL_PX_PER_CHAR: 7.5,
        LABEL_MARKER_HEIGHT: 20,
        LABEL_MARKER_MARGIN: 8,
        LABEL_FONT_SIZE: '12px',
        LABEL_FONT_WEIGHT: 'normal',
        POINT_MARKER_RADIUS: 2,
        POINT_MARKER_STROKE_WEIGHT: 1.5
      }
    }

    // these props controlled by marker spotlight status
    const SPOTLIGHT_CONFIGS = {
      true: {
        fillColor: 'white',
        strokeOpacity: 1,
        strokeWeight: 2
      },
      false: {
        fillColor: MARKER_COLORS[index % MARKER_COLORS.length],
        strokeOpacity: 0
      }
    }

    // setup defaults
    if (!stopConfig.type) stopConfig.type = DEFAULT_TYPE
    if (!stopConfig.labelPosition) stopConfig.labelPosition = DEFAULT_LABEL_POSITON
    
    const typeConfig = TYPE_CONFIGS[stopConfig.type]
    if (!typeConfig) throw Error(`unsupported stopConfig.type: ${stopConfig.type}`)
    const spotlightConfig = SPOTLIGHT_CONFIGS[String(spotlight)]
    
    const dateText = stopConfig.startDate ?
      `${stopConfig.startDate}` + (stopConfig.endDate ?
        ` - ${stopConfig.endDate}` : '') + ': '
      : ''
    // const labelText = stopConfig.labelText || `${dateText}${stopConfig.locationText || stopConfig.location}`
    const labelText = stopConfig.labelText || stopConfig.locationText || stopConfig.location

    // total width, height of drawn svg in context of icon.path, icon.anchor
    const width = Math.max(typeConfig.MIN_LABEL_WIDTH, labelText.length*typeConfig.LABEL_PX_PER_CHAR) // jank but rough approximation of needed marker width
    const height = typeConfig.LABEL_MARKER_HEIGHT

    const labelMarkerMargin = stopConfig.labelMarkerMargin || typeConfig.LABEL_MARKER_MARGIN
    const northOffest = height/2 + labelMarkerMargin,
      eastOffest = -1*(width/2 + labelMarkerMargin),
      southOffset = -1*(height/2 + labelMarkerMargin),
      westOffset = width/2 + labelMarkerMargin

    // anchor is (left, up) translation applied to path in relation to location
    let labelMarkerAnchor
    if (stopConfig.labelPosition === 'north') labelMarkerAnchor = new google.maps.Point(0, northOffest)
    else if (stopConfig.labelPosition === 'northeast') labelMarkerAnchor = new google.maps.Point(eastOffest, northOffest)
    else if (stopConfig.labelPosition === 'east') labelMarkerAnchor = new google.maps.Point(eastOffest, 0)
    else if (stopConfig.labelPosition === 'southeast') labelMarkerAnchor = new google.maps.Point(eastOffest, southOffset)
    else if (stopConfig.labelPosition === 'south') labelMarkerAnchor = new google.maps.Point(0, southOffset)
    else if (stopConfig.labelPosition === 'southwest') labelMarkerAnchor = new google.maps.Point(westOffset, southOffset)
    else if (stopConfig.labelPosition === 'west') labelMarkerAnchor = new google.maps.Point(westOffset, 0)
    else if (stopConfig.labelPosition === 'northwest') labelMarkerAnchor = new google.maps.Point(westOffset, northOffest)
    else throw Error(`unrecognized labelPosition: ${JSON.stringify({ stop: stopConfig.location, labelPosition: stopConfig.labelPosition })}`)

    const labelMarkerPath = `M -${width/2} -${height/2} h ${width} v ${height} h -${width} Z` // width x height rectange centered at (0, 0)
    const pointMarkerPath = `m -${typeConfig.POINT_MARKER_RADIUS} -${typeConfig.POINT_MARKER_RADIUS} h ${2*typeConfig.POINT_MARKER_RADIUS} v ${2*typeConfig.POINT_MARKER_RADIUS} h -${2*typeConfig.POINT_MARKER_RADIUS} z` // 2*typeConfig.POINT_MARKER_RADIUS square
    // const pointMarkerPath = `
    //   m -${typeConfig.POINT_MARKER_RADIUS},0
    //   a ${typeConfig.POINT_MARKER_RADIUS},${typeConfig.POINT_MARKER_RADIUS} 0 1,0 ${2*typeConfig.POINT_MARKER_RADIUS},0
    //   a ${typeConfig.POINT_MARKER_RADIUS},${typeConfig.POINT_MARKER_RADIUS} 0 1,0 -${2*typeConfig.POINT_MARKER_RADIUS},0
    // ` // circle of typeConfig.POINT_MARKER_RADIUS

    return [
      // labelMarker
      {
        position,
        icon: {
          path: labelMarkerPath,
          anchor: labelMarkerAnchor,
          fillColor: spotlightConfig.fillColor,
          fillOpacity: 1,
          strokeOpacity: spotlightConfig.strokeOpacity,
          strokeWeight: spotlightConfig.strokeWeight
        },
        label: {
          text: labelText,
          fontSize: typeConfig.LABEL_FONT_SIZE,
          fontWeight: typeConfig.LABEL_FONT_WEIGHT
        },
        title: labelText
      },

      // pointMarker
      {
        position,
        icon: {
          path: pointMarkerPath,
          fillColor: spotlightConfig.fillColor,
          fillOpacity: 1,
          strokeOpacity: 1,
          strokeWeight: typeConfig.POINT_MARKER_STROKE_WEIGHT
        },
        title: labelText
      }
    ]
  }

  async createMap() {
    const {
      serverUrl,
      mapStyles,
    } = this.state
    
    const {
      stops
    } = this.props

    try {
      const google = await loadGoogleMapsLib(serverUrl)
      const directionsService = new google.maps.DirectionsService()
      const directionsRenderer = new google.maps.DirectionsRenderer({ suppressMarkers: true }) // need to create individual markers ourselves

      const map = new google.maps.Map(document.getElementById('driving-map'), {
        center: { lat: 37.77, lng: -122.39 },
        zoom: 8,
        mapTypeId: google.maps.MapTypeId.TERRAIN,
        styles: mapStyles,
        disableDefaultUI: true
      })
      directionsRenderer.setMap(map)
      
      let directionsResult, directionsCenter, directionsZoom
      if (stops.length >= 2) {
        directionsResult = await new Promise((resolve, reject) => {
          directionsService.route({
            origin: this.formatStop(stops[0], false),
            destination: this.formatStop(stops[stops.length - 1], false),
            waypoints: stops.slice(1, stops.length - 1).map(stopConfig => this.formatStop(stopConfig)),
            travelMode: google.maps.TravelMode.DRIVING
          }, (directionsResult, directionsStatus) => {
            
            if (directionsStatus === 'OK') {
              directionsRenderer.setDirections(directionsResult)
              resolve(directionsResult)
            }
            else reject(`error getting directions: ${ directionsStatus }`)
          })
        })

        map.fitBounds(directionsResult.routes[0].bounds) // need to explicity call to update map properties
        directionsCenter = map.getCenter()
        directionsZoom = map.getZoom()        
      }

      this.setState({
        google,
        map,
        directions: directionsResult,
        directionsCenter,
        directionsZoom,
      })

      this.createMapMarkers()
    } catch(error) {
      throw Error(`${this.constructor.name} ctor: error creating google map: ${error}`)
    }
  }

  // use arg for spotlightStopIndex so can call before updating state with new spotlightStopIndex
  createMapMarkers(spotlightStopIndex) {
    const {
      google,
      map,
      directions,
      markers: oldMarkers
    } = this.state

    const {
      stops
    } = this.props

    if (spotlightStopIndex === undefined || spotlightStopIndex === null) spotlightStopIndex = this.state.spotlightStopIndex // if not provided, check current state

    let newMarkers = []
    directions.routes[0].legs.forEach((directionsLeg, directionsIndex) => {
      const stopIndex = directionsIndex + 1
      try {
        // special case to add origin marker
        if (directionsIndex === 0) {
          this.formatMarkerOptions(stops[0], directionsLeg.start_location, 0, spotlightStopIndex === 0, google).forEach(markerOptions => {
            const originMarker = new google.maps.Marker(markerOptions)
            originMarker.setMap(map)
            newMarkers.push(originMarker)
          })    
        }

        this.formatMarkerOptions(stops[stopIndex], directionsLeg.end_location, stopIndex, spotlightStopIndex === stopIndex, google).forEach(markerOptions => {
          const marker = new google.maps.Marker(markerOptions)
          marker.setMap(map)
          newMarkers.push(marker)
        })
      } catch (error) {throw Error(`error creating map markers: ${JSON.stringify({ error: String(error), directionsLeg, directionsIndex, stopIndex })}`)}
    })

    // remove old markers
    if (oldMarkers) oldMarkers.forEach(marker => marker.setMap(null))

    this.setState({
      markers: newMarkers
    })

    // console.log(`createMarkers(): created markers: ${JSON.stringify({ markers: newMarkers.map(marker => {
    //   return {
    //     title: marker.getTitle(),
    //     position: marker.getPosition()
    //   }
    // }) })}`)
  }

  async fetchPhotos() {
    const {
      serverUrl,
    } = this.state
    
    const {
      stops
    } = this.props

    let stopPhotos = {}
    await Bluebird.map(stops, async (stopConfig, stopIndex) => {
      if (stopConfig.photosBucket && stopConfig.photosDir) {
        stopPhotos[stopIndex] = (await fetch(`${serverUrl}/storage/${stopConfig.photosBucket}/${stopConfig.photosDir}`).then(response => response.json())).files
      }
    })
    
    this.setState({
      stopPhotos
    })
    // console.log(`fetched stopPhotos: ${JSON.stringify({ stopPhotos })}`)
  }

  iteratePhoto(spotlightStopIndex) {
    const {
      stopPhotos
    } = this.state

    if (spotlightStopIndex === null || spotlightStopIndex === undefined) spotlightStopIndex = this.state.spotlightStopIndex

    if (stopPhotos && (spotlightStopIndex !== null && spotlightStopIndex !== undefined)) {
      const spotlightPhotos = stopPhotos[String(spotlightStopIndex)]
      const spotlightPhotoUrl = spotlightPhotos[randomElement(Object.keys(spotlightPhotos))]

      this.setState({
        spotlightPhotoUrl
      })
    }
  }

  async iterateSpotlight() {
    const {
      google,
      map,
      directions,
      directionsCenter,
      directionsZoom,
      markers,
      stopPhotos,
      photoInterval
    } = this.state

    const {
      lowLevelSpotlightFrac,
      lowLevelSpotlightConfig,
      highLevelSpotlightConfigs,
      stops,
      photoDuration
    } = this.props

    const eastSpotlight = {
      size: { height: lowLevelSpotlightConfig.size.height, width: lowLevelSpotlightConfig.size.width },
      offset:  { lat: 0, lng: -1*lowLevelSpotlightConfig.mapOffset.lng },
      margin: { top: lowLevelSpotlightConfig.margin.top, bottom: lowLevelSpotlightConfig.margin.bottom, left: lowLevelSpotlightConfig.margin.left }
    }
    const westSpotlight = {
      size: { height: lowLevelSpotlightConfig.size.height, width: lowLevelSpotlightConfig.size.width },
      offset:  { lat: 0, lng: 1*lowLevelSpotlightConfig.mapOffset.lng },
      margin: { top: lowLevelSpotlightConfig.margin.top, bottom: lowLevelSpotlightConfig.margin.bottom, right: lowLevelSpotlightConfig.margin.right }
    }

    const lowLevelSpotlightProps = {
      north: eastSpotlight,
      northeast: eastSpotlight,
      east: eastSpotlight,
      southeast: eastSpotlight,
      south: westSpotlight,
      southwest: westSpotlight,
      west: westSpotlight,
      northwest: westSpotlight
    }

    // check if ready for spotlights
    if (!directions || !markers || !stopPhotos) return

    // pick params for new spotlight
    const spotlightStopIndex = parseInt(randomElement(Object.keys(stopPhotos)))
    const lowLevelSpotlightState = Math.random() < lowLevelSpotlightFrac

    if (spotlightStopIndex === 0) throw Error(`iterateSpotlight(): cannot yet handle spotlightStopIndex === 0, need to implement conversion to directions origin data`)

    let spotlightConfig, newCenter, newZoom
    if (lowLevelSpotlightState) {
      const spotlightPosition = stops[spotlightStopIndex].labelPosition
      const spotlightProps = lowLevelSpotlightProps[spotlightPosition]
      const nominalCenter = directions.routes[0].legs[spotlightStopIndex - 1].end_location
      newCenter = new google.maps.LatLng(nominalCenter.lat() + spotlightProps.offset.lat, nominalCenter.lng() + spotlightProps.offset.lng)
      newZoom = lowLevelSpotlightConfig.zoom
      spotlightConfig = {
        ...lowLevelSpotlightConfig,
        size: spotlightProps.size,
        margin: spotlightProps.margin
      }
      // console.log(`setting spotlightConfig: ${JSON.stringify({ spotlightPosition, spotlightConfig })}`)
    } else {
      spotlightConfig = randomElement(highLevelSpotlightConfigs)
      newCenter = new google.maps.LatLng(directionsCenter.lat() + spotlightConfig.mapOffset.lat, directionsCenter.lng() + spotlightConfig.mapOffset.lng)
      newZoom = directionsZoom
    }
    
    // update spotlight
    map.setZoom(directionsZoom) // always zoom out before panning
    await Bluebird.delay(250)

    this.createMapMarkers(spotlightStopIndex)
    if (photoInterval) clearInterval(photoInterval)
    this.iteratePhoto(spotlightStopIndex)
    const newPhotoInterval = setInterval(this.iteratePhoto.bind(this), photoDuration*1000)

    map.panTo(newCenter)
    await Bluebird.delay(250)
    map.setZoom(newZoom)

    this.setState({
      lowLevelSpotlightState,
      spotlightStopIndex,
      spotlightConfig,
      photoInterval: newPhotoInterval
    })
  }

  async componentDidMount() {
    await this.createMap()
    this.show()
    await this.fetchPhotos()
  }

  show() {
    const {
      spotlightDuration
    } = this.props

    // let high-level overview without spotlight show initally
    setTimeout(() => {
      this.iterateSpotlight()
      const spotlightInterval = setInterval(this.iterateSpotlight.bind(this), spotlightDuration*1000)
      this.setState({
        spotlightInterval
      })
    }, 5000)
  }

  hide() {
    const {
      spotlightInterval
    } = this.state

    clearInterval(spotlightInterval)
  }

  content() {
    const {
      spotlightStopIndex,
      spotlightConfig,
      spotlightPhotoUrl
    } = this.state

    const {
      title,
      stops,
      defaultSpotlightConfig
    } = this.props

    const _spotlightConfig = {
      ...defaultSpotlightConfig,
      ...spotlightConfig
    }

    let spotlightElement = ''
    if (spotlightPhotoUrl && spotlightConfig) {
      const spotlightPadding = parseInt(_spotlightConfig.padding)
      const spotlightHeaderHeight = parseInt(_spotlightConfig.headerHeight)
      const spotlightImageMaxHeight = window.innerHeight * parseFloat(_spotlightConfig.size.height)/100 - 2*spotlightPadding - spotlightHeaderHeight
      const spotlightImageMaxWidth = window.innerWidth * parseFloat(_spotlightConfig.size.width)/100 - 2*spotlightPadding

      // console.log(`calculated max dimensions: ${JSON.stringify({ 
      //   _spotlightConfig, 
      //   spotlightPadding, 
      //   spotlightHeaderHeight, 
      //   innerHeight: window.innerHeight, 
      //   innerWidth: window.innerWidth,
      //   spotlightImageMaxHeight, 
      //   spotlightImageMaxWidth
      // })}`)

      spotlightElement = (
        <div 
          class='driving-map-spotlight-container'
          style={{ height: _spotlightConfig.size.height, width: _spotlightConfig.size.width, ..._spotlightConfig.margin }}
        >
          <div class='driving-map-spotlight'>
            <div 
              class='driving-map-spotlight-header'
              style={{ height: _spotlightConfig.headerHeight }}
            >
              {stops[spotlightStopIndex].locationText}
            </div>
            <div 
              class='driving-map-spotlight-carousel'
              style={{ padding: _spotlightConfig.padding }}
            >
              <DynamicImage 
                src={spotlightPhotoUrl}
                maxWidth={spotlightImageMaxWidth}
                maxHeight={spotlightImageMaxHeight}
              />
            </div>
          </div>
        </div>
      )
    }

    return (
      <div class='slide driving-map-container'>
        <div id='driving-map'></div>
        <div class='driving-map-title'>{title}</div>
        {spotlightElement}
      </div>
    )
  }
}

export default DrivingMap