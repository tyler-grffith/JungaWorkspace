import { COLORS } from './model'
const NAMES = ['Forest', 'Clay', 'Blue', 'Plum', 'Ochre', 'Teal']
export default function ColorPicker({
  value,
  onChange,
  label,
  disabled,
}: {
  value: string
  onChange: (color: string) => void
  label: string
  disabled: boolean
}) {
  const colors: readonly string[] = COLORS.includes(value as (typeof COLORS)[number])
    ? COLORS
    : [...COLORS, value]
  return (
    <fieldset className="color-picker" disabled={disabled} aria-label={label}>
      <legend>Color</legend>
      <div>
        {colors.map((color, i) => (
          <label key={color} title={NAMES[i] ?? 'Custom'}>
            <input
              type="radio"
              name={label}
              value={color}
              checked={value === color}
              onChange={() => onChange(color)}
            />
            <span className="color-swatch" style={{ backgroundColor: color }} />
            <span>{NAMES[i] ?? 'Custom'}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
