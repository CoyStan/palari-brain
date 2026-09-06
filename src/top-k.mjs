// Stable bounded selection. The heap keeps the worst retained item at its
// root, so each new item needs at most log(k) comparisons. Only k items sort.
export function boundedTopK(values, limit, compare) {
  if (!Number.isSafeInteger(limit) || limit < 0) {
    throw new TypeError('top-k limit must be a non-negative safe integer.')
  }
  if (limit === 0) return []
  const heap = []
  const order = (a, b) => compare(a.value, b.value) || a.ordinal - b.ordinal
  let ordinal = 0
  for (const value of values) {
    const item = { value, ordinal: ordinal++ }
    if (heap.length < limit) {
      heap.push(item)
      let child = heap.length - 1
      while (child > 0) {
        const parent = Math.floor((child - 1) / 2)
        if (order(heap[child], heap[parent]) <= 0) break
        ;[heap[child], heap[parent]] = [heap[parent], heap[child]]
        child = parent
      }
    } else if (order(item, heap[0]) < 0) {
      heap[0] = item
      let parent = 0
      while (parent * 2 + 1 < heap.length) {
        let child = parent * 2 + 1
        if (child + 1 < heap.length && order(heap[child + 1], heap[child]) > 0) child++
        if (order(heap[child], heap[parent]) <= 0) break
        ;[heap[child], heap[parent]] = [heap[parent], heap[child]]
        parent = child
      }
    }
  }
  return heap.sort(order).map(item => item.value)
}
