const redis = require('redis')
const AsyncLock = require('async-lock')
const lock = new AsyncLock()

function nxt (arr) {
  return ((parseInt(arr.slice(-1)[0], 36) + 1).toString(36)).replace(/0/g, '0')
}

function processEvent (client, event, callback){
  let res = []
  const qty = event.qty || 1
  const key = event.key
  lock.acquire(key, function (cb) {
    client.get(key, function (err, val) {
      if (err) return cb(err)
      res.push(val || '100000')
      for (let index = 1; index < qty; index++) {
        res.push(nxt(res))
      }
      client.set(key, nxt(res), () => {
        cb(null, res)
      })
    })
  }, function (err, ret) {
    client.quit()
      if (err) return callback(err)
      callback(null, {ids: ret})
  })
}

exports.handler = (event, context, callback) => {
  const db = event.db
  const host = event.host
  const port = event.port
  const client = redis.createClient(port, host)
  
  client.on('ready', function(result) {
    client.select(db, () => {
      processEvent(client, event, callback)
    });
  })
  
  client.on('error', function(err) {
    client.quit()
    callback(err)
  })
  
};