# Palette validation, and why one chart stopped using colour

Run on 2026-10-02 against the site's eight-colour series palette with the
validator from Anthropic's `dataviz` skill.

```
#007a5f  #b5701f  #2a6ea8  #a4453a  #5f4a9e  #5f7d2e  #9c5a86  #8a6a10
surface #fffdf8, light mode
```

## Adjacent pairs — passes

```
[PASS] Lightness band        all 8 inside L 0.43-0.77
[PASS] Chroma floor          all 8 >= 0.1
[PASS] CVD separation        worst #b5701f/#007a5f  dE 8.5 (protan)
[PASS] Normal-vision floor   worst #8a6a10/#9c5a86  dE 16.8
[PASS] Contrast vs surface   all 8 >= 3:1
```

This is the test that matters where colours are used in sequence and a reader
only ever has to tell neighbours apart.

## All pairs — fails

```
[FAIL] CVD separation        worst #5f7d2e/#b5701f  dE 1.4 (protan)
[FAIL] Normal-vision floor   worst #8a6a10/#5f7d2e  dE 7.7  (floor is 15)
```

`#5f7d2e` and `#b5701f` are, to a reader with protanopia, the same colour. And
`#8a6a10` against `#5f7d2e` is below the floor for full colour vision too, which
no amount of secondary encoding excuses.

## The fix is not a better palette

The obvious response is to re-step the two failing slots. That was tried
properly before giving up on it: a search over 4,664 muted OKLCH candidates
(L 0.46-0.66, C 0.08-0.18, every 3 degrees of hue), holding the other six
colours fixed, found **zero** passing pairs.

Widening the search answered why. A greedy max-min build, seeded with the three
colours furthest apart in the palette already, could not get past **three**
colours before all-pairs failed - green, blue and clay alone do not clear the
bar. Eight muted categorical hues that every reader can tell apart in any
combination do not exist at this lightness and chroma.

So the constraint is real and it is not about these particular hexes. The
`dataviz` skill says as much for this case: under all-pairs, cut series or
facet rather than hunt for colours.

## What changed instead

**The formality chart now draws every bar in one colour.** It measures a single
quantity - the share of a sector owned by one person - and each bar already
carries its sector's name on the axis beside it. The seven hues were adding no
information while implying a seven-way categorical comparison that a
colour-blind reader could not make anyway.

That also fixed a bug the colour review surfaced. `d3.scaleOrdinal` appends an
unrecognised name to its domain and hands it `range[i % 8]`. The formality chart
passes macro-sector names ("Retail", "Extractive") into a scale whose domain is
sector names ("Trade", "Mining and quarrying"), so every bar in it was an
unknown, the palette wrapped, and Manufacturing and Extractive came out the same
red. The scale now has an explicit `.unknown()` fallback, so a mismatch like that
shows up as a grey bar rather than a plausible-looking duplicate.

## Where colour still carries identity

The donut, the treemap and the two-region comparison still use the full eight.
In each, identity is carried by something other than colour as well - direct
labels with leader lines on the donut, labels inside the tiles on the treemap,
a legend plus the figures table on the comparison - which is the condition the
skill sets for using a palette in this band.
