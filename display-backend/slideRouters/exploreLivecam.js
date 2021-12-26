/*
  endpoints specifically for the ExploreLivecam slide
*/

const Router = require('@koa/router')
const fetch = require('node-fetch')
const _ = require('lodash')
const Bluebird = require('bluebird')
const fs = require('fs')

const ALL_LIVE_FEEDS_ENDPOINT = 'https://omega.explore.org/api/initial?contenttype=livecams&group=currently-live'
const LIVE_FEED_INFO_ENDPOINT = 'https://omega.explore.org/api/get_livecam_info.json'
const FEED_INFO_CONCURRENY = 32

const router = new Router({ prefix: '/exploreLivecam' })

// grab all currently live feeds and their embed links from explore.org
router.get('/livefeeds', async (ctx, next) => {
  const currentFeedsData = (await fetch(ALL_LIVE_FEEDS_ENDPOINT).then(response => response.json()))
  const currentFeeds = _.chain(currentFeedsData.data.camgroups)
    .map('feeds')
    .flatten()
    .map(feedInfo => [feedInfo.slug, feedInfo.id])
    .uniq()
    .fromPairs()
    .value()

  const feedsInfo = {}
  await Bluebird.map(Object.keys(currentFeeds), async feedSlug => {
    const info = await fetch(`${LIVE_FEED_INFO_ENDPOINT}?id=${currentFeeds[feedSlug]}`).then(response => response.json())
    if (info.status_code !== 404 && !info.data.is_offline) {
      feedsInfo[feedSlug] = {
        title: info.data.title,
        location: info.data.location_text,
        feedUrl: info.data.large_feed_html,
        facts: _.map(info.data.facts, 'fact'),
        currentViewers: info.data.current_viewers
      }
    }
  }, {concurrency: FEED_INFO_CONCURRENY})
  
  ctx.body = feedsInfo
})

module.exports = router