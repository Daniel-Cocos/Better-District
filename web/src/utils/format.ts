export const formatNumber = (n: number) => new Intl.NumberFormat('en-GB').format(n)

export function greeting(date = new Date()) {
  const h = date.getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}
