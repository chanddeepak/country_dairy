# Image prompts for the journey strip

Five photographs, one per chapter. They are a **series**, not five unrelated
pictures — same photographer, same camera, same week, same light. That is the
single thing that makes this section look expensive, and the thing generic
prompts lose first.

## Every image slot on the homepage, and the shape it needs

**This table is the thing to check before generating anything.** Each section
crops with `object-cover`, so a picture in the wrong ratio is not scaled down —
it is cut. A 3:4 portrait dropped into the 16:9 Rituals box loses both sides,
which is exactly how a round plate ends up with its edges sliced off.

| Section | Ratio | Generate at | Files |
| --- | --- | --- | --- |
| Journey (5 chapters) | **3:4 portrait** | 1086×1448 | `journey-land`, `journey-source`, `journey-craft-v2`, `journey-product-v2`, `journey-home-v2` |
| BrandStatement | **3:2 landscape** | 1620×1080 | `statement-hills.jpg` |
| Rituals (3 cards) | **16:9 landscape** | 1600×900 | `ritual-morning`, `ritual-cooking`, `ritual-topping` |
| Devbhoomi | **463:820 tall portrait** | 926×1640 | `devbhoomi-pasture.jpg` |
| GheeStory | 3:4 portrait | 1086×1448 | — |

**Do not reuse one file across two rows.** `statement-hills.jpg` and
`devbhoomi-pasture.jpg` were each serving two sections with different ratios,
so whichever section came second got a hard crop of a photograph framed for the
other. The journey now has its own five files for that reason.

**Rename when you replace.** An optimised image is addressed by its source
path, so overwriting a file leaves the URL identical and browsers keep serving
the old picture. That is why new images appear not to take effect.

## Before you paste anything

**Aspect ratio: 3:4 portrait. Minimum 1080 × 1440.** The panel renders them in
a `3/4` box at 360 CSS px, which is 1080px on a 3× phone screen.

The current files are 380×700 to 1020×650 — one of them is *landscape* being
cropped into a portrait slot, which is why "The Land" looks awkward. The code
even says the panel is small deliberately because the sources cannot carry
more. Replace them at proper resolution and that constraint goes away.

**Why the current results come out flat:** a short prompt gives the model no
reason to choose anything, so it returns the average of everything — centred
subject, midday light, no depth, no grain. Every prompt below names a lens, a
time of day, a season, a foreground and a flaw. The flaw matters most; real
photographs are not tidy.

---

## Paste this first, then the numbered prompt

> You are shooting a five-image editorial series for a Himalayan dairy brand in
> Kumaon, Uttarakhand. House style for every image: shot on a full-frame camera
> with a fast prime, natural light only, shallow depth of field, muted and
> slightly desaturated colour, deep greens and warm brass tones against soft
> ivory light, visible fine film grain, gentle contrast, nothing glossy or
> commercial. Vertical 3:4 portrait, 1080×1440 minimum. Documentary, not
> advertising — as if from a photo essay. No text, no logos, no watermarks, no
> people looking at the camera, no over-saturation, no HDR, no plastic-looking
> surfaces. Leave quiet space in the upper third of the frame.

---

## 01 · The Land

> Terraced hillside farmland in the Kumaon foothills above Tanakpur at first
> light, photographed on a 35mm lens from slightly below the terraces so they
> step away into the frame. Late monsoon: the grass is still deep green, the
> soil dark and damp. Layered ridgelines fade into pale blue haze behind, one
> old oak on the middle terrace catching the first warm light. Mist sitting in
> the valley folds. A dry stone retaining wall in the near foreground, slightly
> out of focus. Cool shadows, warm highlights, heavy atmospheric depth.

## 02 · The Source

> Three or four native Indian desi cows — humped, fawn and white — grazing an open hill pasture in the early morning, shot on an
> 85mm lens from a respectful distance so they are unbothered and none faces
> the camera. Backlit, with rim light catching the edge of a shoulder and dust
> and insects visible in the low sun. Wet grass, one animal's head down, hills
> receding behind. Slightly compressed perspective, background dissolved into
> soft green. Nothing staged, no farmer posing.

## 03 · The Craft

> A wide brass or iron pot of ghee simmering over a low wood fire in a dim
> village kitchen, photographed close on a 50mm lens from just above the rim.
> Golden liquid, fine foam at the edge, pale milk solids settling at the bottom.
> The only light is the fire and one shaft of daylight from a doorway out of
> frame, so most of the picture falls into warm shadow. A wooden churning
> handle and a cloth resting on the stone counter beside it. Steam catching the
> light. Smoke-darkened wall behind. Textured, imperfect, worn — the pot has
> been used for years.

## 04 · The Product

> A single open glass jar of set golden ghee on a weathered wooden table beside
> a window, shot on a 50mm macro at close range and slightly from above. Soft
> directional daylight from the left, deep shadow to the right. The surface of
> the ghee is grainy and matte, not glossy, with one spoon-mark scooped out of
> it. A plain unlabelled jar. Dust motes in the light. Muted background falling
> away into darkness. Absolutely no branding, no printed label, no styling
> props.

## 05 · Your Home

