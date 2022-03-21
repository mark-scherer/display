/*
  Slide to display google maps driving directions and optionally highlight specific stops
*/

import React from 'react';
import { Promise as Bluebird } from 'bluebird'
import { randomElement, loadGoogleMapsLib, chunk } from '../../incl/utils.js'
import Slide from './Slide.js';
import DynamicImage from '../DynamicImage.js'

const WAYPOINTS_PER_DIRECTION_SEGMENT = 25 // if given more will split into multiple individial directions

/*
  stylers to adjust google maps appearance

  for docs see: https://developers.google.com/maps/documentation/javascript/style-reference
*/
const baseMapStyles = [
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
  },
  {
    featureType: 'road',
    elementType: 'all',
    stylers: [
      { 'visibility': 'simplified' }
    ]
  },
  {
    featureType: 'road',
    elementType: 'labels',
    stylers: [
      { 'visibility': 'off' }
    ]
  },
]

/*
  mods for specific 1) mapDisplayMode or 2) mapType (not implemented!)
*/
const mapMods = {
  darkMode: [
    {
      featureType: 'all',
      elementType: 'all',
      stylers: [
        { 'invert_lightness': true }
      ]
    },
    {
      featureType: 'water',
      elementType: 'geometry',
      stylers: [
        { 'color': '#010514' }
      ]
    },
    {
      featureType: 'landscape.landcover',
      elementType: 'geometry',
      stylers: [
        { 'lightness': -50 }
      ]
    }
  ]
}

// need to hardcode ids of the map elements we'll create
const MAP_DIV_ID = {
  lightMode: 'driving-map-light',
  darkMode: 'driving-map-dark',
}

/*
  slide to display map background, optionally with:
    1. overlaid google maps directions with custom stop markers
    2. rotating image highlights for each 
*/
class DrivingMap extends Slide {
  
  static requiredArgs = [
    'title',
    'stops',
    'downsampleRate', // should be a fraction (0-1]
    'mapType'
  ]

