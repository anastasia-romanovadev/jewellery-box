import { formatRubles } from '../../../entities/jewelry/model/pricing'
import { useId } from 'react'
import { useElementSize } from '@mantine/hooks'
import { formatGrams, type WeightGroup } from '../../../entities/jewelry/model/analytics'
import classes from './WeightChart.module.scss'

export function WeightChart({
  groups: weightGroups,
  dimension,
  pricePerGram,
}: {
  groups: WeightGroup[]
  pricePerGram?: number
  dimension: 'Проба' | 'Тип украшения'
}) {
  const money = pricePerGram !== undefined
  const title = money ? 'Стоимость' : 'Вес'
  const unit = money ? '₽' : 'г'
  const format = money ? formatRubles : formatGrams
  const formatChart = (value: number) =>
    money && value >= 10_000
      ? value.toLocaleString('ru-RU', { notation: 'compact', maximumFractionDigits: 1 })
      : format(value)
  const groups = weightGroups.map((group) => ({
    ...group,
    weight: group.weight * (pricePerGram ?? 1),
  }))
  const left = money ? 80 : 64
  const titleId = useId()
  const { ref, width: availableWidth } = useElementSize<HTMLDivElement>()
  const maximum = Math.max(1, ...groups.map((group) => group.weight))
  const magnitude = 10 ** Math.floor(Math.log10(maximum / 4))
  const step = Math.ceil(maximum / 4 / magnitude) * magnitude
  const ceiling = step * 4
  const minimumColumns = groups.map((group) =>
    dimension === 'Проба' && /^\d+$/.test(group.label) ? (money ? 64 : 36) : 80,
  )
  const minimumPlotWidth = minimumColumns.reduce((sum, value) => sum + value, 0)
  const width = Math.max(320, Math.floor(availableWidth), minimumPlotWidth + left + 16)
  const columns = minimumColumns.map(
    (value) => value + (width - left - 16 - minimumPlotWidth) / groups.length,
  )
  const plotHeight = 220
  const baseline = 264
  return (
    <figure className={classes.figure}>
      <figcaption id={titleId}>
        {title} по {dimension === 'Проба' ? 'пробам' : 'типам украшений'}
      </figcaption>
      <div
        ref={ref}
        className={classes.scroll}
        tabIndex={0}
        role="region"
        aria-label={`График ${money ? 'стоимости' : 'веса'}, прокручивается по горизонтали`}
      >
        <svg
          className={classes.chart}
          style={{ minWidth: width }}
          viewBox={`0 0 ${width} 352`}
          role="img"
          aria-labelledby={titleId}
        >
          <text x="0" y="18" className={classes.axisTitle}>
            {title}, {unit}
          </text>
          {[0, 1, 2, 3, 4].map((tick) => {
            const y = baseline - (tick * plotHeight) / 4
            return (
              <g key={tick}>
                <line x1={left - 9} x2={width} y1={y} y2={y} className={classes.gridLine} />
                <text x={left - 17} y={y + 4} textAnchor="end">
                  {formatChart(step * tick)}
                </text>
              </g>
            )
          })}
          {groups.map((group, index) => {
            const column = columns[index]
            const center =
              left + columns.slice(0, index).reduce((sum, value) => sum + value, 0) + column / 2
            const height = (group.weight / ceiling) * plotHeight
            const barWidth = Math.min(40, column * 0.65)
            const words = group.label
              .split(' ')
              .slice(0, 2)
              .map((word) => (word.length > 10 ? `${word.slice(0, 9)}…` : word))
            if (group.label.split(' ').length > 2) words[1] += '…'
            return (
              <g key={group.id}>
                <title>
                  {group.label}: {format(group.weight)} {unit}
                </title>
                <rect
                  x={center - barWidth / 2}
                  y={baseline - height}
                  width={barWidth}
                  height={height}
                  rx="4"
                  className={classes.bar}
                />
                <text
                  x={center}
                  y={baseline - height - 8}
                  textAnchor="middle"
                  className={classes.value}
                >
                  {formatChart(group.weight)}
                </text>
                <text x={center} y={baseline + 22} textAnchor="middle">
                  {words.map((word, i) => (
                    <tspan key={i} x={center} dy={i ? 15 : 0}>
                      {word}
                    </tspan>
                  ))}
                </text>
              </g>
            )
          })}
          <text x={width / 2} y="343" textAnchor="middle" className={classes.axisTitle}>
            {dimension}
          </text>
        </svg>
      </div>
      {availableWidth > 0 && width > availableWidth + 1 && (
        <p className={classes.hint}>Проведи по графику вбок, чтобы увидеть все столбцы.</p>
      )}
      <details className={classes.table}>
        <summary>Посмотреть значения таблицей</summary>
        <table>
          <caption>
            {title} украшений по {dimension === 'Проба' ? 'пробам' : 'типам'}
          </caption>
          <thead>
            <tr>
              <th scope="col">{dimension}</th>
              <th scope="col">
                {title}, {unit}
              </th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <tr key={group.id}>
                <th scope="row">{group.label}</th>
                <td>{format(group.weight)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  )
}
