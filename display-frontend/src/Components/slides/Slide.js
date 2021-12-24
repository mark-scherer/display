/*
  abstract slide base component
*/

import React from 'react';

class Slide extends React.Component {
  
  /*
    Slides must declare requiredArgs list to allow base Slide ctor to validate props
  */
  static requiredArgs = null
  
  /*
    - Slide constructor called only at page load
    - should perform all necessary communication with display server here AND NOT in show()
  */
  constructor(props) {
    super(props)

    const {
      serverUrl
    } = this.props

    if (!this.constructor.requiredArgs) throw Error(`Slide child class (${this.constructor.name}) missing static requireArgs property - must be implemented before constructor`)
    
    this.constructor.requiredArgs.forEach(arg => {
      if (this.props[arg] === null || this.props[arg] === undefined) throw Error(`${this.constructor.name} slide missing required arg: ${arg}`)
    })

    this.state = {
      serverUrl
    }

    setInterval(() => {
      const {
        displayed
      } = this.props
      // console.log(`${this.constructor.name}: displayed: ${displayed}`)
    }, 1000);
  }

  /*
    Slide.show() called when slide becomes displayed
  */
  show() {}

  /*
    Slide.hide() called when slide becomes hidden
  */
  hide() {}

  /*
    Slide.content() should produce slide html
  */
  content() {
    throw Error(`Slide.content() called from ${this.constructor.name}: method must be overriden in child class`)
  }

  componentDidUpdate(prevProps) {
    const {
      displayed: curDisplayed
    } = this.props

    const {
      displayed: prevDisplayed
    } = prevProps

    if (!prevDisplayed && curDisplayed) this.show()
    if (prevDisplayed && !curDisplayed) this.hide()
  }

  /* children SHOULD NOT override Slide.render() */
  render() {
    const {
      displayed
    } = this.props

    const slideContent = this.content()

    if (!displayed) return null

    // return (
    //   <div class='slide'>
    //     {slideContent}
    //   </div>
    // )

    return slideContent
  }
}

export default Slide