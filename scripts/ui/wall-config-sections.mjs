// Where Animater's sections go in a wall's configuration: after the form's last section, inside its scrolling part, before
// the footer. Foundry's wall palette keeps its last section inside a <details> it hides until a door has an animation, so
// a section goes after that <details>, never into it. A section another module left outside the scrolling part doesn't count:
// following it out of there squeezes that part to nothing. In a form another module gave tabs, it goes in the open one.
export function appendWallSection(root, section) {
  const scroller = root.querySelector('.scrollable'), body = scroller?.querySelector('.tab.active') ?? scroller ?? root.querySelector('.window-content, form') ?? root;
  const last = [...(body.querySelectorAll?.('fieldset') ?? [])].filter((f) => f !== section).at(-1);
  if (last) (last.closest('details') ?? last).after(section);
  else body.append(section);
}
