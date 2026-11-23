import { useState } from 'react'
import { Alert, Button, Group } from '@mantine/core'
import type { FinenessMetal } from '../../../entities/template/model/types'
import {
  ANALYTICS_METALS,
  formatGrams,
  type CollectionAnalysis,
} from '../../../entities/jewelry/model/analytics'
import { WeightChart } from '../../../features/collection-analytics/ui/WeightChart'
import { MetalPriceEditor } from '../../../features/collection-analytics/ui/MetalPriceEditor'
import { useMetalPrices } from '../../../data/useMetalPrices'
import { formatRubles } from '../../../entities/jewelry/model/pricing'
import classes from './AnalyticsPage.module.scss'
import { leaderComment, valueComment } from '../../../shared/config/playful-copy'

export function AnalyticsPage({
  analysis,
  loading,
  error,
  retry,
}: {
  analysis: CollectionAnalysis
  loading: boolean
  error: string | null
  retry: () => void
}) {
  const [metal, setMetal] = useState<FinenessMetal>('gold')
  const [leaderVariant] = useState(() => Math.floor(Math.random() * 3))
  const [metric, setMetric] = useState<'weight' | 'money'>('weight')
  const pricing = useMetalPrices()
  const price = pricing.prices.find((entry) => entry.id === metal)?.pricePerGram ?? null
  const [dimension, setDimension] = useState<'fineness' | 'type'>('fineness')
  const selected = ANALYTICS_METALS.find((option) => option.value === metal)!
  const stats = analysis.metals[metal]
  const largest = Math.max(0, ...stats.byType.map((group) => group.weight))
  const leaders = stats.byType.filter(
    (group) => largest > 0 && Math.abs(group.weight - largest) < 1e-9,
  )
  return (
    <section className={classes.page} aria-labelledby="analytics-title">
      <header className={classes.intro}>
        <h1 id="analytics-title">Аналитика</h1>
        <p>Самая приятная вкладка во всём приложении</p>
      </header>
      <Group className={classes.metals} role="group" aria-label="Металл для аналитики" grow>
        {ANALYTICS_METALS.map((option) => (
          <Button
            color="var(--accent)"
            key={option.value}
            variant={metal === option.value ? 'filled' : 'default'}
            aria-pressed={metal === option.value}
            onClick={() => setMetal(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </Group>
      {error ? (
        <Alert role="alert" color="red">
          {error}
          <Button color="var(--accent)" onClick={retry}>
            Повторить загрузку
          </Button>
        </Alert>
      ) : loading ? (
        <p role="status">Веду подсчёт богатств…</p>
      ) : (
        <>
          <div className={classes.summary} aria-live="polite">
            <p className={classes.eyebrow}>Украшения из {selected.genitive}</p>
            <p className={classes.total}>
              {formatGrams(stats.weight)} <span>г</span>
            </p>
            <p>
              В твоей шкатулке находится {formatGrams(stats.weight)} г украшений из{' '}
              {selected.genitive}.
            </p>
            {leaders.length > 0 && (
              <p>
                {leaderComment(
                  leaders.map((group) => group.label),
                  formatGrams(largest),
                  leaderVariant,
                )}
              </p>
            )}
            {!pricing.loading && !pricing.error && price !== null && (
              <p>
                Общая стоимость всех твоих украшений из {selected.genitive} составляет{' '}
                <strong>{formatRubles(stats.weight * price)} рублей</strong>.
                {stats.count > 0 && <> {valueComment(stats.weight * price)}</>}
              </p>
            )}
            <p className={classes.muted}>Учтено украшений: {stats.count}.</p>
          </div>
          <div className={classes.summary}>
            {pricing.error ? (
              <Alert role="alert" color="red">
                {pricing.error}
                <Button onClick={pricing.retry} color="var(--accent)">
                  Повторить загрузку цен
                </Button>
              </Alert>
            ) : pricing.loading ? (
              <p role="status">Загружаю цены…</p>
            ) : (
              ANALYTICS_METALS.map((option) => (
                <div key={option.value} hidden={metal !== option.value}>
                  <MetalPriceEditor
                    generation={pricing.generation}
                    value={
                      pricing.prices.find((entry) => entry.id === option.value) ?? {
                        id: option.value,
                        pricePerGram: null,
                        revision: 0,
                      }
                    }
                  />
                </div>
              ))
            )}
            <p className={classes.muted}>
              Оценка по твоей цене: вес × цена за грамм. Цена едина для всех проб выбранного
              металла. Чтобы убрать цену, отчисти поле и сохрани.
            </p>
          </div>
          <div className={classes.chartCard}>
            <Group role="group" aria-label="Показатель графика" grow>
              <Button
                color="var(--accent)"
                variant={metric === 'weight' ? 'filled' : 'default'}
                aria-pressed={metric === 'weight'}
                onClick={() => setMetric('weight')}
              >
                Вес, г
              </Button>
              <Button
                color="var(--accent)"
                variant={metric === 'money' ? 'filled' : 'default'}
                aria-pressed={metric === 'money'}
                onClick={() => setMetric('money')}
              >
                Стоимость, ₽
              </Button>
            </Group>
            <Group role="group" aria-label="Группировка графика" grow>
              <Button
                color="var(--accent)"
                variant={dimension === 'fineness' ? 'filled' : 'default'}
                aria-pressed={dimension === 'fineness'}
                onClick={() => setDimension('fineness')}
              >
                По пробам
              </Button>
              <Button
                color="var(--accent)"
                variant={dimension === 'type' ? 'filled' : 'default'}
                aria-pressed={dimension === 'type'}
                onClick={() => setDimension('type')}
              >
                По типам
              </Button>
            </Group>
            {metric === 'money' && (price === null || pricing.loading || pricing.error) ? (
              <p role="status">
                Чтобы увидеть стоимость, введи и сохрани цену за грамм для выбранного металла.
              </p>
            ) : stats.count ? (
              <WeightChart
                pricePerGram={metric === 'money' ? (price ?? undefined) : undefined}
                groups={dimension === 'fineness' ? stats.byFineness : stats.byType}
                dimension={dimension === 'fineness' ? 'Проба' : 'Тип украшения'}
              />
            ) : (
              <p role="status" className={classes.empty}>
                Пока нет украшений только из {selected.genitive} с указанным весом. Добавь их в
                коллекцию — здесь появится график.
              </p>
            )}
          </div>
          <footer className={classes.notes}>
            <p>
              Сочетания разных цветов золота учитываются в золоте один раз по общему весу. Украшения
              из разных металлов или с другими материалами не учитываются!
              {analysis.multipleMaterials > 0
                ? ` Таких украшений: ${analysis.multipleMaterials}.`
                : ''}
            </p>
            {metal === 'gold' && (
              <p>
                Если пробы золотых сплавов различаются, вес показан в столбце «Несколько проб» без
                разделения между сплавами.
              </p>
            )}
            <p>Используется полный вес из карточек, включая вставки. Это не вес чистого металла.</p>
            {stats.missingWeight > 0 && (
              <p>Без указанного веса не учтено: {stats.missingWeight}.</p>
            )}
          </footer>
        </>
      )}
    </section>
  )
}
