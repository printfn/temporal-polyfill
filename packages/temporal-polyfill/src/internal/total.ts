import { DayTimeNano, dayTimeNanoToNumber, diffDayTimeNanos } from './dayTimeNano'
import { DayTimeUnit, Unit, UnitName, unitNanoMap } from './units'
import { DurationFields, durationFieldDefaults, durationFieldNamesAsc } from './durationFields'
import { DiffOps } from './calendarOps'
import { TimeZoneOps } from './timeZoneOps'
import { DurationSlots } from './slots'
import { TotalUnitOptionsWithRel, refineTotalOptions } from './optionsRefine'
import { MarkerSlots, getLargestDurationUnit, createMarkerSystem, MarkerSystem, spanDuration, MarkerToEpochNano, MoveMarker, DiffMarkers, queryDurationSign, durationFieldsToDayTimeNano, clearDurationFields } from './durationMath'
import * as errorMessages from './errorMessages'

export function totalDuration<RA, C, T>(
  refineRelativeTo: (relativeToArg: RA) => MarkerSlots<C, T> | undefined,
  getCalendarOps: (calendarSlot: C) => DiffOps,
  getTimeZoneOps: (timeZoneSlot: T) => TimeZoneOps,
  slots: DurationSlots,
  options: TotalUnitOptionsWithRel<RA> | UnitName
): number {
  const durationLargestUnit = getLargestDurationUnit(slots)
  const [totalUnit, markerSlots] = refineTotalOptions(options, refineRelativeTo)
  const maxLargestUnit = Math.max(totalUnit, durationLargestUnit)

  if (
    maxLargestUnit < Unit.Day || (
      maxLargestUnit === Unit.Day &&
      !(markerSlots && (markerSlots as any).epochNanoseconds) // has uniform days?
    )
  ) {
    return totalDayTimeDuration(slots, totalUnit as DayTimeUnit)
  }

  if (!markerSlots) {
    throw new RangeError(errorMessages.missingRelativeTo)
  }

  const markerSystem = createMarkerSystem(getCalendarOps, getTimeZoneOps, markerSlots) as MarkerSystem<any>

  return totalRelativeDuration(
    ...spanDuration(slots, undefined, totalUnit, ...markerSystem),
    totalUnit,
    ...markerSystem
  )
}

function totalRelativeDuration<M>(
  durationFields: DurationFields,
  endEpochNano: DayTimeNano,
  totalUnit: Unit,
  // marker system...
  marker: M,
  markerToEpochNano: MarkerToEpochNano<M>,
  moveMarker: MoveMarker<M>,
  diffMarkers?: DiffMarkers<M>
): number {
  const sign = queryDurationSign(durationFields)

  const [epochNano0, epochNano1] = clampRelativeDuration(
    clearDurationFields(durationFields, totalUnit - 1),
    totalUnit,
    sign,
    // marker system...
    marker,
    markerToEpochNano,
    moveMarker
  )

  const frac = computeEpochNanoFrac(epochNano0, epochNano1, endEpochNano)
  return durationFields[durationFieldNamesAsc[totalUnit]] + frac * sign
}

function totalDayTimeDuration(
  durationFields: DurationFields,
  totalUnit: DayTimeUnit
): number {
  return totalDayTimeNano(
    durationFieldsToDayTimeNano(durationFields, Unit.Day),
    totalUnit
  )
}

// Utils for points-within-intervals
// -------------------------------------------------------------------------------------------------

export function totalDayTimeNano(
  dayTimeNano: DayTimeNano,
  totalUnit: DayTimeUnit,
): number {
  return dayTimeNanoToNumber(dayTimeNano, unitNanoMap[totalUnit], true) // exact
}

export function clampRelativeDuration<M>(
  durationFields: DurationFields,
  clampUnit: Unit,
  clampDistance: number,
  // marker system...
  marker: M,
  markerToEpochNano: MarkerToEpochNano<M>,
  moveMarker: MoveMarker<M>,
) {
  const clampDurationFields = {
    ...durationFieldDefaults,
    [durationFieldNamesAsc[clampUnit]]: clampDistance,
  }
  const marker0 = moveMarker(marker, durationFields)
  const marker1 = moveMarker(marker0, clampDurationFields)
  const epochNano0 = markerToEpochNano(marker0)
  const epochNano1 = markerToEpochNano(marker1)
  return [epochNano0, epochNano1]
}

export function computeEpochNanoFrac(
  epochNano0: DayTimeNano,
  epochNano1: DayTimeNano,
  epochNanoProgress: DayTimeNano,
): number {
  const denom = dayTimeNanoToNumber(diffDayTimeNanos(epochNano0, epochNano1))
  if (!denom) {
    throw new RangeError(errorMessages.invalidProtocolResults)
  }
  const numer = dayTimeNanoToNumber(diffDayTimeNanos(epochNano0, epochNanoProgress))
  return numer / denom
}
