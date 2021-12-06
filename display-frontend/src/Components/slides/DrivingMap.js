/*
  Slide to display basic text message
*/

import { Loader } from "@googlemaps/js-api-loader"
import Slide from './Slide.js';

// please put this only in /etc/keys/ on server accessible thru api once available
const MAPS_API_KEY = 'AIzaSyBEnedchGYg3yrsw86EzLmVZ_N7jmPwWQQ'

class DrivingMap extends Slide {
  static requiredArgs = [
    'title',
    'stops',
  ]

  constructor(props) {
    super(props)

    const loader = new Loader({
      apiKey: MAPS_API_KEY,
    })

    this.state = {
      loader,
      map: null
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

  /* create MarkerOptions json for custom marker for given stop
    - see MarkOptions docs: https://developers.google.com/maps/documentation/javascript/reference/marker#MarkerOptions
    - notes:
      - icon path is drawn w/ center at (0, 0) so label is automatically centered within the icon
    - stopConfig options:
      - location: textual location to send to directions API
      - labelPosition: cardinal direction from location in which to place label
      - labelText: optional overwrite for default label text
  */
  formatMarkerOptions(stopConfig, position, index, google) {
    // marker constants
      // distances are in icon.path's coordinate system
    const DEFAULT_LABEL_POSITON = 'north'
    const LABEL_BOX_MARGIN = 10 // margin between marker point and label box
    const MIN_LABEL_WIDTH = 100
    const PX_PER_CHAR = 8 // jank way to set marker width from textual label length
    const MARKER_RADIUS = 5
    const MARKER_COLORS = [
      // 'lightblue',
      // 'darkseagreen',
      // 'wheat'
      'lightgray'
    ]
    
    const dateText = stopConfig.startDate ?
      `${stopConfig.startDate}` + (stopConfig.endDate ?
        ` - ${stopConfig.endDate}` : '') + ': '
      : ''
    const label = stopConfig.labelText || `${dateText}${stopConfig.locationText || stopConfig.location}`


    // total width, height of drawn svg in context of icon.path, icon.anchor
    const width = Math.max(MIN_LABEL_WIDTH, label.length*PX_PER_CHAR) // jank but rough approximation of needed marker width
    const height = 25

    // anchor is (left, up) translation applied to path
    if (!stopConfig.labelPosition) stopConfig.labelPosition = DEFAULT_LABEL_POSITON

    const northOffest = height/2 + LABEL_BOX_MARGIN,
      eastOffest = -1*(width/2 + LABEL_BOX_MARGIN),
      southOffset = -1*(height/2 + LABEL_BOX_MARGIN),
      westOffset = width/2 + LABEL_BOX_MARGIN

    let anchor
    if (stopConfig.labelPosition === 'north') anchor = new google.maps.Point(0, northOffest)
    else if (stopConfig.labelPosition === 'northeast') anchor = new google.maps.Point(eastOffest, northOffest)
    else if (stopConfig.labelPosition === 'east') anchor = new google.maps.Point(eastOffest, 0)
    else if (stopConfig.labelPosition === 'southeast') anchor = new google.maps.Point(eastOffest, southOffset)
    else if (stopConfig.labelPosition === 'south') anchor = new google.maps.Point(0, southOffset)
    else if (stopConfig.labelPosition === 'southwest') anchor = new google.maps.Point(westOffset, southOffset)
    else if (stopConfig.labelPosition === 'west') anchor = new google.maps.Point(westOffset, 0)
    else if (stopConfig.labelPosition === 'northwest') anchor = new google.maps.Point(westOffset, northOffest)
    else throw Error(`unrecognized labelPosition: ${JSON.stringify({ stop: stopConfig.location, labelPosition: stopConfig.labelPosition })}`)

    // draw a width x height rectange centered at (0, 0)
    const labelBox = `M -${width/2} -${height/2} h ${width} v ${height} h -${width} Z`
    const markerSvg = `m -${MARKER_RADIUS} -${MARKER_RADIUS} h ${2*MARKER_RADIUS} v ${2* MARKER_RADIUS} h -${2*MARKER_RADIUS} z`
    let markerPoint
    if (stopConfig.labelPosition === 'north') markerPoint = `M 0 ${northOffest} ${markerSvg}`
    else if (stopConfig.labelPosition === 'northeast') markerPoint = `M ${eastOffest} ${northOffest} ${markerSvg}`
    else if (stopConfig.labelPosition === 'east') markerPoint = `M ${eastOffest} 0 ${markerSvg}`
    else if (stopConfig.labelPosition === 'southeast') markerPoint = `M ${eastOffest} ${southOffset} ${markerSvg}`
    else if (stopConfig.labelPosition === 'south') markerPoint = `M 0 ${southOffset} ${markerSvg}`
    else if (stopConfig.labelPosition === 'southwest') markerPoint = `M ${westOffset} ${southOffset} ${markerSvg}`
    else if (stopConfig.labelPosition === 'west')  markerPoint = `M ${westOffset} 0 ${markerSvg}`
    else if (stopConfig.labelPosition === 'northwest')  markerPoint = `M ${westOffset} ${northOffest} ${markerSvg}`
    else throw Error(`unrecognized labelPosition: ${JSON.stringify({ stop: stopConfig.location, labelPosition: stopConfig.labelPosition })}`)
    const path = `${labelBox} ${markerPoint}`

    return {
      position,
      icon: {
        path,
        anchor,
        fillColor: MARKER_COLORS[index % MARKER_COLORS.length],
        fillOpacity: 1,
        strokeOpacity: 0
      },
      label
    }
  }

  componentDidMount() {
    const {
      loader
    } = this.state

    const {
      stops
    } = this.props

    loader.load()
      .then((google) => {
        const directionsService = new google.maps.DirectionsService()
        const directionsRenderer = new google.maps.DirectionsRenderer({ suppressMarkers: true }) // need to create individual markers ourselves

        // see https://developers.google.com/maps/documentation/javascript/style-reference
        const mapStyles = [
          {
            featureType: 'administrative',
            elementType: 'labels',
            stylers: [
              { 'visibility': 'off'}
            ]
          },
          // {
          //   featureType: 'road',
          //   stylers: [
          //     { 'visibility': 'off'}
          //   ]
          // },
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

        const map = new google.maps.Map(document.getElementById('driving-map'), {
          center: { lat: 37.77, lng: -122.39 },
          zoom: 8,
          mapTypeId: google.maps.MapTypeId.TERRAIN,
          styles: mapStyles,
          disableDefaultUI: true
        })
        directionsRenderer.setMap(map)
        
        if (stops.length >= 2) {
          directionsService.route({
            origin: this.formatStop(stops[0], false),
            destination: this.formatStop(stops[stops.length - 1], false),
            waypoints: stops.slice(1, stops.length - 1).map(stopConfig => this.formatStop(stopConfig)),
            travelMode: google.maps.TravelMode.DRIVING
          }, (directionsResult, directionsStatus) => {
            
            if (directionsStatus === 'OK') directionsRenderer.setDirections(directionsResult)
            else throw Error(`error getting directions: ${ directionsStatus }`)

            // add custom markers
            directionsResult.routes[0].legs.forEach((directionsLeg, index) => {
              try {
                // special case to add origin marker
                if (index === 0) {
                  const originMarker = new google.maps.Marker(this.formatMarkerOptions(stops[0], directionsLeg.start_location, 0, google))
                  originMarker.setMap(map)
                }

                const marker = new google.maps.Marker(this.formatMarkerOptions(stops[index + 1], directionsLeg.end_location, index + 1, google))
                marker.setMap(map)
              } catch (error) {throw Error(`error creating map markers: ${JSON.stringify({ error: String(error), directionsLeg, index })}`)}
            })
          })
        }

        this.setState({
          loader,
          map
        })
      })
      .catch(error => { throw Error(`${this.constructor.name} ctor: error creating google map: ${error}`) })
  }

  show() {}

  hide() {}

  content() {
    const {
      title
    } = this.props

    return (
      <div class='driving-map-container'>
        <div id='driving-map'></div>
        <div class='driving-map-title'>{title}</div>
      </div>
    )
  }
}

export default DrivingMap