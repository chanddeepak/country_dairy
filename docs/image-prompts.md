# Image prompts for the journey strip

Five photographs, one per chapter. They are a **series**, not five unrelated
pictures — same photographer, same camera, same week, same light. That is the
single thing that makes this section look expensive, and the thing generic
prompts lose first.

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

> Three or four native Indian desi cows — humped, fawn and white, Gir or
> Badri type — grazing an open hill pasture in the early morning, shot on an
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
