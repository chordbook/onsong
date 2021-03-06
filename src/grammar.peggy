// This is a grammar for the OnSong format as documented here:
// https://www.onsongapp.com/docs/features/formats/onsong/

{
  const warnings = options.warnings || []

  function warn(message, location) {
    warnings.push({message, location})
  }

  // Use the first character of each word in the section name, e.g. "Verse 3" => "V3"
  function sectionAbbr(name) {
    return name?.match(/\b(\w)/g)?.join('').toUpperCase();
  }

  // Rearrange sections according to the `Flow` metatag
  function reflow(metadata, sections) {
    const flow = metadata.find(m => m.name === 'flow')?.value;

    if(flow) {
      return flow.map(name => {
        if(typeof name === 'string') {
          return sections.find(section => {
            return section.name === name || sectionAbbr(section.name) === name
          })
        } else {
          return name;
        }
      });
    } else {
      return sections;
    }
  }
}

Song
  = metadata:Metadata sections:(@Metatag EOL __ / Section)* {
    return { type: "Song", metadata, sections: reflow(metadata, sections), warnings }
  }

// https://www.onsongapp.com/docs/features/formats/onsong/metadata/
Metadata
  = (@Metatag EOL __)*

Metatag "metatag"
  = "{" _ @Metatag _ "}"
  / _ "flow"i _ ":" _ value:Flow {
      return { type: "Metatag", name: 'flow', value }
    }
  / _ name:((@MetaName _ ":") / ImplicitMetaName) _ value:MetaValue {
      return { type: "Metatag", name: name.toLowerCase().trim(), value }
    }

MetaName
  = $[^\r\n:{,]+

ImplicitMetaName
  = & { return location().start.line <= 2 } {
      switch(location().start.line) {
        case 1: return 'title'; // First line is implicitly title
        case 2: return 'artist'; // Second line is implicitly artist
      }
    }

MetaValue
  = $[^\r\n}]+

// https://www.onsongapp.com/docs/features/formats/onsong/metadata/flow/
Flow
  = head:FlowKeyword tail:(_ "," _ @FlowKeyword)+ { return [head, ...tail] }
  / (@FlowAbbr _)+

FlowKeyword
  = MusicalInstruction / SectionName

FlowAbbr
  = abbr:$([A-Z]i / [0-9])+ { return abbr.toUpperCase() }

// https://www.onsongapp.com/docs/features/formats/onsong/section/
Section
    // {start_of_*}
  = DirectiveSection
    // Section with explcit name and maybe a body
  / name:SectionHeader __ items:SectionBody* { return { type: 'Section', name, items } }
    // Section without explicit name
  / items:SectionBody+ { return { type: 'Section', name: null, items } }

DirectiveSection
  = "{" _ ("start_of_" / "so") type:DirectiveSectionTypes _ name:(":" _ @MetaValue)? "}" EOL
    items:SectionBody*
    "{" _ ("end_of_" / "eo") DirectiveSectionTypes _ "}" EOL // FIXME: must match start tag
    {
      return { type: 'Section', name: name || type, items }
    }

DirectiveSectionTypes
  = "b" "ridge"? { return "Bridge" }
  / "c" "horus"? { return "Chorus" }
  / "p" "art"?   { return "Part" }
  / "v" "erse"?  { return "Verse" }

SectionName
  = MetaName

SectionHeader
  = name:SectionName _ ":" EOL {
    return name.trim()
  }

SectionBody
  = !SectionHeader @(Tab / Stanza) __

Stanza
  = lines:Line+ {
    return { type: 'Stanza', lines }
  }

Line
  = parts:(@ChordsOverLyrics / @InlineAnnotation+ EOL) {
    return {type: 'Line', parts }
  }

// The other way to express chords in lyrics is to place the chords on a line above the lyrics and
// use space characters to align the chords with lyrics. This is supported since most music found
// in other formats use this technique. Here is an example of chords over lyrics:
//
// Verse 1:
//         D           G        D
// Amazing Grace, how sweet the sound,
ChordsOverLyrics
  = annotations:(_ @(annotation:(Chord / MusicalInstruction) { return { annotation, column: location().start.column } }))+ EOL
    lyrics:(@Lyrics EOL)? {
      // FIXME: Is there a better way to do this in PEG?
      // Or, is there a more idiomatic way to merge chords and lyrics into pairs?

      // First annotation does not start at beginning of line, add an empty one
      if(annotations[0]?.column > 1) annotations.unshift({annotation: null, column: 1})

      // Ensure lyrics are a string
      if(!lyrics) lyrics = ''

      const items = [];

      for (let index = 0; index < annotations.length; index++) {
        const { annotation, column } = annotations[index];
        const startColumn = column - 1;
        const endColumn = annotations[index + 1]?.column - 1 || lyrics.length;
        const l = lyrics.padEnd(endColumn, ' ').slice(startColumn, endColumn)

        items.push({type: 'Annotation', annotation, lyrics: l})
      }

      return items;
    }

InlineAnnotation
  = annotation:(BracketedChord / MusicalInstruction) lyrics:Lyrics {
      return { type: 'Annotation', annotation, lyrics }
    }
  / annotation:(BracketedChord / MusicalInstruction) {
      return { type: 'Annotation', annotation, lyrics: '' }
    }
  / lyrics:Lyrics {
      return { type: 'Annotation', lyrics, annotation: null }
    }

BracketedChord "chord"
  = !Escape "[" @Chord "]"
  / !Escape "[" chord:$[^\]]+ "]" {
      warn(`Unknown chord: ${chord}`, location())
    }

// OnSong recognizes chords using the following set of rules:
// https://www.onsongapp.com/docs/features/formats/onsong/chords/#chords-over-lyrics
Chord
  = value:$(ChordLetter (ChordModifier / ChordSuffix / ChordNumericPosition)* (Space? "/" Space? ChordLetter ChordModifier?)?) {
    return { type: 'Chord', value }
  }

// It must start with a capital A, B, C, D, E, F, G or H (used in some languages)
ChordLetter = [A-H]
ChordModifier = [#♯b♭]
ChordSuffix = "sus" / "maj"i / "min" / "man" / "m"i / "aug" / "dim"
ChordNumericPosition
  = (ChordModifier / "add")? ([02345679] / "11" / "13")
  / "(" ChordNumericPosition ")"

Lyrics "lyrics"
  = $Char+

Tab
  = "{" _ "sot" _ "}" NewLine content:$(TabLine __)+ "{" _ "eot" _ "}" {
      return { type: 'Tab', content }
    }
  / "{start_of_tab}" NewLine content:$(TabLine __)+ "{end_of_tab}" {
      return { type: 'Tab', content }
    }

TabLine = [^\r\n{]+ NewLine

MusicalInstruction // e.g. (Repeat 8x)
  = "(" content:$[^)]+ ")" {
      return { type: 'Instruction', content }
    }

Char
  = [^\|\[\\{#\(\r\n]

Escape
  = "\\"

Space "space"
  = [ \t]

NewLine "new line"
  = "\r\n" / "\r" / "\n"

EOL "end of line" // Strict linebreak or end of file
  = _ (NewLine / EOF)

EOF "end of file"
  = !.

_ // Insignificant space
  = Space*

__ // Insignificant whitespace
  = (Space / NewLine)*
