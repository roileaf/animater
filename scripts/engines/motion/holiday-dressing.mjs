// A building dressed for a feast day: garlands and lanterns along its eaves, in the colour the calendar gives that
// day. The calendar says which day it is and what colour it wears; this says what that means for a roof.
//
// Pure, and deliberately small. Working out *which* festival is on is the calendar's own job and it does it — a
// thing worth saying, because the festival records keep `month` and `dayOfMonth` counting from zero while the
// conditions beside them and the clock itself count from one. Re-deriving the day here would have meant getting
// that right for every calendar anyone writes, forever, to arrive at an answer already sitting there.

/** A festival's colour as a hex string, whatever shape it arrives in (a string, or Foundry's own Color). */
export function festivalColour(colour) {
  if (!colour && colour !== 0) return null;
  const said = typeof colour === 'string' ? colour : String(colour?.css ?? colour ?? '');
  const hex = said.trim().toLowerCase();
  return /^#[0-9a-f]{6}$/.test(hex) ? hex : /^#[0-9a-f]{3}$/.test(hex) ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}` : null;
}

/**
 * What a building wears today, from whatever the calendar handed over: `{ key, name, colour }`, or null for an
 * ordinary day. A festival with no colour of its own still counts — it gets the warm one everybody hangs out —
 * because the day is the point, not the shade.
 */
export function dressingOf(festival) {
  const many = (Array.isArray(festival) ? festival : [festival]).filter((one) => typeof one?.name === 'string' && one.name.trim());
  if (!many.length) return null;
  // More than one feast can land on a day, and on this calendar they often do — 21 Sarenith carries three (Roi:
  // "also there are three holidays right now..."). A building keeps them all: the colours go up together, as they
  // would on a street that is celebrating three things at once.
  const days = many.map((one) => {
    const name = one.name.trim();
    return {
      key: typeof one.festivalKey === 'string' && one.festivalKey ? one.festivalKey : name.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 24),
      name,
      colour: festivalColour(one.color ?? one.colour) ?? DRESSING_PLAIN,
    };
  });
  return {
    ...days[0],
    names: days.map((d) => d.name),
    colours: days.map((d) => d.colour),
    days,
  };
}

/** The colour of a feast day that does not name one: lamplight and old gold, which suits any of them. */
export const DRESSING_PLAIN = '#e8b24a';

/** How many colours a feast put up by hand may wear: enough for a flag's worth, not enough for a jumble. */
export const DRESSING_COLOURS_MOST = 3;

/**
 * A feast the GM has called themselves, with no calendar behind it. Asked for because a table that plays on a real
 * holiday wants the street dressed for it, and because not every world runs a calendar module at all ("Like if we
 * play on a IRL holiday"). Same shape as a calendar's day, so nothing downstream knows the difference.
 */
export function handDressing(called) {
  const { on = false, name = '', colours = [] } = called ?? {};
  if (on !== true) return null;
  const kept = (Array.isArray(colours) ? colours : []).map((c) => festivalColour(c)).filter(Boolean).slice(0, DRESSING_COLOURS_MOST);
  const wear = kept.length ? kept : [DRESSING_PLAIN];
  const said = typeof name === 'string' && name.trim() ? name.trim() : 'Holiday';
  // One day wearing several colours, rather than several days: it is one feast, however many colours it hangs out.
  const days = wear.map((colour, i) => ({ key: `byhand${i}`, name: said, colour }));
  return { ...days[0], names: [said], colours: wear, days };
}

/** A short word for what is hanging up, so a roof is only painted again when the day itself changes. */
export const dressingKey = (dressing) => (dressing ? (dressing.days ?? [dressing]).map((d) => `${d.key}:${d.colour}`).join('+') : '');
