import initialSettings from '../../Design/settings.json' with { type: 'json' }
import { completeDesign, type DesignSettings } from './registry'

// The saved file may lag behind newly registered fields; those take their defaults.
const complete = completeDesign(initialSettings)
if (!complete) throw new Error('Design/settings.json contains invalid design settings.')
export const savedDesign: DesignSettings = complete
