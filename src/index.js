const grammar = require('./grammar')
const { Song } = require('./song')

module.exports = {
  parse(input) {
    return new Song(grammar.parse(input))
  }
}
