import { expect } from 'vitest'
import {
  bigIntToDayTimeNano,
  dayTimeNanoToBigInt,
} from '../internal/dayTimeNano'
import { computeDurationSign } from '../internal/durationMath'
import { IsoDateFields, IsoDateTimeFields } from '../internal/isoFields'
import { isoToEpochNano } from '../internal/timeMath'
import { DurationBag, DurationSlots } from './duration'
import * as InstantFns from './instant'
import * as PlainDateFns from './plainDate'
import * as PlainDateTimeFns from './plainDateTime'
import * as PlainMonthDayFns from './plainMonthDay'
import * as PlainTimeFns from './plainTime'
import * as PlainYearMonthFns from './plainYearMonth'
import * as ZonedDateTimeFns from './zonedDateTime'

// Current
// -----------------------------------------------------------------------------

const systemResolvedOptions = new Intl.DateTimeFormat().resolvedOptions()
export const systemTimeZoneId = systemResolvedOptions.timeZone

export function getCurrentInstant() {
  return InstantFns.fromEpochMilliseconds(Date.now())
}

export function getCurrentZonedDateTime(
  calendar: string,
  timeZone: string,
): ZonedDateTimeFns.ZonedDateTimeSlots<string, string> {
  return InstantFns.toZonedDateTime(getCurrentInstant(), { timeZone, calendar })
}

// Equality
// -----------------------------------------------------------------------------
// All props should be alphabetized because they serve as a base for
// constructing comparable slots, retaining order.

const isoDateDefaults = {
  isoDay: 0,
  isoMonth: 0,
  isoYear: 0,
}

const isoDateTimeDefaults = {
  isoDay: 0,
  isoHour: 0,
  isoMicrosecond: 0,
  isoMillisecond: 0,
  isoMinute: 0,
  isoMonth: 0,
  isoNanosecond: 0,
  isoSecond: 0,
  isoYear: 0,
}

const plainDateDefaults = {
  branding: 'PlainDate',
  calendar: 'iso8601',
  ...isoDateDefaults,
}

const plainYearMonthDefaults = {
  branding: 'PlainYearMonth',
  calendar: 'iso8601',
  ...isoDateDefaults,
  isoDay: 1,
}

const plainMonthDayDefaults = {
  branding: 'PlainMonthDay',
  calendar: 'iso8601',
  ...isoDateDefaults,
  isoYear: 1972,
}

const plainDateTimeDefaults = {
  branding: 'PlainDateTime',
  calendar: 'iso8601',
  ...isoDateTimeDefaults,
}

const zonedDateTimeDefaults = {
  branding: 'ZonedDateTime',
  calendar: 'iso8601',
  timeZone: '',
  epochNanoseconds: 0n,
}

const instantSlotDefaults = {
  branding: 'Instant',
  epochNanoseconds: 0n,
}

const durationSlotDefaults = {
  branding: 'Duration',
  sign: 0,
  days: 0,
  hours: 0,
  microseconds: 0,
  milliseconds: 0,
  minutes: 0,
  months: 0,
  nanoseconds: 0,
  seconds: 0,
  weeks: 0,
  years: 0,
}

export function expectPlainDateEquals(
  pd: PlainDateFns.PlainDateSlots<string>,
  slots: Partial<IsoDateFields & { calendar: string }>,
): void {
  expectPropsEqualStrict(pd, {
    ...plainDateDefaults,
    ...slots,
  })
}

export function expectPlainYearMonthEquals(
  pym: PlainYearMonthFns.PlainYearMonthSlots<string>,
  slots: Partial<IsoDateFields & { calendar: string }>,
): void {
  expectPropsEqualStrict(pym, {
    ...plainYearMonthDefaults,
    ...slots,
  })
}

export function expectPlainMonthDayEquals(
  pym: PlainMonthDayFns.PlainMonthDaySlots<string>,
  slots: Partial<IsoDateFields & { calendar: string }>,
): void {
  expectPropsEqualStrict(pym, {
    ...plainMonthDayDefaults,
    ...slots,
  })
}

export function expectPlainDateTimeEquals(
  pdt: PlainDateTimeFns.PlainDateTimeSlots<string>,
  slots: Partial<IsoDateTimeFields & { calendar: string }>,
): void {
  expectPropsEqualStrict(pdt, {
    ...plainDateTimeDefaults,
    ...slots,
  })
}

