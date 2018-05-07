'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.minCellWidth = undefined;
exports.coordinateToTimeRatio = coordinateToTimeRatio;
exports.calculateXPositionForTime = calculateXPositionForTime;
exports.iterateTimes = iterateTimes;
exports.getMinUnit = getMinUnit;
exports.getNextUnit = getNextUnit;
exports.calculateDimensions = calculateDimensions;
exports.getGroupOrders = getGroupOrders;
exports.getGroupedItems = getGroupedItems;
exports.getVisibleItems = getVisibleItems;
exports.collision = collision;
exports.stack = stack;
exports.nostack = nostack;

var _moment = require('moment');

var _moment2 = _interopRequireDefault(_moment);

var _generic = require('./generic');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function coordinateToTimeRatio(canvasTimeStart, canvasTimeEnd, canvasWidth) {
  return (canvasTimeEnd - canvasTimeStart) / canvasWidth;
}

function calculateXPositionForTime(canvasTimeStart, canvasTimeEnd, canvasWidth, time) {
  var widthToZoomRatio = canvasWidth / (canvasTimeEnd - canvasTimeStart);
  var timeOffset = time - canvasTimeStart;

  return timeOffset * widthToZoomRatio;
}

function iterateTimes(start, end, unit, timeSteps, callback) {
  var time = (0, _moment2.default)(start).startOf(unit);

  if (timeSteps[unit] && timeSteps[unit] > 1) {
    var value = time.get(unit);
    time.set(unit, value - value % timeSteps[unit]);
  }

  while (time.valueOf() < end) {
    var nextTime = (0, _moment2.default)(time).add(timeSteps[unit] || 1, unit + 's');
    callback(time, nextTime);
    time = nextTime;
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
var minCellWidth = exports.minCellWidth = 17;

function getMinUnit(zoom, width, timeSteps) {
  if (zoom / 1000 <= 60) {
    return 'second';
  } else if (zoom / 1000 / 60 <= 60) {
    return 'minute';
  } else if (zoom / 1000 / 60 / 60 <= 24) {
    return 'hour';
  } else if (zoom / 1000 / 60 / 60 / 24 <= 7) {
    return 'day';
  } else if (zoom / 1000 / 60 / 60 / 24 / 7 <= 5) {
    return 'week';
  } else if (zoom / 1000 / 60 / 60 / 24 / 31 <= 12) {
    return 'month';
  } else {
    return 'year';
  }
}

function getNextUnit(unit) {
  var nextUnits = {
    second: 'minute',
    minute: 'hour',
    hour: 'day',
    day: 'week',
    week: 'month',
    month: 'year'
  };

  return nextUnits[unit] || '';
}

function calculateDimensions(_ref) {
  var itemTimeStart = _ref.itemTimeStart,
      itemTimeEnd = _ref.itemTimeEnd,
      isDragging = _ref.isDragging,
      isResizing = _ref.isResizing,
      canvasTimeStart = _ref.canvasTimeStart,
      canvasTimeEnd = _ref.canvasTimeEnd,
      canvasWidth = _ref.canvasWidth,
      dragSnap = _ref.dragSnap,
      dragTime = _ref.dragTime,
      resizingEdge = _ref.resizingEdge,
      resizeTime = _ref.resizeTime;

  var itemStart = isResizing && resizingEdge === 'left' ? resizeTime : itemTimeStart;
  var itemEnd = isResizing && resizingEdge === 'right' ? resizeTime : itemTimeEnd;

  var x = isDragging ? dragTime : itemStart;

  var w = Math.max(itemEnd - itemStart, dragSnap);

  var collisionX = itemStart;
  var collisionW = w;

  if (isDragging) {
    if (itemTimeStart >= dragTime) {
      collisionX = dragTime;
      collisionW = Math.max(itemTimeEnd - dragTime, dragSnap);
    } else {
      collisionW = Math.max(dragTime - itemTimeStart + w, dragSnap);
    }
  }

  var ratio = 1 / coordinateToTimeRatio(canvasTimeStart, canvasTimeEnd, canvasWidth);

  var dimensions = {
    left: (x - canvasTimeStart) * ratio,
    width: Math.max(w * ratio, 3),
    collisionLeft: collisionX,
    originalLeft: itemTimeStart,
    collisionWidth: collisionW
  };

  return dimensions;
}

function getGroupOrders(groups, keys) {
  var groupIdKey = keys.groupIdKey;


  var groupOrders = {};

  for (var i = 0; i < groups.length; i++) {
    groupOrders[(0, _generic._get)(groups[i], groupIdKey)] = i;
  }

  return groupOrders;
}

function getGroupedItems(items, groupOrders) {
  var arr = [];

  // Initialize with empty arrays for each group
  for (var i = 0; i < Object.keys(groupOrders).length; i++) {
    arr[i] = [];
  }
  // Populate groups
  for (var _i = 0; _i < items.length; _i++) {
    if (items[_i].dimensions.order !== undefined) {
      arr[items[_i].dimensions.order].push(items[_i]);
    }
  }

  return arr;
}

function getVisibleItems(items, canvasTimeStart, canvasTimeEnd, keys) {
  var itemTimeStartKey = keys.itemTimeStartKey,
      itemTimeEndKey = keys.itemTimeEndKey;


  return items.filter(function (item) {
    return (0, _generic._get)(item, itemTimeStartKey) <= canvasTimeEnd && (0, _generic._get)(item, itemTimeEndKey) >= canvasTimeStart;
  });
}

var EPSILON = 0.001;

function collision(a, b, lineHeight) {
  var collisionPadding = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : EPSILON;

  // 2d collisions detection - https://developer.mozilla.org/en-US/docs/Games/Techniques/2D_collision_detection
  var verticalMargin = 0;

  return a.collisionLeft + collisionPadding < b.collisionLeft + b.collisionWidth && a.collisionLeft + a.collisionWidth - collisionPadding > b.collisionLeft && a.top - verticalMargin + collisionPadding < b.top + b.height && a.top + a.height + verticalMargin - collisionPadding > b.top;
}

function stack(items, groupOrders, lineHeight, force) {
  var i, iMax;
  var totalHeight = 0;

  var groupHeights = [];
  var groupTops = [];

  var groupedItems = getGroupedItems(items, groupOrders);

  if (force) {
    // reset top position of all items
    for (i = 0, iMax = items.length; i < iMax; i++) {
      items[i].dimensions.top = null;
    }
  }

  groupedItems.forEach(function (group) {
    // calculate new, non-overlapping positions
    groupTops.push(totalHeight);

    var groupHeight = 0;
    var verticalMargin = 0;
    for (i = 0, iMax = group.length; i < iMax; i++) {
      var item = group[i];
      verticalMargin = lineHeight - item.dimensions.height;

      if (item.dimensions.stack && item.dimensions.top === null) {
        item.dimensions.top = totalHeight + verticalMargin;
        groupHeight = Math.max(groupHeight, lineHeight);
        do {
          var collidingItem = null;
          for (var j = 0, jj = group.length; j < jj; j++) {
            var other = group[j];
            if (other.dimensions.top !== null && other !== item && other.dimensions.stack && collision(item.dimensions, other.dimensions, lineHeight)) {
              collidingItem = other;
              break;
            } else {
              // console.log('dont test', other.top !== null, other !== item, other.stack);
            }
          }

          if (collidingItem != null) {
            // There is a collision. Reposition the items above the colliding element
            item.dimensions.top = collidingItem.dimensions.top + lineHeight;
            groupHeight = Math.max(groupHeight, item.dimensions.top + item.dimensions.height - totalHeight);
          }
        } while (collidingItem);
      }
    }

    groupHeights.push(Math.max(groupHeight + verticalMargin, lineHeight));
    totalHeight += Math.max(groupHeight + verticalMargin, lineHeight);
  });
  return {
    height: totalHeight,
    groupHeights: groupHeights,
    groupTops: groupTops
  };
}

function nostack(items, groupOrders, lineHeight, force) {
  var i, iMax;

  var totalHeight = 0;

  var groupHeights = [];
  var groupTops = [];

  var groupedItems = getGroupedItems(items, groupOrders);

  if (force) {
    // reset top position of all items
    for (i = 0, iMax = items.length; i < iMax; i++) {
      items[i].dimensions.top = null;
    }
  }

  groupedItems.forEach(function (group) {
    // calculate new, non-overlapping positions
    groupTops.push(totalHeight);

    var groupHeight = 0;
    for (i = 0, iMax = group.length; i < iMax; i++) {
      var item = group[i];
      var verticalMargin = (lineHeight - item.dimensions.height) / 2;

      if (item.dimensions.top === null) {
        item.dimensions.top = totalHeight + verticalMargin;
        groupHeight = Math.max(groupHeight, lineHeight);
      }
    }

    groupHeights.push(Math.max(groupHeight, lineHeight));
    totalHeight += Math.max(groupHeight, lineHeight);
  });
  return {
    height: totalHeight,
    groupHeights: groupHeights,
    groupTops: groupTops
  };
}