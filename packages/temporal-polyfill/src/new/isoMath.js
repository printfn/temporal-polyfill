import { isoTimeFieldNamesAsc, pluckIsoDateTimeFields } from './isoFields'
import { compareLargeInts, numberToLargeInt } from './largeInt'
import { clampProp, rejectI } from './options' // use 1 instead of rejectI?
import {
  givenFieldsToNano,
  hourIndex,
  milliInSec,
  nanoInMicro,
  nanoInMilli,
  nanoInSec,
  nanoInUtcDay,
  nanoToGivenFields,
} from './units'
import { divFloorMod } from './utils'

// ISO Calendar
// -------------------------------------------------------------------------------------------------

export const isoEpochOriginYear = 1970
export const isoEpochFirstLeapYear = 1972
export const isoMonthsInYear = 12
export const isoDaysInWeek = 7

export function computeIsoMonthsInYear(isoYear) { // for methods
  return isoMonthsInYear
}

export function computeIsoDaysInMonth(isoYear, isoMonth) {
  switch (isoMonth) {
    case 2:
      return computeIsoIsLeapYear(isoYear) ? 29 : 28
    case 4:
    case 6:
    case 9:
    case 11:
      return 30
  }
  return 31
}

export function computeIsoDaysInYear(isoYear) {
  return computeIsoIsLeapYear(isoYear) ? 365 : 366
}

export function computeIsoIsLeapYear(isoYear) {
  return isoYear % 4 === 0 && (isoYear % 100 !== 0 || isoYear % 400 === 0)
}

export function computeIsoDayOfWeek(isoDateFields) {
  return isoToLegacyDate(isoDateFields).getDay() + 1
}

export function computeIsoWeekOfYear(isoDateFields) {
}

export function computeIsoYearOfWeek(isoDateFields) {
}

// Constraining
// -------------------------------------------------------------------------------------------------

export function constrainIsoDateTimeInternals(isoDateTimeInternals) {
  return validateIsoDateTimeInternals({
    ...constrainIsoDateInternals(isoDateTimeInternals),
    ...constrainIsoTimeFields(isoDateTimeInternals),
  })
}

export function constrainIsoDateInternals(isoDateInternals) {
  const daysInMonth = computeIsoDaysInMonth(isoDateInternals.isoYear, isoDateInternals.isoMonth)
  return validateIsoDateTimeInternals({
    calendar: isoDateInternals.calendar,
    isoYear: isoDateInternals.isoYear,
    isoMonth: clampProp(isoDateInternals, 'isoMonth', 1, isoMonthsInYear, rejectI),
    isoDay: clampProp(isoDateInternals, 'isoDay', 1, daysInMonth, rejectI),
  })
}

export function constrainIsoTimeFields(isoTimeFields, overflowI = rejectI) {
  // TODO: clever way to compress this, using functional programming
  // Will this kill need for clampProp?
  return {
    isoHour: clampProp(isoTimeFields, 'isoHour', 0, 23, overflowI),
    isoMinute: clampProp(isoTimeFields, 'isoMinute', 0, 59, overflowI),
    isoSecond: clampProp(isoTimeFields, 'isoSecond', 0, 59, overflowI),
    isoMillisecond: clampProp(isoTimeFields, 'isoMillisecond', 0, 999, overflowI),
    isoMicrosecond: clampProp(isoTimeFields, 'isoMicrosecond', 0, 999, overflowI),
    isoNanosecond: clampProp(isoTimeFields, 'isoNanosecond', 0, 999, overflowI),
  }
}

// Field <-> Nanosecond Conversion
// -------------------------------------------------------------------------------------------------

export function isoTimeFieldsToNano(isoTimeFields) {
  return givenFieldsToNano(isoTimeFields, hourIndex, isoTimeFieldNamesAsc)
}

export function nanoToIsoTimeAndDay(nano) {
  const [dayDelta, timeNano] = divFloorMod(nano, nanoInUtcDay)
  const isoTimeFields = nanoToGivenFields(timeNano, hourIndex, isoTimeFieldNamesAsc)
  return [isoTimeFields, dayDelta]
}

// Epoch Unit Conversion
// -------------------------------------------------------------------------------------------------

// nano -> [micro/milli/sec] (with floor)

export function epochNanoToSec(epochNano) {
  return epochNanoToSecMod(epochNano)[0].toNumber()
}

export function epochNanoToMilli(epochNano) {
  return epochNanoToMilliMod(epochNano)[0].toNumber()
}

