import moment from 'moment'
import {_get} from './generic'

export function coordinateToTimeRatio(
  canvasTimeStart,
  canvasTimeEnd,
  canvasWidth
) {
  return (canvasTimeEnd - canvasTimeStart) / canvasWidth
}

export function calculateXPositionForTime(
  canvasTimeStart,
  canvasTimeEnd,
  canvasWidth,
  time
) {
  const widthToZoomRatio = canvasWidth / (canvasTimeEnd - canvasTimeStart)
  const timeOffset = time - canvasTimeStart

  return timeOffset * widthToZoomRatio
}

export function iterateTimes(start, end, unit, timeSteps, callback) {
  let time = moment(start).startOf(unit)

  if (timeSteps[unit] && timeSteps[unit] > 1) {
    let value = time.get(unit)
    time.set(unit, value - value % timeSteps[unit])
  }

  while (time.valueOf() < end) {
    let nextTime = moment(time).add(timeSteps[unit] || 1, `${unit}s`)
    callback(time, nextTime)
    time = nextTime
  }
}

// this function is VERY HOT as its used in Timeline.js render function
// TODO: check if there are performance implications here
// when "weeks" feature is implemented, this function will be modified heavily

/** determine the current rendered time unit based on timeline time span
 *
 * zoom: (in milliseconds) difference between time start and time end of timeline canvas
 * width: (in pixels) pixel width of timeline canvas
 * timeSteps: map of timeDividers with number to indicate step of each divider
 */

// the smallest cell we want to render is 17px
// this can be manipulated to make the breakpoints change more/less
// i.e. on zoom how often do we switch to the next unit of time
// i think this is the distance between cell lines
export const minCellWidth = 17

export function getMinUnit(zoom, width, timeSteps) {
  if (zoom / 1000 <= 60) {
    return 'second'
  } else if (zoom / 1000 / 60 <= 60) {
    return 'minute'
  } else if (zoom / 1000 / 60 / 60 <= 24) {
    return 'hour'
  } else if (zoom / 1000 / 60 / 60 / 24 <= 7) {
    return 'day'
  } else if (zoom / 1000 / 60 / 60 / 24 / 7 <= 5) {
    return 'week'
  } else if (zoom / 1000 / 60 / 60 / 24 / 31 <= 12) {
    return 'month'
  } else {
    return 'year'
  }
}

export function getNextUnit(unit) {
  let nextUnits = {
    second: 'minute',
    minute: 'hour',
    hour: 'day',
    day: 'week',
    week: 'month',
    month: 'year'
  }

  return nextUnits[unit] || ''
}

export function calculateDimensions({
                                      itemTimeStart,
                                      itemTimeEnd,
                                      isDragging,
                                      isResizing,
                                      canvasTimeStart,
                                      canvasTimeEnd,
                                      canvasWidth,
                                      dragSnap,
                                      dragTime,
                                      resizingEdge,
                                      resizeTime
                                    }) {
  const itemStart =
    isResizing && resizingEdge === 'left' ? resizeTime : itemTimeStart
  const itemEnd =
    isResizing && resizingEdge === 'right' ? resizeTime : itemTimeEnd

  let x = isDragging ? dragTime : itemStart

  let w = Math.max(itemEnd - itemStart, dragSnap)

  let collisionX = itemStart
  let collisionW = w

  if (isDragging) {
    if (itemTimeStart >= dragTime) {
      collisionX = dragTime
      collisionW = Math.max(itemTimeEnd - dragTime, dragSnap)
    } else {
      collisionW = Math.max(dragTime - itemTimeStart + w, dragSnap)
    }
  }

  const ratio =
    1 / coordinateToTimeRatio(canvasTimeStart, canvasTimeEnd, canvasWidth)

  const dimensions = {
    left: (x - canvasTimeStart) * ratio,
    width: Math.max(w * ratio, 3),
    collisionLeft: collisionX,
    originalLeft: itemTimeStart,
    collisionWidth: collisionW
  }

  return dimensions
}

export function getGroupOrders(groups, keys) {
  const {groupIdKey} = keys

  let groupOrders = {}

  for (let i = 0; i < groups.length; i++) {
    groupOrders[_get(groups[i], groupIdKey)] = i
  }

  return groupOrders
}

