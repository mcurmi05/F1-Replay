import { compoundInfo, tyreIcon } from '../lib/replay'

export default function TyreMarker({
  compound,
  size,
}: {
  compound: string | null
  size: number
}) {
  const icon = tyreIcon(compound)
  if (icon) {
    return <img src={icon} alt={compound ?? ''} style={{ width: size, height: size }} />
  }
  if (!compound) {
    return <span className="inline-block shrink-0" style={{ width: size, height: size }} />
  }
  const { letter, color } = compoundInfo(compound)
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className="shrink-0"
      role="img"
      aria-label={compound}
    >
      <title>{compound}</title>
      <circle cx="12" cy="12" r="11" fill="#1c1c20" />
      <circle cx="12" cy="12" r="10" fill="none" stroke={color} strokeWidth="3" />
      <circle cx="12" cy="12" r="6" fill="none" stroke="#1c1c20" strokeWidth="1" />
      <text
        x="12"
        y="12.5"
        textAnchor="middle"
        dominantBaseline="central"
        fill={color}
        fontWeight="700"
        fontSize={letter.length > 1 ? 8 : 11}
        fontFamily="ui-sans-serif, system-ui, sans-serif"
      >
        {letter}
      </text>
    </svg>
  )
}
