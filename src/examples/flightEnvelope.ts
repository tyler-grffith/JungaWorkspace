// Graphing example: the XJ-1 jet aircraft flight envelope, recreated from Tyler's Desmos
// model (see FLIGHT_ENVELOPE_URL). Power required and power available against ground speed,
// at sea level and at altitude, with the density ratio as the one slider the reader moves.
import {
  emptyGraph,
  type GraphDocument,
  type GraphEntry,
  type ParameterEntry,
} from '../graph/model'

export const FLIGHT_ENVELOPE_URL = 'https://www.desmos.com/calculator/kf3ehjzzrw'

const RED = '#a84832'
const BLUE = '#3e68ae'
const GREEN = '#27664c'
const PURPLE = '#8653a1'
const INK = '#1f1f1f'

const constant = (name: string, value: number): ParameterEntry => ({
  id: crypto.randomUUID(),
  kind: 'parameter',
  name,
  value,
  min: value,
  max: value,
  step: 1,
  mode: 'constant',
})
const curve = (
  formula: string,
  color: string,
  label = '',
  visible = true,
  kind: 'expression' | 'implicit' = 'expression',
): GraphEntry => ({ id: crypto.randomUUID(), kind, formula, label, color, visible })
const note = (text: string): GraphEntry => ({ id: crypto.randomUUID(), kind: 'note', text })

export function flightEnvelopeGraph(): GraphDocument {
  return {
    ...emptyGraph(),
    // Speed spans a thousand feet per second and power tens of millions of lb·ft/s, so the axes
    // scale independently; the view starts at the curves' domain rather than in the undefined band.
    equalAxes: false,
    viewport: { xMin: -30, xMax: 1060, yMin: -3500000, yMax: 17000000 },
    entries: [
      note(
        'XJ-1 flight envelope (US units). x is ground speed V in ft/s; y is power in lb·ft/s.\nMove s, the air density ratio ρ/ρ₀: 1 at sea level, 0.271 near 38,000 ft.',
      ),
      {
        id: crypto.randomUUID(),
        kind: 'parameter',
        name: 's',
        value: 0.2711,
        min: 0.2711,
        max: 1,
        step: 0.0001,
        mode: 'slider',
      },
      curve(
        'P_R(V) = (0.5 * p_h * S * C_D0 * V^3 + 2 * W^2 / (p_h * S * pi * e_O * A_R * V)) / sqrt(s) {0 < V < 1000}',
        RED,
        'Power required',
      ),
      curve('P_A(V) = sqrt(s) * T_A0 * V {0 < V < 1000}', BLUE, 'Power available'),
      curve('P_ex(V) = P_A(V) - P_R(V)', INK, 'Excess power'),
      curve(
        'P_R0(V) = 0.5 * p_0 * S * C_D0 * V^3 + 2 * W^2 / (p_0 * S * pi * e_O * A_R * V) {0 < V < 1000}',
        RED,
        'Sea level power required',
      ),
      curve('P_A0(V) = T_A0 * V {0 < V < 1000}', BLUE, 'Sea level power available'),
      curve(
        'P_R(x) - P_A(x) = 0 {0 < y < P_A(x)}',
        GREEN,
        'V min and V max: no excess power',
        true,
        'implicit',
      ),
      curve(
        'dP_ex(V) = sqrt(s) * T_A0 - (1.5 * p_h * S * C_D0 * V^2 - 2 * W^2 / (p_h * S * pi * e_O * A_R * V^2)) / sqrt(s)',
        GREEN,
        'd(P_ex)/dV',
        false,
      ),
      curve('dP_ex(x) = 0 {0 < y < P_A(x)}', GREEN, 'V of best rate of climb', true, 'implicit'),
      note(
        'Parameters. Author-side values: the constants below are the design point; change one to see the envelope move.',
      ),
      constant('b', 54.4),
      constant('S', 542.5),
      curve('A_R = b^2 / S', PURPLE, 'Aspect ratio'),
      constant('W', 42000),
      constant('T_A0', 13200),
      constant('C_D0', 0.028),
      constant('e_O', 0.9),
      constant('p_0', 0.0023769),
      curve('p_h = p_0 * s', PURPLE, 'Density at altitude'),
      note(
        'b: wingspan (ft). S: wing area (ft²). W: weight (lb). T_A0: sea level thrust (lb). C_D0: zero-lift drag coefficient. e_O: Oswald efficiency. p_0: sea level density (slug/ft³).',
      ),
    ],
  }
}
