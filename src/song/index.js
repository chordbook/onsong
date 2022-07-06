const Metadata = require('./metadata')
const Section = require('./section')

class Song {
  constructor({ metadata, sections, warnings }) {
    this.metadata = new Metadata(metadata)
    this.sections = sections.map(section => new Section(section))
    this.warnings = warnings
  }
}

module.exports = { Song, Metadata, Section }
