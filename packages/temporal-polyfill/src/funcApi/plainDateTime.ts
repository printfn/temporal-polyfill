import {
  PlainDateTimeBag,
  isoTimeFieldsToCal,
  plainDateTimeWithFields,
  refinePlainDateTimeBag,
} from '../internal/bagRefine'
import {
  createNativeDateModOps,
  createNativeDateRefineOps,
  createNativeDiffOps,
  createNativeMonthDayRefineOps,
  createNativeMoveOps,
  createNativeYearMonthRefineOps,
} from '../internal/calendarNativeQuery'
import {
  compareIsoDateTimeFields,
  plainDateTimesEqual,
} from '../internal/compare'
import { constructPlainDateTimeSlots } from '../internal/construct'
import {
  plainDateTimeToPlainMonthDay,
  plainDateTimeToPlainYearMonth,
  plainDateTimeToZonedDateTime,
} from '../internal/convert'
import { diffPlainDateTimes } from '../internal/diff'
import { DateTimeBag, DateTimeFields } from '../internal/fields'
import { createFormatPrepper, dateTimeConfig } from '../internal/intlFormatPrep'
import { LocalesArg } from '../internal/intlFormatUtils'
import { formatPlainDateTimeIso } from '../internal/isoFormat'
import { computeIsoDayOfWeek, computeIsoDaysInWeek } from '../internal/isoMath'
import { parsePlainDateTime } from '../internal/isoParse'
import {
  plainDateTimeWithPlainDate,
  plainDateTimeWithPlainTime,
  slotsWithCalendar,
} from '../internal/modify'
import { movePlainDateTime } from '../internal/move'
import {
  DateTimeDisplayOptions,
  DiffOptions,
  EpochDisambigOptions,
  OverflowOptions,
  RoundOptions,
} from '../internal/optionsRefine'
import { roundPlainDateTime } from '../internal/round'
import {
  PlainDateTimeSlots,
  createPlainDateSlots,
  createPlainTimeSlots,
} from '../internal/slots'
import { queryNativeTimeZone } from '../internal/timeZoneNative'
import { NumberSign, bindArgs, memoize } from '../internal/utils'
import * as DurationFns from './duration'
import { createFormatCache } from './intlFormatCache'
import * as PlainDateFns from './plainDate'
import * as PlainMonthDayFns from './plainMonthDay'
import * as PlainTimeFns from './plainTime'
import * as PlainYearMonthFns from './plainYearMonth'
import {
  computeDateFields,
  computeDayOfYear,
  computeDaysInMonth,
  computeDaysInYear,
  computeInLeapYear,
  computeMonthsInYear,
  computeWeekOfYear,
  computeYearOfWeek,
  getCalendarIdFromBag,
  refineCalendarIdString,
} from './utils'
import * as ZonedDateTimeFns from './zonedDateTime'

export type Record = Readonly<PlainDateTimeSlots<string>>
export type Fields = DateTimeFields
export type Bag = DateTimeBag
export type BagWithCalendar = PlainDateTimeBag<string>

// Creation / Parsing
// -----------------------------------------------------------------------------

export const create = bindArgs(
  constructPlainDateTimeSlots<string, string>,
  refineCalendarIdString,
) as (
  isoYear: number,
  isoMonth: number,
  isoDay: number,
  isoHour?: number,
  isoMinute?: number,
  isoSecond?: number,
  isoMillisecond?: number,
  isoMicrosecond?: number,
  isoNanosecond?: number,
  calendar?: string,
) => Record

export function fromFields(
  fields: BagWithCalendar,
  options?: OverflowOptions,
): Record {
  return refinePlainDateTimeBag(
    createNativeDateRefineOps(getCalendarIdFromBag(fields)),
    fields,
    options,
  )
}

export const fromString = parsePlainDateTime as (s: string) => Record

// Getters
// -----------------------------------------------------------------------------

export const getFields = memoize((record: Record): Fields => {
  return {
    ...computeDateFields(record),
    ...isoTimeFieldsToCal(record),
  }
}, WeakMap)

export const dayOfWeek = computeIsoDayOfWeek as (record: Record) => number

export const daysInWeek = computeIsoDaysInWeek as (record: Record) => number

export const weekOfYear = computeWeekOfYear as (
  record: Record,
) => number | undefined

export const yearOfWeek = computeYearOfWeek as (
  record: Record,
) => number | undefined

export const dayOfYear = computeDayOfYear as (record: Record) => number

export const daysInMonth = computeDaysInMonth as (record: Record) => number

export const daysInYear = computeDaysInYear as (record: Record) => number

