// Where Animater's sections go in a wall's configuration: after the form's last section, inside its scrolling part, before
// the footer. Foundry's wall palette keeps its last section inside a <details> it hides until a door has an animation, so
// a section goes after that <details>, never into it.
export function appendWallSection(root, section) {
  const last = [...root.querySelectorAll('fieldset')].filter((f) => f !== section).at(-1);
  if (last) (last.closest('details') ?? last).after(section);
  else (root.querySelector('.scrollable, .window-content, form') ?? root).append(section);
}
