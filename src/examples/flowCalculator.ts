// Spreadsheet example: a compressible flow calculator, recreated from the calculator sheet of
// Tyler's engineering workbook (Flow Calculator V2). One set of named inputs drives the
// isentropic, normal-shock, oblique-shock, Rayleigh, and Fanno relations, plus a Prandtl–Meyer
// table, so editing γ or moving the Mach slider recalculates every panel.
import { emptySheet, type Cell, type SheetDocument } from '../sheet/model'

const INPUT = '#fcf0ce'
const SLIDER = '#e7f0e5'
const HEADING = '#e6eefb'

export function flowCalculatorSheet(): SheetDocument {
  const cells: Record<string, Cell> = {}
  const put = (ref: string, input: string, format: Cell['format'] = undefined) => {
    cells[ref] = format ? { input, format } : { input }
  }
  const heading = (ref: string, text: string) => put(ref, text, { bold: true, fill: HEADING })
  const label = (ref: string, text: string) => put(ref, text)
  const row = (n: number, name: string, formula: string, note = '', fill?: string) => {
    label(`A${n}`, name)
    put(`B${n}`, formula, fill ? { fill } : undefined)
    if (note) put(`C${n}`, note)
  }

  put('A1', 'Compressible Flow Calculator', { bold: true })
  put('A2', 'Perfect gas. Yellow cells are inputs; M and β also have sliders.')

  heading('A4', 'Constants & inputs')
  heading('B4', 'Value')
  heading('C4', 'Note')
  row(5, 'γ (ratio of specific heats)', '1.4', 'air', INPUT)
  row(6, 'R (J/kg·K)', '287.068', 'air', INPUT)
  row(7, 'T (K)', '205', 'static temperature', INPUT)
  row(8, 'P (Pa)', '11600', 'static pressure', INPUT)
  row(9, 'ρ (kg/m³)', '=P/(R*T)', 'ideal gas: P = ρRT')
  row(10, 'cp (J/kg·K)', '=gamma*R/(gamma-1)', 'cp − cv = R')
  row(11, 'a (m/s)', '=SQRT(gamma*R*T)', 'speed of sound')
  row(12, 'M (Mach number)', '2', 'slider: 0.2 to 5', SLIDER)
  row(13, 'u (m/s)', '=M*a', 'flow speed')

  heading('A15', 'Isentropic flow')
  heading('B15', 'Value')
  heading('C15', 'Relation')
  row(16, 'T0 / T', '=1+0.5*(gamma-1)*M^2', '1 + ((γ−1)/2) M²')
  row(17, 'T0 (K)', '=B16*T')
  row(18, 'P0 / P', '=B16^(gamma/(gamma-1))', '(T0/T)^(γ/(γ−1))')
  row(19, 'P0 (Pa)', '=B18*P')
  row(20, 'ρ0 / ρ', '=B16^(1/(gamma-1))', '(T0/T)^(1/(γ−1))')
  row(21, 'ρ0 (kg/m³)', '=B20*B9')
  row(
    22,
    'A / A*',
    '=(1/M)*((2/(gamma+1))*B16)^((gamma+1)/(2*(gamma-1)))',
    'stream tube area relation',
  )
  row(
    23,
    'ṁ / A (kg/s·m²)',
    '=B19*SQRT(gamma)/SQRT(R*B17)*M*B16^(-(gamma+1)/(2*(gamma-1)))',
    'greatest at M = 1',
  )
  row(24, 'Mach angle μ (°)', '=IF(M>=1,DEGREES(ASIN(1/M)),0)', 'supersonic only')
  row(
    25,
    'ν(M) Prandtl–Meyer angle (°)',
    '=IF(M>=1,SQRT((gamma+1)/(gamma-1))*DEGREES(ATAN(SQRT(((gamma-1)/(gamma+1))*(M^2-1))))-DEGREES(ATAN(SQRT(M^2-1))),0)',
    'supersonic only',
  )

  heading('A27', 'Normal shock (M1 = M)')
  heading('B27', 'Value')
  heading('C27', 'Relation')
  row(28, 'M2', '=SQRT((M^2+2/(gamma-1))/(2*gamma*M^2/(gamma-1)-1))', 'subsonic behind the shock')
  row(29, 'P2 / P1', '=(2*gamma*M^2-(gamma-1))/(gamma+1)')
  row(30, 'ρ2 / ρ1', '=(gamma+1)*M^2/((gamma-1)*M^2+2)')
  row(31, 'T2 / T1', '=B29/B30', 'from P and ρ')
  row(
    32,
    'P02 / P01',
    '=(((gamma+1)/2*M^2)/(1+(gamma-1)/2*M^2))^(gamma/(gamma-1))*((2*gamma/(gamma+1))*M^2-(gamma-1)/(gamma+1))^(-1/(gamma-1))',
    'total pressure loss',
  )
  row(33, 'Δs / R', '=-LN(B32)', 'entropy rise')

  heading('A35', 'Oblique shock')
  heading('B35', 'Value')
  heading('C35', 'Relation')
  row(36, 'β wave angle (°)', '40', 'slider: must exceed μ', SLIDER)
  row(
    37,
    'θ deflection (°)',
    '=DEGREES(ATAN(2*COT(RADIANS(beta))*(M^2*SIN(RADIANS(beta))^2-1)/(M^2*(gamma+COS(2*RADIANS(beta)))+2)))',
    'θ–β–M relation',
  )
  row(38, 'M1n', '=M*SIN(RADIANS(beta))', 'normal component')
  row(39, 'M2n', '=SQRT((B38^2+2/(gamma-1))/(2*gamma*B38^2/(gamma-1)-1))')
  row(40, 'M2', '=B39/SIN(RADIANS(beta-B37))')
  row(41, 'P2 / P1', '=(2*gamma*B38^2-(gamma-1))/(gamma+1)')
  row(42, 'ρ2 / ρ1', '=(gamma+1)*B38^2/((gamma-1)*B38^2+2)')
  row(43, 'T2 / T1', '=B41/B42')

  heading('A45', 'Rayleigh flow (heat addition, constant area)')
  heading('B45', 'Value')
  heading('C45', 'Relation')
  row(46, 'T / T*', '=(M*(1+gamma)/(1+gamma*M^2))^2')
  row(47, 'T0 / T0*', '=2*(gamma+1)*M^2*(1+0.5*(gamma-1)*M^2)/(1+gamma*M^2)^2')
  row(48, 'P / P*', '=(1+gamma)/(1+gamma*M^2)')
  row(49, 'P0 / P0*', '=B48*((2/(gamma+1))*(1+0.5*(gamma-1)*M^2))^(gamma/(gamma-1))')

  heading('A51', 'Fanno flow (friction, constant area)')
  heading('B51', 'Value')
  heading('C51', 'Relation')
  row(
    52,
    '4 f L* / D',
    '=(1-M^2)/(gamma*M^2)+(gamma+1)/(2*gamma)*LN((gamma+1)*M^2/(2*(1+0.5*(gamma-1)*M^2)))',
    'duct length to choke',
  )
  row(53, 'T / T*', '=(gamma+1)/(2*(1+0.5*(gamma-1)*M^2))')
  row(54, 'P / P*', '=(1/M)*SQRT(B53)')
  row(55, 'P0 / P0*', '=(1/M)*((2/(gamma+1))*(1+0.5*(gamma-1)*M^2))^((gamma+1)/(2*(gamma-1)))')

  heading('E15', 'M')
  heading('F15', 'ν (°)')
  heading('G15', 'μ (°)')
  put('E14', 'Prandtl–Meyer table', { bold: true })
  for (let i = 0; i < 13; i++) {
    const n = 16 + i
    put(`E${n}`, i === 0 ? '1' : `=E${n - 1}+0.2`)
    put(
      `F${n}`,
      `=SQRT((gamma+1)/(gamma-1))*DEGREES(ATAN(SQRT(((gamma-1)/(gamma+1))*(E${n}^2-1))))-DEGREES(ATAN(SQRT(E${n}^2-1)))`,
    )
    put(`G${n}`, `=DEGREES(ASIN(1/E${n}))`)
  }
  put('E30', 'Each row uses the γ above.')

  return {
    ...emptySheet(),
    rows: 60,
    columns: 8,
    cells,
    widths: { A: 230, B: 120, C: 200, E: 70, F: 90, G: 90 },
    names: { gamma: 'B5', R: 'B6', T: 'B7', P: 'B8', cp: 'B10', a: 'B11', M: 'B12', beta: 'B36' },
    sliders: [
      { id: crypto.randomUUID(), label: 'M', cell: 'B12', min: 0.2, max: 5, step: 0.01 },
      { id: crypto.randomUUID(), label: 'β', cell: 'B36', min: 5, max: 90, step: 0.5 },
    ],
  }
}