export const monthsInYear = computeMonthsInYear as (record: Record) => number

export const inLeapYear = computeInLeapYear as (record: Record) => boolean

// Setters
// -----------------------------------------------------------------------------

export function withFields(
  record: Record,
  bag: Bag,
  options?: OverflowOptions,
): Record {
  return plainDateTimeWithFields(
    createNativeDateModOps,
    record,
    getFields(record),
    bag,
    options,
  )
}

export function withCalendar(record: Record, calendar: string): Record {
  return slotsWithCalendar(record, refineCalendarIdString(calendar))
}

export const withPlainDate = plainDateTimeWithPlainDate as (
  plainDateTimeRecord: Record,
  plainDateRecord: PlainDateFns.Record,
) => Record

export const withPlainTime = plainDateTimeWithPlainTime as (
  plainDateTimeRecord: Record,
  plainTimeRecord?: PlainTimeFns.Record,
) => Record

// Math
// -----------------------------------------------------------------------------

export const add = bindArgs(
  movePlainDateTime<string>,
  createNativeMoveOps,
  false,
) as (plainDateTimeRecord: Record, durationRecord: DurationFns.Record) => Record

export const subtract = bindArgs(
  movePlainDateTime<string>,
  createNativeMoveOps,
  true,
) as (plainDateTimeRecord: Record, durationRecord: DurationFns.Record) => Record

export const until = bindArgs(
  diffPlainDateTimes<string>,
  createNativeDiffOps,
  false,
) as (
  record0: Record,
  record1: Record,
  options?: DiffOptions,
) => DurationFns.Record

export const since = bindArgs(
  diffPlainDateTimes<string>,
  createNativeDiffOps,
  true,
) as (
  record0: Record,
  record1: Record,
  options?: DiffOptions,
) => DurationFns.Record

export const round = roundPlainDateTime<string> as (
  record: Record,
  options: RoundOptions,
) => Record

export const equals = plainDateTimesEqual<string> as (
  record0: Record,
  record1: Record,
) => boolean

export const compare = compareIsoDateTimeFields as (
  record0: Record,
  record1: Record,
) => NumberSign

// Conversion
// -----------------------------------------------------------------------------

export const toZonedDateTime = bindArgs(
  plainDateTimeToZonedDateTime<string, string>,
  queryNativeTimeZone,
) as (
  record: Record,
  timeZone: string,
  options?: EpochDisambigOptions,
) => ZonedDateTimeFns.Record

export const toPlainDate = createPlainDateSlots as (
  record: Record,
) => PlainDateFns.Record

export const toPlainTime = createPlainTimeSlots as (
  record: Record,
) => PlainTimeFns.Record

export function toPlainYearMonth(record: Record): PlainYearMonthFns.Record {
  return plainDateTimeToPlainYearMonth(
    createNativeYearMonthRefineOps,
    record,
    getFields(record),
  )
}

export function toPlainMonthDay(record: Record): PlainMonthDayFns.Record {
  return plainDateTimeToPlainMonthDay(
    createNativeMonthDayRefineOps,
    record,
    getFields(record),
  )
}

// Formatting
// -----------------------------------------------------------------------------

export const toString = formatPlainDateTimeIso<string> as (
  record: Record,
  options?: DateTimeDisplayOptions,
) => string

const prepFormat = createFormatPrepper(
  dateTimeConfig,
  /*@__PURE__*/ createFormatCache(),
)

export function toLocaleString(
  record: Record,
  locales?: LocalesArg,
  options?: Intl.DateTimeFormatOptions,
): string {
  const [format, epochMilli] = prepFormat(locales, options, record)
  return format.format(epochMilli)
}

export function toLocaleStringParts(
  record: Record,
  locales?: LocalesArg,
  options?: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormatPart[] {
  const [format, epochMilli] = prepFormat(locales, options, record)
  return format.formatToParts(epochMilli)
}

export function rangeToLocaleString(
  record0: Record,
  record1: Record,
  locales?: LocalesArg,
  options?: Intl.DateTimeFormatOptions,
): string {
  const [format, epochMilli0, epochMilli1] = prepFormat(
    locales,
    options,
    record0,
    record1,
  )
  return (format as any).formatRange(epochMilli0, epochMilli1!)
}

export function rangeToLocaleStringParts(
  record0: Record,
  record1: Record,
  locales?: LocalesArg,
  options?: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormatPart[] {
  const [format, epochMilli0, epochMilli1] = prepFormat(
    locales,
    options,
    record0,
    record1,
  )
  return (format as any).formatRangeToParts(epochMilli0, epochMilli1!)
}
