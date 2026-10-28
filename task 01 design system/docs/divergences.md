Divergence 1 — Display Large letter spacing

* Material baseline: `-0.25px`.
* Chosen value: `-3px` (`typography.display style.display large.letterSpacing.value`).
* Why: The tighter tracking makes the large display text more compact and gives the heading a more deliberate visual shape. The default-versus-chosen screenshots are referenced in `type-scale.md`.
* When this would be wrong: With longer headings, smaller rendered sizes, or typefaces/letter combinations that become difficult to distinguish when tightly tracked.

Divergence 2 — Headline Large letter spacing

* Material baseline: `0px`.
* Chosen value: `-1px`.
* Why: Slightly tighter tracking gives the large headline a more compact appearance and distinguishes it from regular body copy.
* When this would be wrong: In long headlines, at small sizes, or where tight tracking makes letterforms crowd together and reduces readability.

Divergence 3 — Title Large letter spacing

* Material baseline: `0px`.
* Chosen value: `-0.5px`.
* Why: A small negative value tightens the title without changing its size or weight.
* When this would be wrong: In small or long title text where the negative tracking causes words to look cramped.

Divergence 4 — Body Large letter spacing

* Material baseline: `0.5px`.
* Chosen value: `-0.5px`.
* Why: The chosen value makes the 16px body style more compact. This is a substantial departure from the Material baseline, so it should be checked in real paragraphs rather than judged only in a specimen.
* When this would be wrong: In paragraphs, on smaller screens, or for readers who need more open letter spacing; the negative value may make continuous reading less comfortable. If the evidence does not show a readability benefit, restore the baseline `0.5px`.

Divergence 5 — Label Medium font weight

* Material baseline: `500`.
* Chosen value: `600`, as recorded in the JSON export.
* Why: The stronger weight makes this label style more prominent and can improve hierarchy for small labels that need to stand out.
* When this would be wrong: In dense interfaces or repeated label-heavy layouts, where weight `600` can make the page feel crowded or cause labels to compete with titles and other important content.

Divergence 6 — Label Medium letter spacing

* Material baseline: `0.5px`.
* Chosen value: `0px`.
* Why: Removing the positive tracking keeps the 12px label compact and visually connected, particularly alongside the chosen heavier weight.
* When this would be wrong: If the label becomes hard to scan at small sizes, or if the typeface renders crowded at 12px. In that case, restore some positive tracking, up to the baseline `0.5px`.

