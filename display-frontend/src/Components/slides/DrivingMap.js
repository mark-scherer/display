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
  */
  formatMarkerOptions(stopConfig, position, index, google) {
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

    // setup defaults
    if (!stopConfig.type) stopConfig.type = DEFAULT_TYPE
    if (!stopConfig.labelPosition) stopConfig.labelPosition = DEFAULT_LABEL_POSITON
    
    const typeConfig = TYPE_CONFIGS[stopConfig.type]
    if (!typeConfig) throw Error(`unsupported stopConfig.type: ${stopConfig.type}`)
    
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

    const fillColor = MARKER_COLORS[index % MARKER_COLORS.length]

    return [
      // labelMarker
      {
        position,
        icon: {
          path: labelMarkerPath,
          anchor: labelMarkerAnchor,
          fillColor,
          fillOpacity: 1,
          strokeOpacity: 0
        },
        label: {
          text: labelText,
          fontSize: typeConfig.LABEL_FONT_SIZE,
          fontWeight: typeConfig.LABEL_FONT_WEIGHT
        }
      },

      // pointMarker
      {
        position,
        icon: {
          path: pointMarkerPath,
          fillColor,
          fillOpacity: 1,
          strokeOpacity: 1,
          strokeWeight: typeConfig.POINT_MARKER_STROKE_WEIGHT
        },
      }
    ]
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
                  this.formatMarkerOptions(stops[0], directionsLeg.start_location, 0, google).forEach(markerOptions => {
                    const originMarker = new google.maps.Marker(markerOptions)
                    originMarker.setMap(map)
                  })    
                }

                this.formatMarkerOptions(stops[index + 1], directionsLeg.end_location, index + 1, google).forEach(markerOptions => {
                  const marker = new google.maps.Marker(markerOptions)
                  marker.setMap(map)
                })
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