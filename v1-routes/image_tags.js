const async = require('async')
const uuidv4 = require('uuid/v4')

module.exports = {
  path: '/image/:image_id/tags',
  displayPath: '/image/:image_id/tags',
  methods: ['GET', 'POST'],
  description: 'Retrieve or add tags for a given image',
  parameters: {
    'image_id': {
      'positional': true,
      'description': `A valid image identifier`
    },
    'tags': {
      'description': 'An array of tag objects. Each object must have a tag_id, min_x, min_y, max_x, max_y'
    },
    'tagger': {
      'type': 'text',
      'description': 'The person who added the tags'
    },
    'validator': {
      'type': 'text',
      'description': 'The person who validated the tags'
    }
  },
  requiredParameters: [ ],
  requiresOneOf: [ 'image_id' ],
  fields: {
    'image_id': {
      'type': 'integer',
      'description': 'The unique image identifier'
    },
    'tags': {
      'type': 'text',
      'description': 'The applicable tags'
    },
  },
  examples: [
    '/api/v1/image/2/tags',
  ],
  handler: (req, res, next, plugins) => {
    if (req.method === 'GET') {
      let where = (req.query.image_id === 'validate') ? 'ORDER BY random() LIMIT 1' : 'WHERE image_tags.image_id = ?'
      let params = (req.query.image_id === 'validate') ? [] : [ req.query.image_id ]
      plugins.db.all(`
        SELECT
          image_tags.image_tag_id,
          tags.tag_id,
          tags.name,
          image_tags.x,
          image_tags.y,
          image_tags.width,
          image_tags.height,
          image_tags.tagger,
          image_tags.validator,
          image_tags.created,
          image_tags.validated
        FROM tags
        JOIN image_tags ON image_tags.tag_id = tags.tag_id
        ${where}
      `, params, (error, tags) => {
        res.reply(req, res, next, tags)
      })
    } else {
      // Validate the input
      let incoming = req.body

      if (!incoming.tagger && !incoming.validator) {
        return res.error(req, res, next, 'Missing a "tagger" or "validator" property', 400)
      }
      if (!incoming.tags) {
        return res.error(req, res, next, 'Missing "tags" property', 400)
      }
      try {
        incoming.tags = JSON.parse(incoming.tags)
      } catch(e) {
        return res.error(req, res, next, 'Could not parse tags', 400)
      }

      incoming.tags.forEach(tag => {
        if (!tag.tag_id) {
          return res.error(req, res, next, 'A tag is missing a tag_id', 400)
        }
        if (!tag.x) {
          return res.error(req, res, next, 'A tag is missing an x', 400)
        }
        if (!tag.y) {
          return res.error(req, res, next, 'A tag is missing an y', 400)
        }
        if (!tag.width) {
          return res.error(req, res, next, 'A tag is missing an width', 400)
        }
        if (!tag.height) {
          return res.error(req, res, next, 'A tag is missing an width', 400)
        }
      })

      // Alright...I think we are good to go
      async.eachLimit(incoming.tags, 1, (tag, callback) => {
        plugins.db.run(`
          INSERT INTO image_tags (image_tag_id, image_id, tag_id, x, y, width, height, tagger, validator)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [tags.image_tag_id || uuidv4(), req.query.image_id, tag.tag_id, tag.x, tag.y, tag.width, tag.height, incoming.tagger, incoming.validator || NULL], (error) => {
          if (error) {
            return callback(error)
          }
          callback(null)
        })
      }, (error) => {
        if (error) {
          return res.error(req, res, next, 'An error occurred while inserting tags', 500)
        }
        res.reply(req, res, next, 'Success')
      })


    }
  }
}
