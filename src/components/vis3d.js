import { appearance, box, material, scene,
         shape, transform, viewpoint, x3d } from '@pfern/elements-3d'
import { article, div, h2, p } from '@pfern/elements'

const rotateCube = (element, context = { rotation: 0 }, dt) => {
  const { rotation } = context
  element.setAttribute('rotation', `0 1 1 ${rotation}`)
  return {
    ...context,
    rotation: rotation + 0.001 * dt
  }
}

export const vis3d = () =>
  article(
    h2('X3DOM Starter'),
    p('A basic X3D scene rendered via X3DOM.'),
    div({ class: 'x3d-wrapper' },
        x3d({ showstat: 'true' },
            scene(
              viewpoint({ position: '0 0 6', description: 'Default View' }),
              transform({ ontick: rotateCube },
                        shape(
                          appearance(
                            material({ diffuseColor: '0.2 0.6 1.0' })),
                          box({ size: '1 1 1' })))))))

