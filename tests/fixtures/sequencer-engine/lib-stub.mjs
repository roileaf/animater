// Copies of the Sequencer lib helpers the animation engine uses (MIT, Fantasy Computerworks Ltd.).

const easeFunctions = {
  linear: (x) => x,
  easeInOutQuad: (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2),
  easeOutCubic: (x) => 1 - Math.pow(1 - x, 3),
};

export function is_function(inFunc) {
  return (
    inFunc &&
    ({}.toString.call(inFunc) === '[object Function]' ||
      {}.toString.call(inFunc) === '[object AsyncFunction]')
  );
}

export function interpolate(p1, p2, t, ease = 'linear') {
  const easeFunction = is_function(ease) ? ease : easeFunctions[ease];
  return p1 + (p2 - p1) * easeFunction(t);
}

export function clamp(num, min, max) {
  const _max = Math.max(min, max);
  const _min = Math.min(min, max);
  return Math.max(_min, Math.min(_max, num));
}

export function deep_get(obj, path) {
  if (!Array.isArray(path)) path = path.split('.');
  try {
    let i;
    for (i = 0; i < path.length - 1; i++) {
      obj = obj[path[i]];
    }
    return obj[path[i]];
  } catch (err) {}
}

export function deep_set(obj, path, value) {
  if (!Array.isArray(path)) path = path.split('.');
  try {
    let i;
    for (i = 0; i < path.length - 1; i++) {
      obj = obj[path[i]];
    }
    if (is_function(obj[path[i]])) {
      obj[path[i]](value);
    } else {
      obj[path[i]] = value;
    }
  } catch (err) {}
}

export function is_UUID(inId) {
  return (
    typeof inId === 'string' &&
    (inId.startsWith('Scene') || inId.startsWith('Actor') || inId.startsWith('Item')) &&
    (inId.match(/\./g) || []).length &&
    !inId.endsWith('.')
  );
}

export function get_object_identifier(inObject, tryUUID = true) {
  const uuid = tryUUID && is_UUID(inObject?.uuid) ? inObject?.uuid : undefined;
  return (
    uuid ??
    inObject?.id ??
    inObject?.document?.name ??
    inObject?.name ??
    (inObject?.tag !== '' ? inObject?.tag : undefined) ??
    (inObject?.label !== '' ? inObject?.label : undefined) ??
    inObject?.sound_id
  );
}

export function debug() {}
