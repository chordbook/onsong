const { readFileSync } = require('fs')
const OnSong = require('../')

describe('integration', () => {
  const fixture = readFileSync('test/fixtures/example.onsong', { encoding: 'utf-8' })
  let song = null;

  beforeAll(() => {
    song = OnSong.parse(fixture)
  })

  test('metadata', () => {
    expect(song.metadata.title).toEqual('Welcome To OnSong')
    expect(song.metadata.artist).toEqual('OnSong Team')
    expect(song.metadata.key).toEqual('C')
    expect(song.metadata.tempo).toEqual('85')
    expect(song.metadata.time).toEqual('4/4')
  })

  test('sections', () => {
    expect(song.sections.length).toBe(5)
    const v1 = song.sections[0]
    expect(v1.name).toBe('Verse 1')
  })
})
