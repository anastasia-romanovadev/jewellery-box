export const collectionTaglines = [
  'Всё нажитое блестящим трудом',
  'Хитрость — умение, которое помогает восстановить справедливость в этом жестоком мире',
  'Современная версия сокровищницы',
  'Много украшений не бывает',
]

export function weightComment(grams: number) {
  if (grams < 50) return 'Маловато однако, ты точно всё записала?'
  if (grams < 100) return 'Отличная работа!'
  return 'Я отказываюсь комментировать это число.'
}

export function countComment(count: number) {
  if (count < 10) return 'Что-то маловато, остальные точно не спрятались в другой шкатулке?'
  if (count < 20) return 'Отличная коллекция! Сразу видно, человек знает толк в украшениях.'
  return 'Я сбилась со счёта. Хорошо, что приложение считает за меня.'
}

export function valueComment(rubles: number) {
  if (rubles < 50_000) return 'Тут даже на айфон не хватит, это несерьёзно.'
  if (rubles < 150_000)
    return 'Неплохо, тебе давно пора часы обновить, а этого хватит больше чем на 5 штук!'
  if (rubles < 500_000) return 'Хватит, чтобы послать бабку далеко-далеко…'
  if (rubles < 1_000_000) return 'Нууу ты даёшь, этого на мотоцикл, кстати, хватит)))'
  if (rubles < 2_000_000)
    return 'Вот прикинь, как дофига, а хату в Питере на эти деньги всё равно не купить)'
  return 'Считай, это ещё одна квартира в Сухом Логу! Да, начиная с ляма я считаю деньги исключительно в квартирах… Хотя с нынешними ценами это смешно.'
}

export function leaderComment(labels: string[], formattedWeight: string, variant: number) {
  const names = labels.map((label) => `«${label}»`).join(', ')
  const weight = `${formattedWeight} г${labels.length > 1 ? ' в каждой категории' : ''}`
  if (variant === 0) return `По весу побеждают ${names} — ${weight}. Любимчиков видно сразу.`
  if (variant === 1) return `Главные тяжеловесы — ${names}: ${weight}.`
  return `Первое место у ${labels.length > 1 ? 'категорий' : 'категории'} ${names} — ${weight}. Аплодисменты, пожалуйста!`
}
