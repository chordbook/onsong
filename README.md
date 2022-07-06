# OnSong File Format parser

A JavaScript library for parsing and formatting chord sheets in the [OnSong File Format](https://www.onsongapp.com/docs/features/formats/onsong/).


## Installation

Install with npm:

```
npm install onsong
```

or yarn:

```
yarn add onsong
```

Load with `require()`:

```
const OnSong = require('onsong').default
```

or `import`:

```
import OnSong from 'onsong'
```

## Usage

### Parse song

```js
import OnSong from 'onsong'

const source = `
Hello OnSong
Artist Name
Key: C

Verse 1:
The [C]OnSong file format is [F]great because
it is [C]compatible with so many styles of [G]notation.
For exam[C]ple, it is a superset of Chord[F]Pro
which has [C]very explicit [G]syntax for [C]metadata {c: like this comment}

Chorus:
   C                     F
But it also is flexible enough
   C                       G
to work with less-explicit notation,
     C                     F
such as this commonly used format
     C                  G             C
that places chords over lyrics in monospace
`

const song = OnSong.parse(source)

song.metadata.title   // "Hello OnSong"
song.metadata.artist  // "Artist Name"
```
