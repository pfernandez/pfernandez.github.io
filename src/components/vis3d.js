import { article, div, h2, p } from '@pfern/elements'
import { appearance, box, material, scene,
         shape, transform, viewpoint, x3d } from '@pfern/elements'

export const vis3d = () =>
  article(
    h2('X3DOM Starter'),
    p('A basic X3D scene rendered via X3DOM.'),
    div({ class: 'x3d-wrapper' },
      x3d(
        scene(
          viewpoint({ position: '0 0 6', description: 'Default View' }),
          transform({ rotation: '0 1 0 0.5' },
            shape(
              appearance(
                material({ diffuseColor: '0.2 0.6 1.0' })),
              box()))))))

