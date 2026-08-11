// Deterministic, repository-owned SCALE-05 corpus. It is generated locally,
// contains no user data, and needs no external dataset or licence grant. The
// varied distractors fix the repeated-filler limitation of the plumbing probe;
// the explicit target/query pairs remain a small diagnostic, not a benchmark.

import { PLANTED } from './scale-recall-fixture.mjs'

export const DEFAULT_LOCATOR_CORPUS_SIZE = 5_000
export const DEFAULT_LOCATOR_MINIMUM_TIER = 2_000

const PEOPLE = [
  'Aisha', 'Bruno', 'Chloe', 'Diego', 'Elena', 'Farah', 'Gabriel', 'Hana',
  'Idris', 'Jun', 'Klara', 'Luca', 'Maya', 'Niko', 'Olivia', 'Pavel',
  'Rina', 'Samir', 'Talia', 'Umar', 'Vera', 'Wei', 'Ximena', 'Yara',
]
const PLACES = [
  'archive room', 'bakery', 'community hall', 'design studio', 'east lobby',
  'ferry terminal', 'greenhouse', 'harbor office', 'instrument workshop',
  'junction cafe', 'kitchen annex', 'library atrium', 'makerspace',
  'north warehouse', 'observatory', 'practice room', 'quiet carriage',
  'riverside clinic',
]
const PROJECTS = [
  'atlas migration', 'bridge survey', 'cobalt launch', 'dahlia catalog',
  'ember redesign', 'forest inventory', 'gallery opening', 'harbor cleanup',
  'isotope study', 'juniper rollout', 'kestrel audit', 'lantern festival',
  'meadow restoration', 'night-train timetable', 'orchard map', 'paper archive',
]
const OBJECTS = [
  'adapter', 'badge', 'camera battery', 'document pouch', 'extension cable',
  'field notebook', 'garage remote', 'helmet', 'instrument case', 'jacket',
  'kitchen scale', 'lamp key', 'microphone', 'navigation card', 'office stamp',
  'passport wallet',
]
const CONTAINERS = [
  'amber crate', 'bottom drawer', 'canvas bag', 'desk cabinet', 'equipment bin',
  'front locker', 'glass cupboard', 'hall closet', 'insulated box',
  'juniper chest', 'kitchen basket', 'linen cabinet',
]
const CITIES = [
  'Antwerp', 'Bologna', 'Cardiff', 'Dresden', 'Edinburgh', 'Florence',
  'Gdańsk', 'Helsinki', 'Innsbruck', 'Jaén', 'Kyoto', 'Ljubljana',
  'Malmö', 'Nantes', 'Oslo', 'Porto',
]
const FOODS = [
  'almond soup', 'barley salad', 'citrus cake', 'dumplings', 'eggplant stew',
  'fig toast', 'ginger noodles', 'herb rice', 'iced yogurt', 'juniper bread',
  'kale tart', 'lentil pie', 'mushroom broth', 'nut-free granola',
  'olive pasta', 'pumpkin curry',
]
const ACTIVITIES = [
  'archery', 'birdwatching', 'ceramics', 'dance class', 'evening cycling',
  'fencing practice', 'garden work', 'hill walking', 'indoor climbing',
  'jazz rehearsal', 'kayaking', 'language class',
]
const DEVICES = [
  'archive server', 'bike computer', 'conference tablet', 'door controller',
  'editing workstation', 'field recorder', 'garden sensor', 'home router',
  'inventory scanner', 'kitchen timer', 'label printer', 'media console',
]
const WEEKDAYS = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
]
const TIMES = [
  '06:20', '07:45', '08:30', '09:10', '10:40', '11:55',
  '13:15', '14:35', '15:50', '17:05', '18:25', '20:10',
]
const COLORS = [
  'amber', 'blue', 'coral', 'denim', 'emerald', 'fuchsia',
  'graphite', 'hazel', 'indigo', 'jade', 'khaki', 'lilac',
]

function positiveSafeInteger(value, label) {
  const number = Number(value)
  if (!Number.isSafeInteger(number) || number < 1) {
    throw new TypeError(`${label} must be a positive safe integer.`)
  }
  return number
}

function mix32(input) {
  let value = input >>> 0
  value ^= value >>> 16
  value = Math.imul(value, 0x7feb352d)
  value ^= value >>> 15
  value = Math.imul(value, 0x846ca68b)
  value ^= value >>> 16
  return value >>> 0
}

function pick(values, index, salt) {
  return values[mix32(index ^ salt) % values.length]
}

function dateFor(index) {
  return new Date(Date.UTC(2010, 0, 1) + index * 86_400_000)
    .toISOString().slice(0, 10)
}

