import { TimeBag } from './calendarFields'
import {
  createZonedDateTimeConverter,
  mergePlainTimeBag,
  refinePlainTimeBag,
  rejectInvalidBag,
} from './convert'
import { diffPlainTimes } from './diff'
import { Duration, DurationArg, createDuration, toDurationSlots } from './duration'
import { DurationInternals, negateDurationInternals } from './durationFields'
import { IsoTimeFields, pluckIsoTimeFields, refineIsoTimeFields } from './isoFields'
import { formatPlainTimeIso } from './isoFormat'
import { createToLocaleStringMethods } from './intlFormat'
import { checkIsoDateTimeInBounds, compareIsoTimeFields } from './isoMath'
import { parsePlainTime } from './isoParse'
import { moveTime } from './move'
import {
  DiffOptions,
  OverflowOptions,
  RoundingOptions,
  TimeDisplayOptions,
  prepareOptions,
  refineOverflowOptions,
} from './options'
import { PlainDateArg, toPlainDateSlots } from './plainDate'
import { PlainDateTime, createPlainDateTime } from './plainDateTime'
import { roundPlainTime } from './round'
import { UnitName } from './units'
import { NumSign, defineGetters, defineProps, defineStringTag, isObjectlike } from './utils'
import { ZonedDateTime, createZonedDateTime } from './zonedDateTime'
import { TimeZoneArg } from './timeZone'
import { DurationBranding, PlainDateBranding, PlainDateTimeBranding, PlainDateTimeSlots, PlainTimeBranding, PlainTimeSlots, ZonedDateTimeBranding, ZonedDateTimeSlots, createViaSlots, getSlots, getSpecificSlots, setSlots } from './slots'
import { createTimeGetterMethods, neverValueOf } from './publicMixins'
import { ensureString } from './cast'
import { zonedInternalsToIso } from './timeZoneSlot'

export type PlainTimeBag = TimeBag
export type PlainTimeMod = TimeBag
export type PlainTimeArg = PlainTime | PlainTimeBag | string

const zonedDateTimeConverter = createZonedDateTimeConverter((options: { plainDate: PlainDateArg }) => {
  return toPlainDateSlots(options.plainDate)
})

export class PlainTime {
  constructor(
    isoHour: number = 0,
    isoMinute: number = 0,
    isoSecond: number = 0,
    isoMillisecond: number = 0,
    isoMicrosecond: number = 0,
    isoNanosecond: number = 0,
  ) {
    setSlots(this, {
      branding: PlainTimeBranding,
      ...refineIsoTimeFields({
        isoHour,
        isoMinute,
        isoSecond,
        isoMillisecond,
        isoMicrosecond,
        isoNanosecond,
      })
    })
  }

  with(mod: PlainTimeMod, options?: OverflowOptions): PlainTime {
    getPlainTimeSlots(this) // validate `this`
    return createPlainTime({
      ...mergePlainTimeBag(this, rejectInvalidBag(mod), options), // it's crazy we don't do prepareOptions
      branding: PlainTimeBranding,
    })
  }

  add(durationArg: DurationArg): PlainTime {
    return movePlainTime(getPlainTimeSlots(this), toDurationSlots(durationArg))
  }

  subtract(durationArg: DurationArg): PlainTime {
    return movePlainTime(getPlainTimeSlots(this), negateDurationInternals(toDurationSlots(durationArg)))
  }

  until(otherArg: PlainTimeArg, options?: DiffOptions): Duration {
    return createDuration({
      branding: DurationBranding,
      ...diffPlainTimes(getPlainTimeSlots(this), toPlainTimeSlots(otherArg), options)
    })
  }

  since(otherArg: PlainTimeArg, options?: DiffOptions): Duration {
    return createDuration({
      branding: DurationBranding,
      ...diffPlainTimes(getPlainTimeSlots(this), toPlainTimeSlots(otherArg), options, true)
    })
  }

  round(options: RoundingOptions | UnitName): PlainTime {
    return createPlainTime({
      ...roundPlainTime(getPlainTimeSlots(this), options),
      branding: PlainTimeBranding,
    })
  }

  equals(other: PlainTimeArg): boolean {
    return !compareIsoTimeFields(getPlainTimeSlots(this), toPlainTimeSlots(other))
  }

  toString(options?: TimeDisplayOptions): string {
    return formatPlainTimeIso(getPlainTimeSlots(this), options)
  }

  toJSON(): string {
    return formatPlainTimeIso(getPlainTimeSlots(this))
  }

  toZonedDateTime(options: { timeZone: TimeZoneArg, plainDate: PlainDateArg }): ZonedDateTime {
    return createZonedDateTime({
      branding: ZonedDateTimeBranding,
      ...zonedDateTimeConverter(getPlainTimeSlots(this), options)
    })
  }

  toPlainDateTime(plainDateArg: PlainDateArg): PlainDateTime {
    return createPlainDateTime({
      ...checkIsoDateTimeInBounds({
        ...getPlainTimeSlots(this),
        ...toPlainDateSlots(plainDateArg),
      }),
      branding: PlainDateTimeBranding,
    })
  }

  getISOFields(): IsoTimeFields {
    return pluckIsoTimeFields(getPlainTimeSlots(this))
  }

  static from(arg: PlainTimeArg, options?: OverflowOptions): PlainTime {
    return createPlainTime(toPlainTimeSlots(arg, options))
  }

  static compare(arg0: PlainTimeArg, arg1: PlainTimeArg): NumSign {
    return compareIsoTimeFields(
      toPlainTimeSlots(arg0),
      toPlainTimeSlots(arg1),
    )
  }
}

defineStringTag(PlainTime.prototype, PlainTimeBranding)

defineProps(PlainTime.prototype, {
  ...createToLocaleStringMethods(PlainTimeBranding),
  valueOf: neverValueOf,
})

defineGetters(
  PlainTime.prototype,
  createTimeGetterMethods(PlainTimeBranding),
)

// Utils
// -------------------------------------------------------------------------------------------------

export function createPlainTime(slots: PlainTimeSlots): PlainTime {
  return createViaSlots(PlainTime, slots)
}

export function getPlainTimeSlots(plainTime: PlainTime): PlainTimeSlots {
  return getSpecificSlots(PlainTimeBranding, plainTime) as PlainTimeSlots
}

export function toPlainTimeSlots(arg: PlainTimeArg, options?: OverflowOptions): PlainTimeSlots {
  if (isObjectlike(arg)) {
    const slots = getSlots(arg)
    if (slots) {
      switch(slots.branding) {
        case PlainTimeBranding:
          refineOverflowOptions(options) // parse unused options
          return slots as PlainTimeSlots
        case PlainDateTimeBranding:
          refineOverflowOptions(options) // parse unused options
          return { ...pluckIsoTimeFields(slots as PlainDateTimeSlots), branding: PlainTimeBranding }
        case ZonedDateTimeBranding:
          refineOverflowOptions(options) // parse unused options
          return { ...pluckIsoTimeFields(zonedInternalsToIso(slots as ZonedDateTimeSlots)), branding: PlainTimeBranding }
      }
    }
    return { ...refinePlainTimeBag(arg as PlainTimeBag, options), branding: PlainTimeBranding }
  }
  refineOverflowOptions(options) // parse unused options
  return { ...parsePlainTime(ensureString(arg)), branding: PlainTimeBranding }
}

function movePlainTime(internals: IsoTimeFields, durationInternals: DurationInternals): PlainTime {
  return createPlainTime({
    ...moveTime(internals, durationInternals)[0],
    branding: PlainTimeBranding,
  })
}