export function expectZonedDateTimeEquals(
  zdt: ZonedDateTimeFns.ZonedDateTimeSlots<string, string>,
  slots: { epochNanoseconds: bigint; timeZone: string; calendar?: string },
): void {
  expectPropsEqualStrict(zdt, {
    ...zonedDateTimeDefaults,
    ...slots,
    epochNanoseconds: bigIntToDayTimeNano(slots.epochNanoseconds),
  })
}

export function expectInstantEquals(
  inst: InstantFns.InstantSlots,
  epochNanoseconds: bigint,
): void {
  expectPropsEqualStrict(inst, {
    ...instantSlotDefaults,
    epochNanoseconds: bigIntToDayTimeNano(epochNanoseconds),
  })
}

export function expectDurationEquals(d: DurationSlots, bag: DurationBag): void {
  const bagToSlots = {
    ...durationSlotDefaults,
    ...bag,
  }
  expectPropsEqualStrict(d, {
    ...bagToSlots,
    sign: computeDurationSign(bagToSlots),
  })
}

function expectPropsEqualStrict(obj0: {}, obj1: {}): void {
  expect(obj0).toStrictEqual(obj1)
  expect(Object.keys(obj0)).toStrictEqual(Object.keys(obj1))
}

// Similarity
// -----------------------------------------------------------------------------

export function expectInstantsSimilar(
  inst0: InstantFns.InstantSlots,
  inst1: InstantFns.InstantSlots,
): void {
  expect(inst0.branding).toBe('Instant')
  expect(inst1.branding).toBe('Instant')
  expectEpochNanosSimilar(
    InstantFns.epochNanoseconds(inst0),
    InstantFns.epochNanoseconds(inst1),
  )
}

export function expectZonedDateTimesSimilar(
  zdt0: ZonedDateTimeFns.ZonedDateTimeSlots<string, string>,
  zdt1: ZonedDateTimeFns.ZonedDateTimeSlots<string, string>,
): void {
  expect(zdt0.branding).toBe('ZonedDateTime')
  expect(zdt1.branding).toBe('ZonedDateTime')
  expect(zdt0.calendar).toBe(zdt1.calendar)
  expect(zdt0.timeZone).toBe(zdt1.timeZone)
  expectEpochNanosSimilar(
    ZonedDateTimeFns.epochNanoseconds(zdt0),
    ZonedDateTimeFns.epochNanoseconds(zdt1),
  )
}

export function expectPlainDateTimesSimilar(
  pdt0: PlainDateTimeFns.PlainDateTimeSlots<string>,
  pdt1: PlainDateTimeFns.PlainDateTimeSlots<string>,
): void {
  expect(pdt0.branding).toBe('PlainDateTime')
  expect(pdt1.branding).toBe('PlainDateTime')
  expect(pdt0.calendar).toBe(pdt1.calendar)
  expectEpochNanosSimilar(
    dayTimeNanoToBigInt(isoToEpochNano(pdt0)!),
    dayTimeNanoToBigInt(isoToEpochNano(pdt1)!),
  )
}

export function expectPlainDatesSimilar(
  pd0: PlainDateFns.PlainDateSlots<string>,
  pd1: PlainDateFns.PlainDateSlots<string>,
): void {
  expect(pd0.branding).toBe('PlainDate')
  expect(pd1.branding).toBe('PlainDate')
  expect(pd0.calendar).toBe(pd1.calendar)
  expectEpochNanosSimilar(
    dayTimeNanoToBigInt(isoToEpochNano(pd0)!),
    dayTimeNanoToBigInt(isoToEpochNano(pd1)!),
  )
}

export function expectPlainTimesSimilar(
  pt0: PlainTimeFns.PlainTimeSlots,
  pt1: PlainTimeFns.PlainTimeSlots,
): void {
  expect(pt0.branding).toBe('PlainTime')
  expect(pt1.branding).toBe('PlainTime')
  expectEpochNanosSimilar(
    dayTimeNanoToBigInt(isoToEpochNano({ ...isoDateDefaults, ...pt0 })!),
    dayTimeNanoToBigInt(isoToEpochNano({ ...isoDateDefaults, ...pt1 })!),
  )
}

function expectEpochNanosSimilar(
  epochNano0: bigint,
  epochNano1: bigint,
): boolean {
  return Math.abs(Number(epochNano0 - epochNano1)) < 1000
}
