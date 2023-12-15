import { DurationBranding, PlainDateBranding, PlainDateTimeBranding, PlainMonthDayBranding, PlainYearMonthBranding } from '../genericApi/branding'
import { DurationSlots } from '../genericApi/genericTypes'
import { dayTimeNanoToBigInt } from '../internal/dayTimeNano'
import { DurationFieldsWithSign, durationInternalNames } from '../internal/durationFields'
import { IsoTimeFields, isoTimeFieldNamesAlpha } from '../internal/isoFields'
import { epochNanoToMicro, epochNanoToMilli, epochNanoToSec } from '../internal/isoMath'
import { identityFunc, mapPropNames } from '../internal/utils'
import { getCalendarSlots } from './calendar'
import { dateOnlyRefiners, dateRefiners, dayOnlyRefiners, monthOnlyRefiners, yearMonthOnlyRefiners } from '../genericApi/refineConfig'
import { createSimpleOps } from './calendarOpsQuery'
import { toPlainDateSlots } from './plainDate'
import { BrandingSlots, EpochSlots, getSlots, getSpecificSlots } from './slots'
import { timeFieldNamesAsc } from '../internal/calendarFields'

// For Calendar
// -------------------------------------------------------------------------------------------------
// Always assumes underlying Native calendar `ops`

function createCalendarMethods<M>(methodNameMap: M, alsoAccept: string[]): {
  [K in keyof M]: (dateArg: any) => any
} {
  const methods = {} as any

  for (const methodName in methodNameMap) {
    methods[methodName] = function(this: any, dateArg: any) {
      const { ops } = getCalendarSlots(this)
      const argSlots = (getSlots(dateArg) || {}) as any
      const { branding } = argSlots
      const refinedSlots = branding === PlainDateBranding || alsoAccept.includes(branding)
        ? argSlots
        : toPlainDateSlots(dateArg)

      return (ops as any)[methodName](refinedSlots)
    }
  }

  return methods
}

export const calendarMethods = {
  ...createCalendarMethods(yearMonthOnlyRefiners, [PlainYearMonthBranding]),
  ...createCalendarMethods(dateOnlyRefiners, []),
  ...createCalendarMethods(monthOnlyRefiners, [PlainYearMonthBranding, PlainMonthDayBranding]),
  ...createCalendarMethods(dayOnlyRefiners, [PlainMonthDayBranding]),
}

// For PlainDate/etc
// -------------------------------------------------------------------------------------------------
// Assumes general calendar (native/adapter)

/*
Made external for ZonedDateTime
*/
export function createCalendarGetters<M>(
  branding: string,
  methodNameMap: M,
  slotsToIsoFields: ((slots: any) => IsoTimeFields) = identityFunc as any,
): {
  [K in keyof M]: () => any
} {
  const methods = {} as any

  for (const methodName in methodNameMap) {
    methods[methodName] = function(this: any) {
      const slots = getSpecificSlots(this, branding) as any
      const { calendar } = slots
      const simpleOps = createSimpleOps(calendar) as any
      const isoFields = slotsToIsoFields(slots)

      return simpleOps[methodName](isoFields)
    }
  }

  return methods
}

export const dateTimeCalendarGetters = createCalendarGetters(PlainDateTimeBranding, dateRefiners) // hack
export const dateCalendarGetters = createCalendarGetters(PlainDateBranding, dateRefiners)
export const yearMonthGetters = createCalendarGetters(PlainYearMonthBranding, {
  ...yearMonthOnlyRefiners,
  ...monthOnlyRefiners,
})
export const monthDayGetters = createCalendarGetters(PlainMonthDayBranding, {
  ...monthOnlyRefiners,
  ...dayOnlyRefiners,
})

// Duration
// -------------------------------------------------------------------------------------------------

/*
Includes sign()
*/
export const durationGettersMethods = mapPropNames((propName: keyof DurationFieldsWithSign) => {
  return function (this: any) {
    const slots = getSpecificSlots(DurationBranding, this) as DurationSlots
    return slots[propName]
  }
}, durationInternalNames)

// Time
// -------------------------------------------------------------------------------------------------

export function createTimeGetterMethods(
  branding: string,
  slotsToIsoFields: ((slots: any) => IsoTimeFields) = identityFunc,
) {
  return mapPropNames((name, i) => {
    return function (this: any) {
      const slots = getSpecificSlots(branding, this) as (BrandingSlots & IsoTimeFields)
      const isoFields = slotsToIsoFields(slots)
      return isoFields[isoTimeFieldNamesAlpha[i]]
    }
  }, timeFieldNamesAsc)
}

// Epoch
// -------------------------------------------------------------------------------------------------

export function createEpochGetterMethods(branding: string) {
  return {
    epochSeconds() {
      const slots = getSpecificSlots(branding, this) as (BrandingSlots & EpochSlots)
      return epochNanoToSec(slots.epochNanoseconds)
    },
    epochMilliseconds() {
      const slots = getSpecificSlots(branding, this) as (BrandingSlots & EpochSlots)
      return epochNanoToMilli(slots.epochNanoseconds)
    },
    epochMicroseconds() {
      const slots = getSpecificSlots(branding, this) as (BrandingSlots & EpochSlots)
      return epochNanoToMicro(slots.epochNanoseconds)
    },
    epochNanoseconds() {
      const slots = getSpecificSlots(branding, this) as (BrandingSlots & EpochSlots)
      return dayTimeNanoToBigInt(slots.epochNanoseconds)
    },
  }
}

// Misc
// -------------------------------------------------------------------------------------------------

export function neverValueOf() {
  throw new TypeError('Cannot convert object using valueOf')
}
