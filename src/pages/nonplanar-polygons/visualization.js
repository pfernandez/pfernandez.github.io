import { appearance, coordinate, group, indexedFaceSet, indexedLineSet,
         material, pointSet, scene, shape, sphere, transform, worldInfo, x3d }
  from '@pfern/elements-x3dom'
import { coordinateAxes, generateLineIndices, generateTriangleIndices, gridXY,
         x3defs } from './utils'

const options = {
  latticeColor: [0, 0, 0],
  point: [[-1, -1, 3], [1, -2, 3], [1, -1, 1], [-1, -2, 1]],
  coordIndexFaces: generateTriangleIndices(2, 2),
  coordIndexLines: generateLineIndices(2, 2)
}

const defs = (
  { coordIndexFaces, coordIndexLines, latticeColor, point } = options) =>
  x3defs(
    appearance({ def: 'latticeColor' },
               material({ diffuseColor: latticeColor })),

    pointSet(
      coordinate({ def: 'points', point })),

    shape({ def: 'node' },
          appearance({ use: 'latticeColor' }),
          sphere({ def: 'dot', radius: .05 })),

    shape({ def: 'edges' },
      // FIXME: Consider working with pairs/segments to simplify
      // indexedLineSet({ coordIndex: coordIndexLines },
          indexedLineSet({ coordIndex: [0, 1, 2, 3, 0, -1, 1, 3, -1]},
                         coordinate({ use: 'points' }))),

    group({ def: 'lattice' },
          shape({ use: 'edges' }),
          ...point.map(xyz =>
            transform({ translation: xyz }, shape({ use: 'node' })))),

    shape({ def: 'faces' },
          appearance(material({ transparency: '0.5' })),
          indexedFaceSet({ coordIndex: coordIndexFaces,
                           // creaseAngle: Math.PI,  // smooth curves
                           solid: 'false' },
                         coordinate({ use: 'points' }))))

export default () =>
  x3d({ profile: 'Interchange', version: '3.3' },
      scene(
        worldInfo({ title: 'NonplanarPolygons.x3d' }),
        gridXY(),
        coordinateAxes(),
        defs(),

        transform({ translation: '0 0 0' },
                  group({ use: 'lattice' })),

        transform({ translation: '0 0 0' },
                  shape({ use: 'faces' }))))

