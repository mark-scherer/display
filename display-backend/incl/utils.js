/*
  backend utils
*/

const API_KEYS = require('/etc/keys/displayApis.json')
const getApiKey = function(service) {
  if (!API_KEYS[service]) throw Error(`unsupported service: ${service}`)
  
  return API_KEYS[service]
}

module.exports = {
  getApiKey
}