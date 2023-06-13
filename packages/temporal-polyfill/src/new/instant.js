import { isoCalendarId } from './calendarConfig'
import { queryCalendarOps } from './calendarOps'
import { createTemporalClass, neverValueOf } from './class'
import { diffEpochNano } from './diff'
import { toDurationInternals } from './duration'
import { negateDurationInternals } from './durationFields'
import {
  formatCalendar,
  formatIsoDateTimeFields,
  formatOffsetNanoseconds,
  formatTimeZone,
} from './isoFormat'
import {
  epochGetters,
  epochMicroToNano,
  epochMilliToNano,
  epochNanoToIso,
  epochSecToNano,
  validateEpochNano,
} from './isoMath'
import { compareLargeInts } from './largeInt'
import { moveEpochNano } from './move'
import { toEpochNano, toObject } from './options'
import { roundLargeNano } from './round'
import { queryTimeZoneOps, utcTimeZoneId } from './timeZoneOps'
import { noop } from './utils'
import { createZonedDateTime } from './zonedDateTime'

export const [
  Instant,
  createInstant,
  toInstantEpochNanoseconds,
] = createTemporalClass(
  'Instant',

  // Creation
  // -----------------------------------------------------------------------------------------------

  // constructorToInternals
  (epochNanoseconds) => {
    return validateEpochNano(toEpochNano(epochNanoseconds))
  },

  // internalsConversionMap
  {
    ZonedDateTime: (argInternals) => argInternals.epochNanoseconds,
  },

  // bagToInternals
  noop,

  // stringToInternals
  stringToEpochNanoseconds,

  // handleUnusedOptions
  noop,

  // Getters
  // -----------------------------------------------------------------------------------------------

  epochGetters,

  // Methods
  // -----------------------------------------------------------------------------------------------

  {
    toZonedDateTimeISO(epochNanoseconds, timeZoneArg) {
      createZonedDateTime({
        epochNanoseconds,
        timeZone: queryTimeZoneOps(timeZoneArg),
        calendar: isoCalendarId,
      })
    },

    toZonedDateTime(epochNanoseconds, options) {
      const refinedObj = toObject(options)

      return createZonedDateTime({
        epochNanoseconds,
        timeZone: queryTimeZoneOps(refinedObj.timeZone),
        calendar: queryCalendarOps(refinedObj.calendar),
      })
    },

    add(epochNanoseconds, durationArg) {
      return createInstant(
        moveEpochNano(
          epochNanoseconds,
          toDurationInternals(durationArg),
        ),
      )
    },

    subtract(epochNanoseconds, durationArg) {
      return createInstant(
        moveEpochNano(
          epochNanoseconds,
          negateDurationInternals(toDurationInternals(durationArg)),
        ),
      )
    },

    until(epochNanoseconds, otherArg, options) {
      return diffEpochNano(
        epochNanoseconds,
        toInstantEpochNanoseconds(otherArg),
        options, // TODO: must be given better options???
      )
    },

    since(epochNanoseconds, otherArg, options) {
      return diffEpochNano(
        toInstantEpochNanoseconds(otherArg),
        epochNanoseconds,
        options, // TODO: reverse rounding option
      )
    },

    round(epochNanoseconds, options) {
      return createInstant(
        roundLargeNano(
          epochNanoseconds,
          options, // TODO: break apart options
        ),
      )
    },

    equals(epochNanoseconds, otherArg) {
      return !compareLargeInts(
        epochNanoseconds,
        toInstantEpochNanoseconds(otherArg),
      )
    },

    toString(epochNanoseconds, options) { // has rounding options too
      const refinedOptions = toObject(options) // TODO: make optional
      // ^important for destructuring options because used once for rounding, second for formatting

      const calendar = queryCalendarOps(refinedOptions.calendar || isoCalendarId)
      const timeZone = queryTimeZoneOps(refinedOptions.timeZone || utcTimeZoneId)

      epochNanoseconds = roundLargeNano(
        epochNanoseconds,
        refinedOptions, // TODO: break apart options
      )
      const offsetNanoseconds = timeZone.getOffsetNanosecondsFor(epochNanoseconds)
      const isoDateTimeFields = epochNanoToIso(epochNanoseconds.addNumber(offsetNanoseconds))

      return formatIsoDateTimeFields(isoDateTimeFields, refinedOptions) +
        formatOffsetNanoseconds(offsetNanoseconds) +
        formatTimeZone(timeZone, options) +
        formatCalendar(calendar, options)
    },

    toLocaleString(epochNanoseconds, locales, options) {
      return ''
    },

    valueOf: neverValueOf,
  },

  // Static
  // -----------------------------------------------------------------------------------------------

  {
    fromEpochSeconds: epochSecToInstant,

    fromEpochMilliseconds: epochMilliToInstant,

    fromEpochMicroseconds(epochMicro) {
      return epochMicroToInstant(toEpochNano(epochMicro))
    },

    fromEpochNanoseconds(epochNanoseconds) {
      return createInstant(toEpochNano(epochNanoseconds))
    },
  },
)

function stringToEpochNanoseconds(str) {
  // TODO
}

// Unit Conversion
// -------------------------------------------------------------------------------------------------

function epochSecToInstant(epochSec) {
  return createInstant(epochSecToNano(epochSec))
}

function epochMilliToInstant(epochMilli) {
  return createInstant(epochMilliToNano(epochMilli))
}

function epochMicroToInstant(epochMicro) {
  return createInstant(epochMicroToNano(epochMicro))
}

// Legacy Date
// -------------------------------------------------------------------------------------------------

export function toTemporalInstant() {
  return epochMilliToInstant(this.valueOf())
}
