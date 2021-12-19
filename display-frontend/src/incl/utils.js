const randomIndex = function(list) {
  return Math.floor(Math.random() * list.length)
}

const randomElement = function(list) {
  return list[randomIndex(list)]
}

module.exports = {
  randomIndex,
  randomElement
}