export function getGroupedItems(items, groupOrders) {
  var arr = []

  // Initialize with empty arrays for each group
  for (let i = 0; i < Object.keys(groupOrders).length; i++) {
    arr[i] = []
  }
  // Populate groups
  for (let i = 0; i < items.length; i++) {
    if (items[i].dimensions.order !== undefined) {
      arr[items[i].dimensions.order].push(items[i])
    }
  }

  return arr
}

export function getVisibleItems(items, canvasTimeStart, canvasTimeEnd, keys) {
  const {itemTimeStartKey, itemTimeEndKey} = keys

  return items.filter(item => {
    return (
      _get(item, itemTimeStartKey) <= canvasTimeEnd &&
      _get(item, itemTimeEndKey) >= canvasTimeStart
    )
  })
}

const EPSILON = 0.001

export function collision(a, b, lineHeight, collisionPadding = EPSILON) {
  // 2d collisions detection - https://developer.mozilla.org/en-US/docs/Games/Techniques/2D_collision_detection
  var verticalMargin = 0

  return (
    a.collisionLeft + collisionPadding < b.collisionLeft + b.collisionWidth &&
    a.collisionLeft + a.collisionWidth - collisionPadding > b.collisionLeft &&
    a.top - verticalMargin + collisionPadding < b.top + b.height &&
    a.top + a.height + verticalMargin - collisionPadding > b.top
  )
}

export function stack(items, groupOrders, lineHeight, force) {
  var i, iMax
  var totalHeight = 0

  var groupHeights = []
  var groupTops = []

  var groupedItems = getGroupedItems(items, groupOrders)

  if (force) {
    // reset top position of all items
    for (i = 0, iMax = items.length; i < iMax; i++) {
      items[i].dimensions.top = null
    }
  }

  groupedItems.forEach(function (group) {
    // calculate new, non-overlapping positions
    groupTops.push(totalHeight)

    var groupHeight = 0
    var verticalMargin = 0
    for (i = 0, iMax = group.length; i < iMax; i++) {
      var item = group[i]
      verticalMargin = lineHeight - item.dimensions.height

      if (item.dimensions.stack && item.dimensions.top === null) {
        item.dimensions.top = totalHeight + verticalMargin
        groupHeight = Math.max(groupHeight, lineHeight)
        do {
          var collidingItem = null
          for (var j = 0, jj = group.length; j < jj; j++) {
            var other = group[j]
            if (
              other.dimensions.top !== null &&
              other !== item &&
              other.dimensions.stack &&
              collision(item.dimensions, other.dimensions, lineHeight)
            ) {
              collidingItem = other
              break
            } else {
              // console.log('dont test', other.top !== null, other !== item, other.stack);
            }
          }

          if (collidingItem != null) {
            // There is a collision. Reposition the items above the colliding element
            item.dimensions.top = collidingItem.dimensions.top + lineHeight
            groupHeight = Math.max(
              groupHeight,
              item.dimensions.top + item.dimensions.height - totalHeight
            )
          }
        } while (collidingItem)
      }
    }

    groupHeights.push(Math.max(groupHeight + verticalMargin, lineHeight))
    totalHeight += Math.max(groupHeight + verticalMargin, lineHeight)
  })
  return {
    height: totalHeight,
    groupHeights,
    groupTops
  }
}

export function nostack(items, groupOrders, lineHeight, force) {
  var i, iMax

  var totalHeight = 0

  var groupHeights = []
  var groupTops = []

  var groupedItems = getGroupedItems(items, groupOrders)

  if (force) {
    // reset top position of all items
    for (i = 0, iMax = items.length; i < iMax; i++) {
      items[i].dimensions.top = null
    }
  }

  groupedItems.forEach(function (group) {
    // calculate new, non-overlapping positions
    groupTops.push(totalHeight)

    var groupHeight = 0
    for (i = 0, iMax = group.length; i < iMax; i++) {
      var item = group[i]
      var verticalMargin = (lineHeight - item.dimensions.height) / 2

      if (item.dimensions.top === null) {
        item.dimensions.top = totalHeight + verticalMargin
        groupHeight = Math.max(groupHeight, lineHeight)
      }
    }

    groupHeights.push(Math.max(groupHeight, lineHeight))
    totalHeight += Math.max(groupHeight, lineHeight)
  })
  return {
    height: totalHeight,
    groupHeights,
    groupTops
  }
}
