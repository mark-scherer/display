/*
  Slide to display basic text message
*/

import { Loader } from "@googlemaps/js-api-loader"
import Slide from './Slide.js';

// please put this only in /etc/keys/ on server accessible thru api once available
const MAPS_API_KEY = 'AIzaSyBEnedchGYg3yrsw86EzLmVZ_N7jmPwWQQ'

class DrivingMap extends Slide {
  static requiredArgs = [
    'stops'
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
        const directionsRenderer = new google.maps.DirectionsRenderer()

        const map = new google.maps.Map(document.getElementById('driving-map'), {
          center: { lat: 37.77, lng: -122.39 },
          zoom: 8,
        })
        directionsRenderer.setMap(map)
        
        if (stops.length >= 2) {
          directionsService.route({
            origin: this.formatStop(stops[0], false),
            destination: this.formatStop(stops[stops.length - 1], false),
            waypoints: stops.slice(1, stops.length - 2).map(stopConfig => this.formatStop(stopConfig)),
            travelMode: google.maps.TravelMode.DRIVING
          }, (directionsResult, directionsStatus) => {
            if (directionsStatus === 'OK') directionsRenderer.setDirections(directionsResult)
            else throw Error(`error getting directions: ${ directionsStatus }`)
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
    // const {
    //   loader
    // } = this.props

    return (
      <div id='driving-map'></div>
    )
  }
}

export default DrivingMap