/*
  Slide to display basic text message
*/

import Slide from './Slide.js';

class Message extends Slide {
  static requiredArgs = [
    'msg',
    'background'
  ]

  constructor(props) {
    super(props)
  }

  show() {}

  hide() {}

  content() {
    const {
      msg,
      background
    } = this.props

    return (
      <div class='message-container'
        style={{ background }}
      >
        <div class='message'>{msg}</div>
      </div>
    )
  }
}

export default Message