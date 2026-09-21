import initialSettings from '../../Design/settings.json' with { type: 'json' }
import { validDesign, type DesignSettings } from './model'

if (!validDesign(initialSettings))
  throw new Error('Design/settings.json contains invalid design settings.')
export const savedDesign: DesignSettings = initialSettings
