// Visual canvas example: Tyler's PDR visuals diagram, shipped with the app as the original
// draw.io file (images downscaled to fit the canvas document budget) and imported through the
// canvas module's own importer, so the example is exactly what an imported diagram looks like.
import { emptyCanvas, type CanvasDocument } from '../canvas/model'
import { importDrawio } from '../canvas/drawio'

export const PDR_VISUALS_URL =
  'https://drive.google.com/file/d/16moehRBgRZ52y1qJSM_U38dZRi9xgsN6/view?usp=sharing'
export const PDR_VISUALS_FILE = 'assets/examples/PDR_visuals.drawio'

export async function pdrVisualsCanvas(): Promise<CanvasDocument> {
  const response = await fetch(`${import.meta.env.BASE_URL}${PDR_VISUALS_FILE}`)
  if (!response.ok) throw new Error('The PDR visuals diagram could not be loaded from the app.')
  const result = await importDrawio(await response.text(), emptyCanvas('board'))
  return result.document
}