function generatedDistractor(index) {
  const person = pick(PEOPLE, index, 0x10203040)
  const other = pick(PEOPLE, index, 0x50607080)
  const place = pick(PLACES, index, 0x13579bdf)
  const project = pick(PROJECTS, index, 0x2468ace0)
  const object = pick(OBJECTS, index, 0x31415926)
  const container = pick(CONTAINERS, index, 0x27182818)
  const city = pick(CITIES, index, 0xabcdef01)
  const food = pick(FOODS, index, 0x10fedcba)
  const activity = pick(ACTIVITIES, index, 0x55667788)
  const device = pick(DEVICES, index, 0x88776655)
  const weekday = pick(WEEKDAYS, index, 0x0badf00d)
  const time = pick(TIMES, index, 0x00c0ffee)
  const color = pick(COLORS, index, 0x5ca1ab1e)
  const date = dateFor(index)
  const amount = 35 + (mix32(index ^ 0x42424242) % 9_500)
  const number = 100 + (mix32(index ^ 0x12121212) % 9_900)
  const templates = [
    () => `On ${date}, ${person} moved the ${project} review to ${weekday} at ${time} in the ${place}.`,
    () => `For the ${city} trip logged on ${date}, ${person} packed the ${color} ${object} and chose seat ${number % 40 + 1}${String.fromCharCode(65 + number % 4)}.`,
    () => `The ${device} backup was set on ${date} for ${weekday} at ${time}; failure notices go to ${person}.`,
    () => `${person} noted on ${date} that ${food} works well after ${activity}, especially when meeting ${other} at the ${place}.`,
    () => `The spare ${object} was placed in the ${container} beside the ${place}; ${person} checked it on ${date}.`,
    () => `A ${amount}-euro renewal for the ${project} is due on ${date}, and ${person} keeps the receipt in the ${container}.`,
    () => `${person}'s ${color} bicycle gets its next service on ${date} at ${time} near the ${place}; booking reference ${number}.`,
    () => `The ${project} study group meets every ${weekday} at ${time} in the ${place}; ${other} has the notes dated ${date}.`,
    () => `On ${date}, ${person} received a ${amount}-euro repair quote for the ${device} from the workshop in ${city}.`,
    () => `The ${color} garden bed is watered on ${weekday} mornings; ${person} changed the timer to ${time} on ${date}.`,
    () => `${person} will collect the ${project} event pass at the ${place} desk ${number % 30 + 1} on ${date}.`,
    () => `The ${device} account recovery card is in the ${container}; ${other} verified its reference ${number} on ${date}.`,
    () => `For the recipe dated ${date}, ${person} uses ${food} with ${amount % 12 + 1} grams of ${color} pepper after ${activity}.`,
    () => `${other} arrives from ${city} at ${time} on ${date}; ${person} will wait by the ${place} with the ${object}.`,
    () => `${person} scheduled the ${device} inspection for ${date} at ${time} and filed case ${color}-${number} under the ${project}.`,
    () => `The ${object} belongs on shelf ${number % 18 + 1} in the ${place}; the inventory note was updated by ${person} on ${date}.`,
    () => `${person} prefers ${activity} on ${weekday} evenings and keeps the ${color} ${object} in the ${container}; note dated ${date}.`,
    () => `The ${project} deposit is ${amount} euros and stays refundable through ${date}; ${other} recorded it at the ${place}.`,
    () => `${person} added ${food}, a ${color} ${object}, and device batteries to the ${date} shopping list for ${city}.`,
    () => `At ${time} on ${date}, ${other} transferred responsibility for the ${project} archive in the ${place} to ${person}.`,
  ]
  const templateIndex = index % templates.length
  return Object.freeze({
    domain: [
      'planning', 'travel', 'devices', 'preferences', 'household',
      'finance', 'transport', 'learning', 'repairs', 'garden',
      'events', 'accounts', 'recipes', 'arrivals', 'appointments',
      'inventory', 'routines', 'bookings', 'shopping', 'work',
    ][templateIndex],
    text: templates[templateIndex](),
  })
}

export function createLocatorQualityCorpus({
  minimumTier = DEFAULT_LOCATOR_MINIMUM_TIER,
  size = DEFAULT_LOCATOR_CORPUS_SIZE,
} = {}) {
  const corpusSize = positiveSafeInteger(size, 'size')
  const firstTier = positiveSafeInteger(minimumTier, 'minimumTier')
  if (corpusSize > 100_000) throw new TypeError('size must be at most 100000.')
  if (firstTier > corpusSize) {
    throw new TypeError('minimumTier must not exceed size.')
  }
  if (firstTier < PLANTED.length * 2) {
    throw new TypeError('minimumTier is too small to distribute every target.')
  }

  const targetByPosition = new Map(PLANTED.map((row, index) => [
    Math.floor((index + 1) * firstTier / (PLANTED.length + 1)),
    { index, row },
  ]))
  if (targetByPosition.size !== PLANTED.length) {
    throw new Error('target positions must be unique.')
  }

  const records = []
  const targets = []
  let distractorIndex = 0
  for (let position = 0; position < corpusSize; position += 1) {
    const id = `memory-${String(position + 1).padStart(5, '0')}`
    const target = targetByPosition.get(position)
    if (target) {
      const record = Object.freeze({
        domain: 'labeled-target',
        id,
        kind: 'target',
        text: target.row[0],
      })
      records.push(record)
      targets.push(Object.freeze({ id, row: target.row, targetIndex: target.index }))
      continue
    }
    const generated = generatedDistractor(distractorIndex)
    distractorIndex += 1
    records.push(Object.freeze({
      domain: generated.domain,
      id,
      kind: 'distractor',
      text: generated.text,
    }))
  }

  const queries = targets.flatMap(({ id: targetId, row, targetIndex }) => [
    Object.freeze({
      family: 'shared-token',
      id: `target-${String(targetIndex + 1).padStart(2, '0')}-shared`,
      targetId,
      text: row[1],
    }),
    Object.freeze({
      family: 'zero-overlap',
      id: `target-${String(targetIndex + 1).padStart(2, '0')}-zero`,
      targetId,
      text: row[2],
    }),
  ])

  if (new Set(records.map(({ text }) => text)).size !== records.length) {
    throw new Error('locator quality corpus must contain unique texts.')
  }
  return Object.freeze({
    licence: 'MIT repository-owned synthetic text',
    queries: Object.freeze(queries),
    records: Object.freeze(records),
  })
}
