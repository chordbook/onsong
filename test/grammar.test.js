const peggy = require('peggy');
const { readFileSync } = require('fs');
const { annotate } = require('annotate-code');
const Tracer = require('pegjs-backtrace');

describe('OnSongGrammar', () => {
  const examples = {
    Metadata: {
      // First and second lines are assumed to be title / artist
      'Song Title\nArtist Name': [
        { type: 'Metatag', name: 'title', value: 'Song Title' },
        { type: 'Metatag', name: 'artist', value: 'Artist Name' },
      ],
      'Song Title\nArtist:Artist Name': [
        { type: 'Metatag', name: 'title', value: 'Song Title' },
        { type: 'Metatag', name: 'artist', value: 'Artist Name' },
      ],
      'Song Title\nTime:3/4': [
        { type: 'Metatag', name: 'title', value: 'Song Title' },
        { type: 'Metatag', name: 'time', value: '3/4' },
      ],
      'title: Song Title\nArtist: Artist Name': [
        { type: 'Metatag', name: 'title', value: 'Song Title' },
        { type: 'Metatag', name: 'artist', value: 'Artist Name' },
      ],
      // "before the first blank line or until no more metatags are encountered"
      'A: 1\n\nB:2\n\n': [
        { type: 'Metatag', name: 'a', value: '1' },
        { type: 'Metatag', name: 'b', value: '2' },
      ],
      '{title: ChordPro}': [
        { type: 'Metatag', name: 'title', value: 'ChordPro' },
      ],
      'Unknown Tag:': Error, // Unknown metatag without a value
    },

    // Inline Tags - https://www.onsongapp.com/docs/features/formats/onsong/metadata/?#inline-tags

    SectionHeader: {
      'Chorus:': 'Chorus',
      'Verse 1:\n': 'Verse 1',
      'Intro :': 'Intro',
      'Intro: ': 'Intro',
    },

    Section: {
      'Chorus:\nThis is a stanza\n\nThis is another stanza': {
        type: 'Section',
        name: 'Chorus',
        items: [
          {
            type: 'Stanza',
            lines: [
              { type: 'Line', parts: [{ type: 'Annotation', annotation: null, lyrics: 'This is a stanza' }] },
            ],
          },
          {
            type: 'Stanza',
            lines: [
              { type: 'Line', parts: [{ type: 'Annotation', annotation: null, lyrics: 'This is another stanza' }] },
            ],
          },
        ],
      },

      'Intro:\n\n': {
        type: 'Section',
        name: 'Intro',
        items: [],
      },

      'Intro:\n\n\n[G]': {
        type: 'Section',
        name: 'Intro',
        items: [
          {
            type: 'Stanza',
            lines: [
              {
                type: 'Line',
                parts: [
                  { type: 'Annotation', annotation: { type: 'Chord', value: 'G' }, lyrics: '' },
                ],
              },
            ],
          },
        ],
      },

      'Intro:\n{sot}\ntab\n{eot}': {
        type: 'Section',
        name: 'Intro',
        items: [
          { type: 'Tab', content: 'tab\n' },
        ],
      },

      'Intro:\n| [B] / / / | / / [C#m7] / | [E] / / / | / / [F#sus] / / |': 'todo',
      'Intro:\n[| [D] /// | //// | [F#m] /// | [E] //// |]¬': 'todo',
      '{start_of_verse}\nLyrics\n{end_of_verse}': {
        type: 'Section',
        name: 'Verse',
        items: [
          {
            type: 'Stanza',
            lines: [{ type: 'Line', parts: [{ type: 'Annotation', annotation: null, lyrics: 'Lyrics' }] }],
          },
        ],
      },
      '{start_of_verse: Verse 1}\n{end_of_verse}': { type: 'Section', name: 'Verse 1', items: [] },
      '{sov}\n{eov}': { type: 'Section', name: 'Verse', items: [] },
      '{start_of_chorus}\nLyrics\n{end_of_chorus}': {
        type: 'Section',
        name: 'Chorus',
        items: [
          {
            type: 'Stanza',
            lines: [{ type: 'Line', parts: [{ type: 'Annotation', annotation: null, lyrics: 'Lyrics' }] }],
          },
        ],
      },
      '{start_of_verse}\nLyrics\n{start_of_chorus}': 'todo',
      'Chord and lyrics': {
        type: 'Section',
        name: null,
        items: [
          {
            type: 'Stanza',
            lines: [
              { type: 'Line', parts: [{ type: 'Annotation', annotation: null, lyrics: 'Chord and lyrics' }] },
            ],
          },
        ],
      },
    },

    SectionBody: {
      [[
        '        D           G        D',
        'Amazing Grace, how sweet the sound',
        '                         A7',
        'That saved a wretch like me.',
      ].join('\n')]: {
        type: 'Stanza',
        lines: [
          {
            type: 'Line',
            parts: [
              { type: 'Annotation', annotation: null, lyrics: 'Amazing ' },
              { type: 'Annotation', annotation: { type: 'Chord', value: 'D' }, lyrics: 'Grace, how s' },
              { type: 'Annotation', annotation: { type: 'Chord', value: 'G' }, lyrics: 'weet the ' },
              { type: 'Annotation', annotation: { type: 'Chord', value: 'D' }, lyrics: 'sound' },
            ],
          },
          {
            type: 'Line',
            parts: [
              { type: 'Annotation', annotation: null, lyrics: 'That saved a wretch like ' },
              { type: 'Annotation', annotation: { type: 'Chord', value: 'A7' }, lyrics: 'me.' },
            ],
          },
        ],
      },

      'Am    F': {
        type: 'Stanza',
        lines: [
          {
            type: 'Line',
            parts: [
              { type: 'Annotation', annotation: { type: 'Chord', value: 'Am' }, lyrics: '      ' },
              { type: 'Annotation', annotation: { type: 'Chord', value: 'F' }, lyrics: '' },
            ],
          },
        ],
      },

      [[
        'G      D',
        'Lyric',
      ].join('\n')]: {
        type: 'Stanza',
        lines: [
          {
            type: 'Line',
            parts: [
              { type: 'Annotation', annotation: { type: 'Chord', value: 'G' }, lyrics: 'Lyric  ' },
              { type: 'Annotation', annotation: { type: 'Chord', value: 'D' }, lyrics: '' },
            ],
          },
        ],
      },

      'G (strum once)\nLyrics': {
        type: 'Stanza',
        lines: [
          {
            type: 'Line',
            parts: [
              { type: 'Annotation', annotation: { type: 'Chord', value: 'G' }, lyrics: 'Ly' },
              { type: 'Annotation', annotation: { type: 'Instruction', content: 'strum once' }, lyrics: 'rics' },
            ],
          },
        ],
      },

      '[G] (strum once) Lyrics': {
        type: 'Stanza',
        lines: [
          {
            type: 'Line',
            parts: [
              { type: 'Annotation', annotation: { type: 'Chord', value: 'G' }, lyrics: ' ' },
              { type: 'Annotation', annotation: { type: 'Instruction', content: 'strum once' }, lyrics: ' Lyrics' },
            ],
          },
        ],
      },

      // TODO: "You can also start the line with a period or a back tick character
      //       to force the line to be detected as chords"
      // '.I am chords\nI am lyrics': {
      //   type: 'Stanza',
      //   lines: [
      //     {
      //       type: 'Line',
      //       parts: [
      //         { type: 'Annotation', annotation: { type: 'Text', value: 'I am chords' }, lyrics: 'I am lyrics' },
      //       ],
      //     },
      //   ],
      // },
      // '`I am chords\nI am lyrics': {
      //   type: 'Stanza',
      //   lines: [
      //     {
      //       type: 'Line',
      //       parts: [
      //         { type: 'Annotation', chords: 'I am chords', lyrics: 'I am lyrics' },
      //       ],
      //     },
      //   ],
      // },
    },

    Line: {
      'This [D]is a s[G]ong,': {
        type: 'Line',
        parts: [
          { type: 'Annotation', annotation: null, lyrics: 'This ' },
          { type: 'Annotation', annotation: { type: 'Chord', value: 'D' }, lyrics: 'is a s' },
          { type: 'Annotation', annotation: { type: 'Chord', value: 'G' }, lyrics: 'ong,' },
        ],
      },
      'Ends with a chord [D]': {
        type: 'Line',
        parts: [
          { type: 'Annotation', annotation: null, lyrics: 'Ends with a chord ' },
          { type: 'Annotation', annotation: { type: 'Chord', value: 'D' }, lyrics: '' },
        ],
      },
      '[D]Starts with a chord': {
        type: 'Line',
        parts: [
          { type: 'Annotation', annotation: { type: 'Chord', value: 'D' }, lyrics: 'Starts with a chord' },
        ],
      },
      'Just lyrics': {
        type: 'Line',
        parts: [
          { type: 'Annotation', annotation: null, lyrics: 'Just lyrics' },
        ],
      },
      '[G]': {
        type: 'Line',
        parts: [{ type: 'Annotation', annotation: { type: 'Chord', value: 'G' }, lyrics: '' }],
      },
      '[G]Line (2x)': {
        type: 'Line',
        parts: [
          { type: 'Annotation', annotation: { type: 'Chord', value: 'G' }, lyrics: 'Line ' },
          { type: 'Annotation', annotation: { type: 'Instruction', content: '2x' }, lyrics: '' },
        ],
      },

      // {define: ...} is used to define custom chord diagrams. See Defining Chords for more information.
      // {comment: ...} or {c: ...} Defines a comment and appears as a musical instruction.
      // {comment_bold: ...} or {cb: ...} Defines text to appear in bold.
      // {comment_italic: ...} or {ci: ...} Defines text to appear as italic.
      // {guitar_comment: ...} or {gc: ...} Defines a comment that appears as a musical instruction.
      // {new_page} or {np} This is used to declare a new page.
      // {new_physical_page} or {npp} This is used to declare a new page.

      // Formatting Tags
      // {textsize: ...} Defines the size of the lyrics as a numeric value in points.
      // {textfont: ...} Defines the name of the font to use for lyrics. Must be supported on the platform.
      // {chordsize: ...} Defines the size of the chords as a numeric value in points.
      // {chordfont: ...} Defines the name of the font to use for chords. Must be supported on the platform.

      // *This line will be bold
      // /This line will be italicized
      // !This line will be bold and italicized
      // _This line will eventually be underlined
      // &red:This text will be red
      // &#123456:This text will be a custom color using HTML color codes
      // >yellow:This line will be highlighted in yellow

      // Poor formatting found in the wild. These should produce warnings but not raise errors
      'Rogue [C#m]#pound sign': 'todo',
      'Rogue C] square bracket': {
        type: 'Line',
        parts: [{ annotation: null, lyrics: 'Rogue C] square bracket', type: 'Annotation' }],
      },
      'Empty []chord': 'todo',
      'F#m Whoops forgot the brackets': 'todo',
    },

    Chord: {
      A: { type: 'Chord', value: 'A' },
      'C/G': { type: 'Chord', value: 'C/G' },
      'F#m': { type: 'Chord', value: 'F#m' },
      'C♯': { type: 'Chord', value: 'C♯' },
      Asus4: { type: 'Chord', value: 'Asus4' },
      E7: { type: 'Chord', value: 'E7' },
      'B♭': { type: 'Chord', value: 'B♭' },
      'Eb/Bb': { type: 'Chord', value: 'Eb/Bb' },
      'Abm7/Eb': { type: 'Chord', value: 'Abm7/Eb' },
      'F / A': { type: 'Chord', value: 'F / A' },
      'Dm7(b5)': { type: 'Chord', value: 'Dm7(b5)' },
      E7b13: { type: 'Chord', value: 'E7b13' },
      B7b5: { type: 'Chord', value: 'B7b5' },
      CM7: { type: 'Chord', value: 'CM7' },
      Cmaj7: { type: 'Chord', value: 'Cmaj7' },
      AbMaj7: { type: 'Chord', value: 'AbMaj7' },
      'C9(11)': { type: 'Chord', value: 'C9(11)' },
      'Dm7(9)': { type: 'Chord', value: 'Dm7(9)' },
      D6: { type: 'Chord', value: 'D6' },
      'B(add4)': { type: 'Chord', value: 'B(add4)' },
      AMaj: Error,
      X: Error,
    },

    BracketedChord: {
      '[G]': { type: 'Chord', value: 'G' },
      '[D/F#]': { type: 'Chord', value: 'D/F#' },
      '[Bsus2]': { type: 'Chord', value: 'Bsus2' },
      '\\[notachord]': Error,
      // '[unknown]': ExpectWarning, // FIXME
    },

    Tab: {
      '{sot}\nthe tab\nis here\n{eot}': {
        type: 'Tab',
        content: 'the tab\nis here\n',
      },
      '{start_of_tab}\ntab here\n{end_of_tab}': {
        type: 'Tab',
        content: 'tab here\n',
      },
      '{sot}\npart1\n\npart2\n{eot}': {
        type: 'Tab',
        content: 'part1\n\npart2\n',
      },
      '{sot}\ntab\n{end_of_tab}': Error,
      '{start_of_tab}\ntab\n{eot}': Error,
    },

    Song: {
      'Title\n\nChord and lyrics': {
        type: 'Song',
        metadata: [{ type: 'Metatag', name: 'title', value: 'Title' }],
        sections: [
          {
            type: 'Section',
            items: [
              {
                lines: [
                  { parts: [{ annotation: null, lyrics: 'Chord and lyrics', type: 'Annotation' }], type: 'Line' },
                ],
                type: 'Stanza',
              },
            ],
            name: null,
          },
        ],
        warnings: [],
      },
      'Title\n\nIntro:\n': {
        type: 'Song',
        metadata: [{ type: 'Metatag', name: 'title', value: 'Title' }],
        sections: [
          {
            type: 'Section',
            name: 'Intro',
            items: [],
          },
        ],
        warnings: [],
      },
      'Tempo: 73\nUnknown(s): Value:with@various:characters1-5\n\nChorus:': {
        type: 'Song',
        metadata: [
          { name: 'tempo', type: 'Metatag', value: '73' },
          { name: 'unknown(s)', type: 'Metatag', value: 'Value:with@various:characters1-5' },
        ],
        sections: [
          { items: [], name: 'Chorus', type: 'Section' },
        ],
        warnings: [],
      },
      'Title\nFlow: V1 C v1\n\nVerse 1:\nVerse\n\nChorus:\nChorus': {
        metadata: [
          { name: 'title', type: 'Metatag', value: 'Title' },
          { name: 'flow', type: 'Metatag', value: ['V1', 'C', 'V1'] },
        ],
        sections: [
          {
            type: 'Section',
            name: 'Verse 1',
            items: [
              {
                type: 'Stanza',
                lines: [
                  {
                    type: 'Line',
                    parts: [{ annotation: null, lyrics: 'Verse', type: 'Annotation' }],
                  },
                ],
              },
            ],
          },
          {
            type: 'Section',
            name: 'Chorus',
            items: [
              {
                type: 'Stanza',
                lines: [
                  {
                    type: 'Line',
                    parts: [{ annotation: null, lyrics: 'Chorus', type: 'Annotation' }],
                  },
                ],
              },
            ],
          },
          {
            type: 'Section',
            name: 'Verse 1',
            items: [
              {
                type: 'Stanza',
                lines: [
                  {
                    type: 'Line',
                    parts: [{ annotation: null, lyrics: 'Verse', type: 'Annotation' }],
                  },
                ],
              },
            ],
          },
        ],
        type: 'Song',
        warnings: [],
      },
      'Title\nFlow: Verse 1, Chorus, Verse 1\n\nVerse 1:\nVerse\n\nChorus:\nChorus': {
        metadata: [
          { name: 'title', type: 'Metatag', value: 'Title' },
          { name: 'flow', type: 'Metatag', value: ['Verse 1', 'Chorus', 'Verse 1'] },
        ],
        sections: [
          {
            type: 'Section',
            name: 'Verse 1',
            items: [
              {
                type: 'Stanza',
                lines: [
                  {
                    type: 'Line',
                    parts: [{ annotation: null, lyrics: 'Verse', type: 'Annotation' }],
                  },
                ],
              },
            ],
          },
          {
            type: 'Section',
            name: 'Chorus',
            items: [
              {
                type: 'Stanza',
                lines: [
                  {
                    type: 'Line',
                    parts: [{ annotation: null, lyrics: 'Chorus', type: 'Annotation' }],
                  },
                ],
              },
            ],
          },
          {
            type: 'Section',
            name: 'Verse 1',
            items: [
              {
                type: 'Stanza',
                lines: [
                  {
                    type: 'Line',
                    parts: [{ annotation: null, lyrics: 'Verse', type: 'Annotation' }],
                  },
                ],
              },
            ],
          },
        ],
        type: 'Song',
        warnings: [],
      },
      'Title\nFlow: Chorus, (Repeat 2x)\n\nChorus:\nLyrics': {
        metadata: [
          { name: 'title', type: 'Metatag', value: 'Title' },
          { name: 'flow', type: 'Metatag', value: ['Chorus', { type: 'Instruction', content: 'Repeat 2x' }] },
        ],
        sections: [
          {
            type: 'Section',
            name: 'Chorus',
            items: [
              {
                type: 'Stanza',
                lines: [
                  {
                    type: 'Line',
                    parts: [{ annotation: null, lyrics: 'Lyrics', type: 'Annotation' }],
                  },
                ],
              },
            ],
          },
          {
            type: 'Instruction',
            content: 'Repeat 2x',
          },
        ],
        type: 'Song',
        warnings: [],
      },
      // 'Title\n\nVerse:\n[G]Hello\n\n{transpose: 2}\n\nVerse': {
      //   metadata: [
      //     { name: 'title', type: 'Metatag', value: 'Title' },
      //   ],
      //   sections: [
      //     {
      //       type: 'Section',
      //       name: 'Verse',
      //       items: [
      //         {
      //           lines: [
      //             {
      //               parts: [
      //                 {
      //                   annotation: { type: 'Chord', value: 'G' },
      //                   lyrics: 'Hello',
      //                   type: 'Annotation',
      //                 },
      //               ],
      //               type: 'Line',
      //             },
      //           ],
      //           type: 'Stanza',
      //         },
      //       ],
      //     },
      //     {
      //       type: 'Metatag',
      //       name: 'transpose',
      //       value: '2',
      //     },
      //   ],
      //   type: 'Song',
      //   warnings: [],
      // },
    },
  };

  const grammar = readFileSync('src/grammar.peggy', { encoding: 'utf-8' });
  const { parse, SyntaxError } = peggy.generate(grammar, {
    // Allow starting with these in tests
    allowedStartRules: Object.keys(examples),
    trace: true,
    // output: 'source',
    // format: 'commonjs',
    // plugins: [tspegjs],
  });

  Object.entries(examples).forEach(([startRule, ruleExamples]) => {
    describe(startRule, () => {
      Object.entries(ruleExamples).forEach(([input, expected]) => {
        if (expected === 'todo') {
          test.todo(input);
        } else {
          test(input, () => {
            const tracer = new Tracer(input);
            const warnings = [];

            try {
              const actual = parse(input, { startRule, tracer, warnings });
              expect(actual).toEqual(expected);
              expect(warnings).toEqual([]);
            } catch (e) {
              if (expected === Error) {
                // expected, do nothing
              } else if (e instanceof SyntaxError) {
                const opts = {
                  message: e.message,
                  index: e.location.start.offset,
                  size: e.location.end.offset - e.location.start.offset,
                  input,
                };
                throw new Error([annotate(opts).message, tracer.getBacktraceString()].join('\n\n'));
              } else {
                throw e;
              }
            }
          });
        }
      });
    });
  });
});
