import { appearance, material, scene,
         shape, torus, transform, viewpoint, x3d } from '@pfern/elements-3d'
import { aside, button, component,
         div, h2, input, label, p, section } from '@pfern/elements'

let speed = 0.001,
    diameter = 1,
    radius = 0.1,
    angle = 0,
    paused = false

const rotate = (element, context = { rotation: 0 }, dt) => {
  const { rotation } = context
  element.setAttribute('rotation', `0 1 ${angle} ${rotation}`)
  element.setAttribute('scale', `${diameter} 1 1`)
  const torus = element.getElementsByTagName('torus')[0]
  torus.setAttribute('innerRadius', `${radius}`)
  return {
    ...context,
    rotation: paused ? 0 : rotation + speed * dt
  }
}

const controls = component(() =>
  aside({ class: 'vis3d-controls' },
        label('Rotation speed'),
        input({ type: 'range', min: 0, max: 0.1, step: 0.001, value: speed,
                oninput: value => { speed = value } }),
        label('Rotation Angle'),
        input({ type: 'range', min: 0, max: 2 * Math.PI,
                step: .01, value: angle,
                oninput: value => { angle = value } }),
        label('Diameter'),
        input({ type: 'range', min: 0, max: 3, step: 0.01, value: diameter,
                oninput: value => { diameter = value } }),
        label('Inner Radius'),
        input({ type: 'range', min: 0.01, max: 1, step: 0.01, value: radius,
                oninput: value => { radius = value } }),
        button({ onclick: () => (paused = !paused, controls()) },
               paused ? 'Play' : 'Pause')))

export const vis3d = () =>
  div(
    h2('X3DOM Starter'),
    p('A basic X3D scene rendered via X3DOM.'),
    section({ class: 'grid' },
            x3d(
              scene(
                viewpoint({ position: '0 0 6', description: 'Default View' }),
                transform(
                  { ontick: rotate },
                  shape(
                    appearance(
                      material({ emissiveColor: '1 0 1' })),
                    torus({ innerRadius: '1', outerRadius: '1.0' }))))),
            controls()))

