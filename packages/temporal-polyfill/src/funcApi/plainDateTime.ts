import {
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
import { LocalesArg } from '../internal/intlFormatUtils'
import { formatPlainDateTimeIso } from '../internal/isoFormat'
import {
  computeIsoDayOfWeek,
  computeIsoDaysInWeek,
  computeIsoWeekOfYear,
  computeIsoYearOfWeek,
} from '../internal/isoMath'
import { parsePlainDateTime } from '../internal/isoParse'
import {
  plainDateTimeWithPlainDate,
  plainDateTimeWithPlainTime,
  slotsWithCalendar,
} from '../internal/modify'
import { movePlainDateTime } from '../internal/move'
import { OverflowOptions } from '../internal/optionsRefine'
import { roundPlainDateTime } from '../internal/round'
import {
  PlainDateSlots,
  PlainDateTimeSlots,
  PlainMonthDaySlots,
  PlainTimeSlots,
  PlainYearMonthSlots,
  createPlainDateSlots,
  createPlainTimeSlots,
} from '../internal/slots'
import { queryNativeTimeZone } from '../internal/timeZoneNative'
import { NumberSign, bindArgs } from '../internal/utils'
import { prepCachedPlainDateTimeFormat } from './intlFormatCache'
import {
  computeDateBasics,
  computeDateFields,
  computeDayOfYear,
  computeDaysInMonth,
  computeDaysInYear,
  computeInLeapYear,
  computeMonthsInYear,
  getCalendarIdFromBag,
  refineCalendarIdString,
} from './utils'

export const create = bindArgs(
  constructPlainDateTimeSlots<string, string>,
  refineCalendarIdString,
)

export const fromString = parsePlainDateTime

export function fromFields(
  fields: DateTimeBag & { calendar?: string },
  options?: OverflowOptions,
): PlainDateTimeSlots<string> {
  return refinePlainDateTimeBag(
    createNativeDateRefineOps(getCalendarIdFromBag(fields)),
    fields,
    options,
  )
}

export function getFields(slots: PlainDateTimeSlots<string>): DateTimeFields {
  return {
    ...computeDateFields(slots),
    ...isoTimeFieldsToCal(slots),
  }
}

export const dayOfWeek = computeIsoDayOfWeek as (
  slots: PlainDateTimeSlots<string>,
) => number
export const daysInWeek = computeIsoDaysInWeek as (
  slots: PlainDateTimeSlots<string>,
) => number
export const weekOfYear = computeIsoWeekOfYear as (
  slots: PlainDateTimeSlots<string>,
) => number
export const yearOfWeek = computeIsoYearOfWeek as (
  slots: PlainDateTimeSlots<string>,
) => number
export const dayOfYear = computeDayOfYear as (
  slots: PlainDateTimeSlots<string>,
) => number
export const daysInMonth = computeDaysInMonth as (
  slots: PlainDateTimeSlots<string>,
) => number
export const daysInYear = computeDaysInYear as (
  slots: PlainDateTimeSlots<string>,
) => number
export const monthsInYear = computeMonthsInYear as (
  slots: PlainDateTimeSlots<string>,
) => number
export const inLeapYear = computeInLeapYear as (
  slots: PlainDateTimeSlots<string>,
) => boolean

export function withFields(
  plainDateTimeSlots: PlainDateTimeSlots<string>,
  newFields: DateTimeBag,
  options?: OverflowOptions,
): PlainDateTimeSlots<string> {
  return plainDateTimeWithFields(
    createNativeDateModOps,
    plainDateTimeSlots,
    computeDateBasics(plainDateTimeSlots),
    newFields,
    options,
  )
}

export const withPlainTime = plainDateTimeWithPlainTime as (
  plainDateTimeSlots: PlainDateTimeSlots<string>,
  plainTimeSlots: PlainTimeSlots,
) => PlainDateTimeSlots<string>

export const withPlainDate = plainDateTimeWithPlainDate as (
  plainDateTimeSlots: PlainDateTimeSlots<string>,
  plainDateSlots: PlainDateSlots<string>,
) => PlainDateTimeSlots<string>

export function withCalendar(
  plainDateTimeSlots: PlainDateTimeSlots<string>,
  calendarId: string,
): PlainDateTimeSlots<string> {
  return slotsWithCalendar(
    plainDateTimeSlots,
    refineCalendarIdString(calendarId),
  )
}

export const add = bindArgs(
  movePlainDateTime<string>,
  createNativeMoveOps,
  false,
)
export const subtract = bindArgs(
  movePlainDateTime<string>,
  createNativeMoveOps,
  true,
)

export const until = bindArgs(
  diffPlainDateTimes<string>,
  createNativeDiffOps,
  false,
)
export const since = bindArgs(
  diffPlainDateTimes<string>,
  createNativeDiffOps,
  true,
)

export const round = roundPlainDateTime<string>
export const equals = plainDateTimesEqual<string>
export const compare = compareIsoDateTimeFields as (
  plainDateTimeSlots0: PlainDateTimeSlots<string>,
  plainDateTimeSlots1: PlainDateTimeSlots<string>,
) => NumberSign

export const toString = formatPlainDateTimeIso<string>

export const toZonedDateTime = bindArgs(
  plainDateTimeToZonedDateTime<string, string>,
  queryNativeTimeZone,
)

export const toPlainDate = createPlainDateSlots as (
  plainDateTimeSlots: PlainDateTimeSlots<string>,
) => PlainDateSlots<string>

export function toPlainYearMonth(
  plainDateTimeSlots: PlainDateTimeSlots<string>,
): PlainYearMonthSlots<string> {
  return plainDateTimeToPlainYearMonth(
    createNativeYearMonthRefineOps,
    plainDateTimeSlots,
    computeDateBasics(plainDateTimeSlots),
  )
}

export function toPlainMonthDay(
  plainDateTimeSlots: PlainDateTimeSlots<string>,
): PlainMonthDaySlots<string> {
  return plainDateTimeToPlainMonthDay(
    createNativeMonthDayRefineOps,
    plainDateTimeSlots,
    computeDateBasics(plainDateTimeSlots),
  )
}

export const toPlainTime = createPlainTimeSlots as (
  slots: PlainDateTimeSlots<string>,
) => PlainTimeSlots

export function toLocaleString(
  slots: PlainDateTimeSlots<string>,
  locales?: LocalesArg,
  options?: Intl.DateTimeFormatOptions,
): string {
  const [format, epochMilli] = prepCachedPlainDateTimeFormat(
    locales,
    options,
    slots,
  )
  return format.format(epochMilli)
}

export function toLocaleStringParts(
  slots: PlainDateTimeSlots<string>,
  locales?: LocalesArg,
  options?: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormatPart[] {
  const [format, epochMilli] = prepCachedPlainDateTimeFormat(
    locales,
    options,
    slots,
  )
  return format.formatToParts(epochMilli)
}

export function rangeToLocaleString(
  slots0: PlainDateTimeSlots<string>,
  slots1: PlainDateTimeSlots<string>,
  locales?: LocalesArg,
  options?: Intl.DateTimeFormatOptions,
): string {
  const [format, epochMilli0, epochMilli1] = prepCachedPlainDateTimeFormat(
    locales,
    options,
    slots0,
    slots1,
  )
  return (format as any).formatRange(epochMilli0, epochMilli1!)
}

export function rangeToLocaleStringParts(
  slots0: PlainDateTimeSlots<string>,
  slots1: PlainDateTimeSlots<string>,
  locales?: LocalesArg,
  options?: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormatPart[] {
  const [format, epochMilli0, epochMilli1] = prepCachedPlainDateTimeFormat(
    locales,
    options,
    slots0,
    slots1,
  )
  return (format as any).formatRangeToParts(epochMilli0, epochMilli1!)
}
