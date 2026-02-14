import { appearance, coordinate, group,
         indexedFaceSet, indexedLineSet, material, pointSet,
         scene, shape, sphere, transform, worldInfo, x3d,
         x3dswitch }
  from '@pfern/elements-3d'
import { coordinateAxes } from './util/coordinate-axes.js'
import { gridXY } from './util/grid-xy.js'

// Instantiate shared objects without rendering.
const x3defs = (...defs) => x3dswitch({ whichChoice: -1 }, ...defs)

export default () =>
  x3d({ profile: 'Interchange', version: '3.3' },
      scene(
        worldInfo({ title: 'NonplanarPolygons.x3d' }),
        gridXY(),
        coordinateAxes(),

        x3defs(
          pointSet(
            coordinate({ def: 'points',
                         point: [-1, -1, -1,
                                 +1, -2, 1,
                                 +1, -1, 1,
                                 -1, -2, 1]})),

          appearance({ def: 'black' },
                     material({ diffuseColor: [0, 0, 0]})),

          shape({ def: 'node' },
                appearance({ use: 'black' }),
                sphere({ def: 'dot', radius: .05 })),

          shape({ def: 'edges' },
                indexedLineSet({ coordIndex: [0, 1, 2, 3, 0, -1, 1, 3, -1]},
                               coordinate({ use: 'points' }))),

          shape({ def: 'faces' },
                appearance(material({ transparency: '0.5' })),
                indexedFaceSet({ coordIndex: '0 1 3 -1 1 2 3 -1',
                                 creaseAngle: Math.PI,
                                 solid: 'false' },
                               coordinate({ use: 'points' })))),

        transform({ translation: '0 0 0' },
                  group(
                    shape({ use: 'edges' }),
                    transform({ translation: '-1 -1 3' },
                              shape({ use: 'node' })),
                    transform({ translation: '1 -2 3' },
                              shape({ use: 'node' })),
                    transform({ translation: '1 -1 1' },
                              shape({ use: 'node' })),
                    transform({ translation: '-1 -2 1' },
                              shape({ use: 'node' })))),

        transform({ translation: '0 0 0' },
                  shape({ use: 'faces' }))))

