import React from 'react';

class DynamicImage extends React.Component {
  constructor(props) {
    super(props)

    this.state = {
      naturalHeight: null,
      naturalWidth: null,
      renderWidth: null,
      renderHeight: null
    }
  }

  handleOnLoad(event) {
    const {
      src,
      maxWidth,
      maxHeight
    } = this.props

    const {
      naturalHeight,
      naturalWidth
    } = event.target

    const imgWidthOverHeight =  naturalWidth / naturalHeight
    const tooTall = imgWidthOverHeight < (maxWidth / maxHeight)

    const renderWidth = tooTall ?  maxHeight * imgWidthOverHeight : maxWidth
    const renderHeight = tooTall ? maxHeight : maxWidth / imgWidthOverHeight

    this.setState({
      naturalWidth,
      naturalHeight,
      renderWidth,
      renderHeight
    })
      
    // console.log(`DynamicImage.handleOnLoad! ${JSON.stringify({ src, maxWidth, maxHeight, naturalWidth, naturalHeight, imgWidthOverHeight, tooTall, renderWidth, renderHeight })}`)
  }

  render() {
    const {
      renderWidth,
      renderHeight
    } = this.state

    const {
      src,
      maxWidth,
      maxHeight,
      children
    } = this.props

    let width, height
    if (renderWidth && renderWidth) {
      width = renderWidth
      height = renderHeight
    }

    return (
      <div>
        <img
          src={src}
          style={{width, height, maxWidth, maxHeight }}
          onLoad={this.handleOnLoad.bind(this)}
        />
        <div>{children}</div>
      </div>
    )
  }
}

export default DynamicImage