> An unhurried Indian home kitchen at midday: a steel thali with hot rotis, a
> small bowl of dal, and a spoon of ghee melting into the rice, photographed on
> a 35mm lens from a seated eye level rather than directly overhead. Warm
> diffused daylight through a window, a hand just leaving the frame, everyday
> worn utensils, a slightly untidy table. Lived-in and ordinary, not a food
> advertisement. Shallow focus on the melting ghee, the rest of the table
> falling gently soft.

---

## If a result still looks flat

Add one of these to the end, one at a time:

- `Shot on Kodak Portra 400, slight halation in the highlights.`
- `Photographed by an editorial documentary photographer for a long-form
  magazine feature.`
- `Slightly imperfect framing, as if taken quickly.`

And say what you do **not** want, which does more work than adjectives:
`no vibrant saturated colours, no symmetrical composition, no studio lighting,
no clean modern kitchen, no stock-photo styling.`

## The brand statement — "Some flavours are more than flavours"

**3:2 landscape, 1620×1080.** Wider and calmer than the journey pictures: it
sits beside a large quiet headline on an ivory ground, so it needs air rather
than incident.

> A wide view across terraced Himalayan farmland in Kumaon, Uttarakhand in the
> hour after sunrise, shot on a 50mm lens from a low ridge looking across the
> valley. One broad old tree stands alone on the middle terrace, its canopy
> catching warm side light; ridgelines recede in three or four pale layers
> behind it with mist lying in the folds. Deep green terraces in the foreground,
> unpeopled and quiet. Warm light from the left, cool shadow on the right.
> Natural light only, muted colour, fine film grain, gentle contrast, no HDR.
> Composed with open sky in the upper third so the frame can breathe. 3:2
> horizontal, no text, no logos, no people.

## The rituals cards — three of them

**16:9 landscape, 1600×900.** These are small wide cards, so each one wants a
single close subject, not a scene. **A portrait picture here loses both its
sides** — that is what cut the plate in half.

**First thing** — `ritual-morning.jpg`

> A spoon of golden ghee being stirred into a glass of warm water on a kitchen
> counter in early morning light, shot close on a 50mm lens from just above.
> Steam rising, soft window light from the left, warm shadow behind. Muted
> colour, film grain, shallow focus. 16:9 horizontal, filled edge to edge with
> the glass slightly off-centre. No text, no branding.

**In the tadka** — `ritual-cooking.jpg`

> Ghee being spooned into a steel bowl of steaming yellow dal, photographed
> close on a 50mm lens from a low three-quarter angle so the steam catches the
> light. Warm kitchen daylight, dark background falling away. Muted colour,
> visible grain, shallow depth of field. 16:9 horizontal, composed wide with the
> bowl to one side. No text, no branding.

**On the plate** — `ritual-topping.jpg`

> Ghee melting into a hot paratha on a steel plate, shot close on a 50mm lens
> from a low angle at the edge of the plate rather than from directly overhead,
> so the plate runs out of frame naturally instead of being cut in half.
> Melted ghee pooling in the centre, warm daylight from a window, worn wooden
> table. Muted colour, film grain, shallow focus. **16:9 horizontal** — a wide
> crop, not a square plate centred in the middle. No text, no branding.

## Rooted in Devbhoomi

**Generate at 2:3 portrait, 1024×1536.**

A caveat worth understanding: that slot is currently `aspect-[463/820]`, which
is 0.565 — a ratio no image generator offers, and one that only exists because
it was copied from the dimensions of the file that happened to be there. The
nearest thing you can actually produce is 2:3 (0.667), so **the box gets
changed to 2:3 when the image is installed** rather than the picture being
cropped to fit an arbitrary number.

The section is about the place, not the product, and the text beside it already
carries the argument — so the photograph should be a landscape with a cow in
it, not a product shot with scenery behind.

> A single native Indian desi cow — humped, pale fawn or white, Gir or Badri
> type — grazing a high hill pasture in Kumaon, Uttarakhand in the late
> afternoon, photographed on an 85mm lens from a distance so she is small in
> the frame and unbothered. Behind her the ground falls away into a deep
> valley, forested ridges rising in pale layers, snow peaks catching the last
> warm light along the top of the frame. Wildflowers and coarse grass in the
> foreground. Tall vertical composition with the mountains occupying the upper
> half and the cow low and slightly off-centre. Natural light only, muted
> colour, soft haze, fine film grain, no HDR, no saturation. 2:3 vertical, no
> text, no logos, no people, no product.

If you would rather keep a jar in this one, put it small and low in the frame
on a stone, in the same light as the landscape — not lit separately and dropped
in front, which is what makes a composite read as a composite.

## After generating

Save as JPEG at 1080×1440 or larger into `apps/web/public/images/`, keeping the
existing filenames so nothing else has to change:

| Chapter | File |
| --- | --- |
| 01 The Land | `statement-hills.jpg` |
| 02 The Source | `devbhoomi-pasture.jpg` |
| 03 The Craft | `journey-craft.jpg` |
| 04 The Product | `journey-product.jpg` |
| 05 Your Home | `journey-home.jpg` |

Keep each under about 300 KB. The homepage already carries a 990 KB icon
mistake once fixed; large hero-weight photographs are the other easy way to
lose the performance score.