function epochNanoToMicro(epochNano) {
  return epochNanoToMicroMod(epochNano)[0].toBigInt()
}

// nano -> [micro/milli/sec] (with remainder)

export function epochNanoToSecMod(epochNano) {
  return epochNano.divFloorMod(nanoInSec)
}

function epochNanoToMilliMod(epochNano) {
  return epochNano.divFloorMod(nanoInMilli)
}

function epochNanoToMicroMod(epochNano) {
  return epochNano.divFloorMod(nanoInMicro)
}

// [micro/milli/sec] -> nano

export function epochSecToNano(epochSec) {
  return numberToLargeInt(epochSec).mult(nanoInSec)
}

export function epochMilliToNano(epochMilli) {
  return numberToLargeInt(epochMilli).mult(nanoInMilli)
}

export function epochMicroToNano(epochMicro) {
  return epochMicro.mult(nanoInMicro)
}

// Epoch Getters
// -------------------------------------------------------------------------------------------------

export const epochGetters = {
  epochSeconds: epochNanoToSec,
  epochMilliseconds: epochNanoToMilli,
  epochMicroseconds: epochNanoToMicro,
  epochNanoseconds(epochNano) {
    return epochNano.toBigInt()
  },
}

// Validation
// -------------------------------------------------------------------------------------------------

const epochNanoMax = numberToLargeInt(nanoInUtcDay).mult(100000000) // inclusive
const epochNanoMin = epochNanoMax.mult(-1) // inclusive
const isoYearMax = 275760 // optimization. isoYear at epochNanoMax
const isoYearMin = -271821 // optimization. isoYear at epochNanoMin

function validateIsoDateTimeInternals(isoDateTimeInternals) { // validateIsoInternals?
  const isoYear = clampProp(isoDateTimeInternals, 'isoYear', isoYearMin, isoYearMax, rejectI)
  const nudge = isoYear === isoYearMin ? 1 : isoYear === isoYearMax ? -1 : 0

  if (nudge) {
    const epochNano = isoToEpochNano(isoDateTimeInternals)
    validateEpochNano(epochNano && epochNano.addNumber((nanoInUtcDay - 1) * nudge))
  }

  return isoDateTimeInternals
}

export function validateEpochNano(epochNano) {
  if (
    epochNano === undefined ||
    compareLargeInts(epochNano, epochNanoMin) === 1 || // epochNano < epochNanoMin
    compareLargeInts(epochNanoMax, epochNano) === 1 // epochNanoMax < epochNano
  ) {
    throw new RangeError('aahh')
  }
  return epochNano
}

// ISO <-> Epoch Conversion
// -------------------------------------------------------------------------------------------------

// ISO Fields -> Epoch
// (could be out-of-bounds, return undefined!)

export function isoToEpochSec(isoDateTimeFields) {
  const epochSec = isoArgsToEpochSec(
    isoDateTimeFields.year,
    isoDateTimeFields.month,
    isoDateTimeFields.day,
    isoDateTimeFields.hour,
    isoDateTimeFields.minute,
    isoDateTimeFields.second,
  )
  const subsecNano =
    isoDateTimeFields.millisecond * nanoInMilli +
    isoDateTimeFields.microsecond * nanoInMicro +
    isoDateTimeFields.nanosecond

  return [epochSec, subsecNano]
}

export function isoToEpochMilli(isoDateTimeFields) {
  return isoArgsToEpochMilli(...pluckIsoDateTimeFields(isoDateTimeFields))
}

export function isoToEpochNano(isoDateTimeFields) {
  // if invalid, should return undefined
}

// ISO Arguments -> Epoch
// (could be out-of-bounds, return undefined!)

export function isoArgsToEpochSec(...args) { // doesn't accept beyond sec
  return isoArgsToEpochMilli(...args) / milliInSec // no need for rounding
}

export function isoArgsToEpochMilli(
  isoYear,
  isoMonth = 1,
  isoDate, // rest are optional...
  isoHour,
  isMinute,
  isoSec,
  isoMilli,
) {
}

function isoToLegacyDate(isoDateTimeFields) {
}

// Epoch -> ISO Fields

export function epochNanoToIso() {
}

export function epochMilliToIso() {
}

// Comparison
// -------------------------------------------------------------------------------------------------

export function compareIsoDateTimeFields() {
  // TODO: (use Math.sign technique?)
}

export function compareIsoTimeFields() {
}
