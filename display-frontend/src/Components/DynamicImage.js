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
      naturalHeight,
      naturalWidth
    } = event.target

    this.calcRenderDimensions(naturalWidth, naturalHeight)

    this.setState({
      naturalWidth,
      naturalHeight
    })
      
    // console.log(`DynamicImage.handleOnLoad! ${JSON.stringify({ src, maxWidth, maxHeight, naturalWidth, naturalHeight, imgWidthOverHeight, tooTall, renderWidth, renderHeight })}`)
  }

  calcRenderDimensions(naturalWidth, naturalHeight) {
    const {
      maxWidth,
      maxHeight
    } = this.props

    const imgWidthOverHeight =  naturalWidth / naturalHeight
    const tooTall = imgWidthOverHeight < (maxWidth / maxHeight)

    const renderWidth = tooTall ?  maxHeight * imgWidthOverHeight : maxWidth
    const renderHeight = tooTall ? maxHeight : maxWidth / imgWidthOverHeight

    this.setState({
      renderWidth,
      renderHeight
    })
  }

  componentDidUpdate(prevProps) {
    const {
      maxWidth: currMaxWidth,
      maxHeight: currMaxHeight
    } = this.props

    const {
      maxWidth: prevMaxWidth,
      maxHeight: prevMaxHeight
    } = prevProps

    const {
      naturalWidth,
      naturalHeight
    } = this.state

    if (naturalWidth && naturalHeight && (currMaxWidth !== prevMaxWidth || currMaxHeight !== prevMaxHeight)) this.calcRenderDimensions(naturalWidth, naturalHeight)
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
    if (renderWidth && renderHeight) {
      width = renderWidth
      height = renderHeight
    }

    return (
      <div 
        class='dynamic-image-container' 
        style={{width, height, maxWidth, maxHeight }}
      >
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