  constructor(props) {
    super(props)

    const {
      stops
    } = this.props

    this.state = {
      // include state partially set in base Slide ctor
      ...this.state,

      // temporarily null rendering objects
      google: null,
      maps: {},
      directionsRenderers: [],
      directionsResults: [], // each of type google.maps.DirectionsResult, probably always want directions.routes[0] (type google.maps.DirectionsRoute)
      markers: null,    // markers[directionsIndex] = type google.maps.Marker <- directionsIndex = stopIndex + 1
      stopPhotos: null, // stopPhotos[stopIndex]: {filename: url}   // where stopIndex is props.stops[stopIndex] <- directionsInde = stopIndex + 1
      spotlightInterval: null,
      photoInterval: null,

      // rendering state variables
      _stops: JSON.parse(JSON.stringify(stops)), // we need to add a few fields
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
  formatMarkerOptions(stopConfig, index, options, google) {
    const {
      spotlight,
      darkMode
    } = options

    // marker color scheme
    const COLOR_SCHEME = {
      lightMode: {
        primary: 'white',
        text: 'black'
      },
      darkMode: {
        primary: 'black',
        text: 'white'
      }
    }
    
    // marker constants
      // distances are in icon.path's coordinate system
    const DEFAULT_LABEL_POSITON = 'north'
    const DEFAULT_TYPE = 'major'

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

    const colorScheme = darkMode ? COLOR_SCHEME.darkMode : COLOR_SCHEME.lightMode

    // these props controlled by marker spotlight status
    const SPOTLIGHT_CONFIGS = {
      true: {
        fillColor: colorScheme.primary,
        strokeColor: colorScheme.text,
        strokeOpacity: 1,
        strokeWeight: 2
      },
      false: {
        fillColor: colorScheme.primary,
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
    const labelText = stopConfig.labelText || stopConfig.locationText || stopConfig.location.split(',')[0]

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
        position: stopConfig.position,
        icon: {
          path: labelMarkerPath,
          anchor: labelMarkerAnchor,
          fillColor: spotlightConfig.fillColor,
          fillOpacity: 1,
          strokeColor: spotlightConfig.strokeColor,
          strokeOpacity: spotlightConfig.strokeOpacity,
          strokeWeight: spotlightConfig.strokeWeight
        },
        label: {
          text: labelText,
          color: colorScheme.text,
          fontSize: typeConfig.LABEL_FONT_SIZE,
          fontWeight: typeConfig.LABEL_FONT_WEIGHT
        },
        title: labelText
      },

      // pointMarker
      {
        position: stopConfig.position,
        icon: {
          path: pointMarkerPath,
          fillColor: spotlightConfig.fillColor,
          fillOpacity: 1,
          strokeColor: spotlightConfig.strokeColor,
          strokeOpacity: 1,
          strokeWeight: typeConfig.POINT_MARKER_STROKE_WEIGHT
        },
        title: labelText
      }
    ]
  }

  // DEBUG: describes directions before and after downsampling
  describeDirectionsResult(directionsResult) {
    const legs = directionsResult.routes[0].legs
    const steps = legs.map(leg => leg.steps).flat()
    const pathPoints = steps.map(step => step.path || []).flat()
    const stepLatLngs = steps.map(step => step.lat_lngs || []).flat()
    const stepEncodedLatLngsSize = steps.reduce((acc, step) => acc + (step.encoded_lat_lngs ? step.encoded_lat_lngs.length : 0), 0) // step.encoded_lat_lngs is a string
    const stepPolylinePoints = steps.map(step => step.polyline || []).flat()
    const stepPolylineSize = stepPolylinePoints.reduce((acc, polylinePoint) => acc + polylinePoint.points.length, 0)
    const totalDistanceMiles = steps.reduce((acc, step) => acc + step.distance.value, 0) / 1000 * 0.62

    const stringified = JSON.stringify(directionsResult)
    const sizeInMBytes = new TextEncoder().encode(stringified).length / 1000 / 1000
    return {
      routes: directionsResult.routes.length,
      
      totalLegs: legs.length,
      
      totalSteps: steps.length,
      avgStepsPerLeg: Math.round(steps.length / legs.length),
      
      totalPathPoints: pathPoints.length,
      totalStepLatLngs: stepLatLngs.length, // this seemed to be deprecated but is probably large (https://developers.google.com/maps/documentation/javascript/reference/directions#DirectionsStep)
      pathPointsPerLeg: Math.round(pathPoints.length / legs.length),
      totalDistanceMiles: Math.round(totalDistanceMiles),
      // milesPerPathPoint: Math.round(totalDistanceMiles / pathPoints.length),
      pathPointsPerMile: Math.round(pathPoints.length / totalDistanceMiles),
      stepLatLngsPerMile: Math.round(stepLatLngs.length / totalDistanceMiles), // remember this is deprecated
      stepEncodedLatLngsSize, 
      totalStepPolylinePoints: stepPolylinePoints.length, // this seems to be deprecated
      stepPolylineSize,

      sizeInMBytes: Math.round(sizeInMBytes)
    }
  }

  // in place makes mem-saving mods to return of google.maps.DirectionsService.route()
  prepDirections(directionsResult) {
    const {
      downsampleRate
    } = this.props

    directionsResult.routes.forEach(route => {    // route: DirectionsRoute
      route.legs.forEach(leg => {                   // leg: DirectionsLeg
        leg.steps.forEach(step => {                   // step: DirectionsStep
          // clear deprecated fields
            // see: https://developers.google.com/maps/documentation/javascript/reference/directions#DirectionsStep
          step.lat_lngs = null // actually uses step.path
          step.polyline = null // actually uses step.encoded_lat_lngs
          step.encoded_lat_lngs = null // doesn't seem to actually use this for our purposes
          // step.path = null   // doesn't render blue line if this is null

          // downsample path
          const downsampled_path = []
          const downsample_step = Math.round(1/downsampleRate)
          step.path.forEach((point, index) => {
            let samplePoint = false
            
            // special cases 
            if (index === 0 || index === step.path.length - 1) samplePoint = true

            if (index % downsample_step === 0) samplePoint = true

            if (samplePoint) downsampled_path.push(point)
          })
          step.path = downsampled_path
        })
      })
    })
  }

  async createMap() {
    let {
      serverUrl,
      maps,
      directionsRenderers,
      directionsResults,
      _stops,
      directionsCenter,
      directionsZoom
    } = this.state
    
    const {
      darkMode,
      mapType
    } = this.props

    try {
      const google = await loadGoogleMapsLib(serverUrl)
      const directionsService = new google.maps.DirectionsService()

      const mapDisplayMode = darkMode ? 'darkMode' : 'lightMode'
      const styles = baseMapStyles.concat(mapMods[mapDisplayMode] || [])
      const mapElementId = darkMode ? MAP_DIV_ID[mapDisplayMode] : MAP_DIV_ID[mapDisplayMode]
      
      const map = new google.maps.Map(document.getElementById(mapElementId), {
        center: { lat: 37.77, lng: -122.39 },
        // zoom: 8,
        zoom: 11,
        mapTypeId: google.maps.MapTypeId[mapType],
        styles,
        backgroundColor: darkMode ? 'black' : 'white',
        disableDefaultUI: true,
        keyboardShortcuts: false
      })

      // create directions if not already made
      if (!directionsResults.length && _stops.length >= 2) {
        const stopSegments = chunk(_stops, WAYPOINTS_PER_DIRECTION_SEGMENT, true) // note retuns shallow copies

        let stopLatLngs = {} // store stop lat/lng to allow marker creation... need to key by index b/c order is not preserved
        await Bluebird.map(stopSegments, async (stopsSeg, directionsIndex) => {
          const segmentDirectionsRenderer = new google.maps.DirectionsRenderer({ suppressMarkers: true, preserveViewport: true }) // need to create individual markers ourselves
          await new Promise((resolve, reject) => {
            const originStop = stopsSeg[0]
            const destinationStop = stopsSeg[stopsSeg.length - 1]
            const waypointStops = stopsSeg.slice(1, stopsSeg.length - 1)

            directionsService.route({
              origin: this.formatStop(originStop, false),
              destination: this.formatStop(destinationStop, false),
              waypoints: waypointStops.map(stopConfig => this.formatStop(stopConfig)),
              travelMode: google.maps.TravelMode.DRIVING
            }, (segmentDirectionsResult, segmentDirectionsStatus) => {
              
              if (segmentDirectionsStatus === 'OK') {
                // DEBUG
                console.log(`got raw segmentDirectionsResult: ${JSON.stringify(this.describeDirectionsResult(segmentDirectionsResult))}`)
                this.prepDirections(segmentDirectionsResult)
                console.log(`prepped segmentDirectionsResult: ${JSON.stringify(this.describeDirectionsResult(segmentDirectionsResult))}`)

                const legs = segmentDirectionsResult.routes[0].legs
                const stopIndexOffset =  directionsIndex * WAYPOINTS_PER_DIRECTION_SEGMENT
                if (directionsIndex === 0) {
                  stopLatLngs[stopIndexOffset] = legs[0].start_location
                  legs.forEach((l, legIndex) => stopLatLngs[legIndex + stopIndexOffset + 1] = l.end_location)
                } else {
                  legs.forEach((l, legIndex) => stopLatLngs[legIndex + stopIndexOffset] = l.end_location)
                }
  
                segmentDirectionsRenderer.setDirections(segmentDirectionsResult)
                directionsRenderers.push(segmentDirectionsRenderer)
                directionsResults.push(segmentDirectionsResult)
                resolve()
              }
              else reject(`error getting directions segment ${directionsIndex}: ${ segmentDirectionsStatus }`)
            })
          })
        })

        _stops.forEach((s, stopIndex) => {s.position = stopLatLngs[stopIndex.toString()]})

        let bounds = new google.maps.LatLngBounds()
        directionsResults.forEach(segmentDirectionsResults => {
          bounds = bounds.union(segmentDirectionsResults.routes[0].bounds)
        })

        directionsRenderers.forEach(segmentDirectionsRenderer => segmentDirectionsRenderer.setMap(map))
        map.fitBounds(bounds)
        directionsCenter = map.getCenter()
        directionsZoom = map.getZoom()
      } else {
        // or just move existing directions to this new map
        directionsRenderers.forEach(segmentDirectionsRenderer => segmentDirectionsRenderer.setMap(map))
        map.setCenter(directionsCenter)
        map.setZoom(directionsZoom)
      }

      maps[mapDisplayMode] = map
      this.setState({
        google,
        maps,
        directionsRenderers,
        directionsResults,
        _stops,
        directionsCenter,
        directionsZoom
      })

      try {
        this.createMapMarkers()
      } catch (error) {
        throw Error(`error creating map markers: ${error}`)
      }
    } catch(error) {
      throw Error(`${this.constructor.name} ctor: error creating google map: ${error}`)
    }
  }

  // use arg for spotlightStopIndex so can call before updating state with new spotlightStopIndex
  createMapMarkers(spotlightStopIndex) {
    const {
      google,
      maps,
      directionsResults,
      _stops,
      markers: oldMarkers
    } = this.state

    const {
      darkMode
    } = this.props

    if (!directionsResults.length) return

    if (spotlightStopIndex === undefined || spotlightStopIndex === null) spotlightStopIndex = this.state.spotlightStopIndex // if not provided, check current state

    const currentMap = maps[darkMode ? 'darkMode' : 'lightMode']

    let newMarkers = []
    _stops.forEach((s, stopIndex) => {
      try {
        const options = {
          spotlight: spotlightStopIndex === stopIndex,
          darkMode
        }
        this.formatMarkerOptions(s, stopIndex, options, google).forEach(markerOptions => {
          const marker = new google.maps.Marker(markerOptions)
          marker.setMap(currentMap)
          newMarkers.push(marker)
        })
      } catch (error) {throw Error(`error creating map markers: ${JSON.stringify({ error: String(error), stopIndex })}`)}
    })

    // remove old markers
    if (oldMarkers) oldMarkers.forEach(marker => marker.setMap(null))

    this.setState({
      markers: newMarkers
    })
  }

  async fetchPhotos() {
    const {
      serverUrl,
      _stops
    } = this.state
    

    let stopPhotos = {}
    await Bluebird.map(_stops, async (stopConfig, stopIndex) => {
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
      stopPhotos,
    } = this.state

    if (spotlightStopIndex === null || spotlightStopIndex === undefined) spotlightStopIndex = this.state.spotlightStopIndex

    // not all stops have photos
    let spotlightPhotoUrl = null
    if (stopPhotos && Object.keys(stopPhotos).length > 0 && (spotlightStopIndex !== null && spotlightStopIndex !== undefined)) {
      const spotlightPhotos = stopPhotos[String(spotlightStopIndex)]
      // console.log(`iterating photo: ${JSON.stringify({ stopPhotos, spotlightStopIndex, _stops, stopsLength: _stops.length })}`)
      if (spotlightPhotos) spotlightPhotoUrl = spotlightPhotos[randomElement(Object.keys(spotlightPhotos))]
    }
    
    this.setState({
      spotlightPhotoUrl
    })
  }

  async iterateSpotlight() {
    const {
      google,
      maps,
      directionsResults,
      _stops,
      directionsCenter,
      directionsZoom,
      markers,
      stopPhotos,
      photoInterval
    } = this.state

    const {
      darkMode,
      onlySpotlightPhotos,
      lowLevelSpotlightFrac,
      lowLevelSpotlightConfig,
      highLevelSpotlightConfigs,
      photoDuration
    } = this.props

    const currentMap = maps[darkMode ? 'darkMode' : 'lightMode']

    const lowLevelLngOffset = lowLevelSpotlightConfig.mapOffset && lowLevelSpotlightConfig.mapOffset.lng ? lowLevelSpotlightConfig.mapOffset.lng : 0
    const eastSpotlight = {
      size: { height: lowLevelSpotlightConfig.size.height, width: lowLevelSpotlightConfig.size.width },
      offset:  { lat: 0, lng: -1*lowLevelLngOffset },
      margin: { top: lowLevelSpotlightConfig.margin.top, bottom: lowLevelSpotlightConfig.margin.bottom, left: lowLevelSpotlightConfig.margin.left }
    }
    const westSpotlight = {
      size: { height: lowLevelSpotlightConfig.size.height, width: lowLevelSpotlightConfig.size.width },
      offset:  { lat: 0, lng: 1*lowLevelLngOffset },
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

    // check if should display spotlight
    if (
      !directionsResults.length || !markers ||
      (onlySpotlightPhotos && (!stopPhotos || Object.keys(stopPhotos).length === 0))
    ) return
    console.log(`continuing with iterateSpotlight: ${JSON.stringify({stopPhotos})}`)

    // pick params for new spotlight
    const spotlightStopIndex = onlySpotlightPhotos ?
      parseInt(randomElement(Object.keys(stopPhotos))) : 
      Math.floor(_stops.length * Math.random())
    const lowLevelSpotlightState = Math.random() < lowLevelSpotlightFrac

    let spotlightConfig, newCenter, newZoom
    if (lowLevelSpotlightState) {
      const spotlightSpot = _stops[spotlightStopIndex]
      const spotlightProps = lowLevelSpotlightProps[spotlightSpot.labelPosition]
    
      const nominalCenter = new google.maps.LatLng(spotlightSpot.position)
      newCenter = new google.maps.LatLng(nominalCenter.lat() + spotlightProps.offset.lat, nominalCenter.lng() + spotlightProps.offset.lng)
      newZoom = lowLevelSpotlightConfig.zoom
      
      spotlightConfig = {
        ...lowLevelSpotlightConfig,
        size: spotlightProps.size,
        margin: spotlightProps.margin
      }
    } else {
      spotlightConfig = randomElement(highLevelSpotlightConfigs)
      newCenter = new google.maps.LatLng(directionsCenter.lat() + spotlightConfig.mapOffset.lat, directionsCenter.lng() + spotlightConfig.mapOffset.lng)
      newZoom = directionsZoom
    }
    
    // update spotlight
    currentMap.setZoom(directionsZoom) // always zoom out before panning
    await Bluebird.delay(250)
    this.createMapMarkers(spotlightStopIndex)

    // handle new spotlight media before zooming
    if (photoInterval) clearInterval(photoInterval)
    this.iteratePhoto(spotlightStopIndex)
    const newPhotoInterval = setInterval(this.iteratePhoto.bind(this), photoDuration*1000)

    // finish moving to new spotlight
    currentMap.panTo(newCenter)
    await Bluebird.delay(250)
    currentMap.setZoom(newZoom)

    this.setState({
      lowLevelSpotlightState,
      spotlightStopIndex,
      spotlightConfig,
      photoInterval: newPhotoInterval
    })
  }

  async componentDidMount() {
    const {
      displayed
    } = this.props
    
    await this.createMap()
    if (displayed) this.show()
    await this.fetchPhotos()
  }

  async componentDidUpdate(prevProps) {
    const {
      darkMode: prevDarkMode
    } = prevProps

    const {
      darkMode: currDarkMode,
      displayed
    } = this.props

    const {
      maps,
      directionsRenderers
    } = this.state

    // darkMode updated
    if (prevDarkMode !== currDarkMode) {
      this.hide()

      const currMap = currDarkMode ? maps.darkMode : maps.lightMode

      if (!currMap) {
        await this.createMap()
      } else {
        this.createMapMarkers()
        directionsRenderers.forEach(segmentDirectionsRenderer => segmentDirectionsRenderer.setMap(currMap))
      }

      if (displayed) this.show()
    }
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
      spotlightInterval,
      photoInterval
    } = this.state

    clearInterval(spotlightInterval)
    clearInterval(photoInterval)
  }

  content() {
    const {
      spotlightStopIndex,
      spotlightConfig,
      spotlightPhotoUrl,
      _stops
    } = this.state

    const {
      title,
      defaultSpotlightConfig,
      darkMode
    } = this.props

    const _spotlightConfig = {
      ...defaultSpotlightConfig,
      ...spotlightConfig
    }

    let spotlightElement = ''
    if (spotlightConfig) {
      const spotlightPadding = parseInt(_spotlightConfig.padding)
      const spotlightHeaderHeight = parseInt(_spotlightConfig.headerHeight)
      const spotlightImageMaxHeight = window.innerHeight * parseFloat(_spotlightConfig.size.height)/100 - 2*spotlightPadding - spotlightHeaderHeight
      const spotlightImageMaxWidth = window.innerWidth * parseFloat(_spotlightConfig.size.width)/100 - 2*spotlightPadding

      const stop = _stops[spotlightStopIndex]

      const spotlightTitleText = stop.locationText || stop.location
      let spotlightSubtitleText
      if (stop.startDate && stop.endDate) spotlightSubtitleText = `${stop.startDate} - ${stop.endDate}`
      else if (stop.startDate) spotlightSubtitleText = stop.startDate

      const spotlightMediaElement = spotlightPhotoUrl ? 
        (
          <DynamicImage 
            src={spotlightPhotoUrl}
            maxWidth={spotlightImageMaxWidth}
            maxHeight={spotlightImageMaxHeight}
          />
        ) : (
          <div>
            test media!
          </div>
        )
      
      spotlightElement = (
        <div 
          class='driving-map-spotlight-container'
          style={{ height: _spotlightConfig.size.height, width: _spotlightConfig.size.width, ..._spotlightConfig.margin }}
        >
          <div className={`driving-map-spotlight ${darkMode ? 'darkMode' : 'lightMode'}`}>
            <div 
              class='driving-map-spotlight-header'
              style={{ height: _spotlightConfig.headerHeight }}
            >
              <div class='driving-map-spotlight-title'>{spotlightTitleText}</div>
              <div class='driving-map-spotlight-subtitle'>{spotlightSubtitleText}</div>
            </div>
            
            <div 
              class='driving-map-spotlight-media'
              style={{ padding: _spotlightConfig.padding }}
            >
              {spotlightMediaElement}
            </div>
          </div>
        </div>
      )
    }

    return (
      <div class='slide driving-map-container'>
        <div 
          id={MAP_DIV_ID.lightMode} 
          className={`driving-map ${darkMode ? 'hidden' : ''}`}
        ></div>
        <div 
          id={MAP_DIV_ID.darkMode} 
          className={`driving-map ${darkMode ? '' : 'hidden'}`}
        ></div>
        <div className={`driving-map-title ${darkMode ? 'darkMode' : 'lightMode'}`}>{title}</div>
        {spotlightElement}
      </div>
    )
  }
}

export default DrivingMap