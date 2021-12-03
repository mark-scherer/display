/*
  Slide to display basic text message
*/

import Slide from './Slide.js';

class Message extends Slide {
  static requiredArgs = [
    'msg'
  ]

  constructor(props) {
    super(props)
  }

  show() {}

  hide() {}

  content() {
    const {
      msg
    } = this.props

    return (
      <div class='message-slide'>{msg}</div>
    )
  }
}

export default Message