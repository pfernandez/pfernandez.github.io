import { color, coordinate, group, indexedLineSet, shape, transform }
  from '@pfern/elements-3d'

export const gridXY = () =>
  group(
    transform(
      { DEF: 'GridLocation', rotation: '1 0 0 1.57079' },
      shape(
        { DEF: 'LinesAlignedAlongZ' },
        indexedLineSet(
          { colorIndex: '1 0 0 0 0 2 0 0 0 0 1 0 0 0 0 2 0 0 0 0 1',
            colorPerVertex: 'false',
            coordIndex: '1 22 -1 2 23 -1 3 24 -1 4 25 -1 5 26 -1 6 27 -1 7 28 -1 8 29 -1 9 30 -1 10 31 -1 11 32 -1 12 33 -1 13 34 -1 14 35 -1 15 36 -1 16 37 -1 17 38 -1 18 39 -1 19 40 -1 20 41 -1 21 42 -1' },
          coordinate(
            { DEF: 'EndPoints',
              point: '0 0 0 -10 0 10 -9 0 10 -8 0 10 -7 0 10 -6 0 10 -5 0 10 -4 0 10 -3 0 10 -2 0 10 -1 0 10 0 0 10 1 0 10 2 0 10 3 0 10 4 0 10 5 0 10 6 0 10 7 0 10 8 0 10 9 0 10 10 0 10 -10 0 -10 -9 0 -10 -8 0 -10 -7 0 -10 -6 0 -10 -5 0 -10 -4 0 -10 -3 0 -10 -2 0 -10 -1 0 -10 0 0 -10 1 0 -10 2 0 -10 3 0 -10 4 0 -10 5 0 -10 6 0 -10 7 0 -10 8 0 -10 9 0 -10 10 0 -10' }),
          color({ color: '0.4 0.4 0.4 0.8 0.2 0 0.4 0.1 0.05' }))),
      transform({ DEF: 'LinesAlignedAlongX', rotation: '0 1 0 1.57079' },
                shape({ USE: 'LinesAlignedAlongZ' }))))

