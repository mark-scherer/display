const randomIndex = function(list) {
  return Math.floor(Math.random() * list.length)
}

const randomElement = function(list) {
  return list[randomIndex(list)]
}

// weights do not need to add to 1
// NEED TO TEST!
const weightedRandomElement = function(list, weights) {
  if (list.length !== weights.length) throw Error(`weightedRandomElement: list and weights must be same length: ${JSON.stringify({ listLength: list.length, weightsLength: weights.length })}`)
  if (list.length === 0) return null

  let runningTotal = 0
  const cumulativeWeights = weights.map(w => {
    runningTotal += w
    return runningTotal
  })

  // special case where all proabilities equal 0
  if (runningTotal === 0) return randomElement(list)

  const r = Math.random() * runningTotal

  let pickedIndex
  cumulativeWeights.forEach((cw, index) => {
    if ((pickedIndex === null || pickedIndex === undefined) && cw > r) {
      pickedIndex = index
      // break
    }
  })

  return list[pickedIndex]
}

module.exports = {
  randomIndex,
  randomElement,
  weightedRandomElement
}