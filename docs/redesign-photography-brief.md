# Photography brief

Companion to `docs/himalayan-redesign.md`. Every image the redesign needs, why it
exists, and a prompt to generate it.

**How to use these.** Attach the existing image named as the reference, then paste
the prompt. The reference is there to hold the light and the place; the prompt
changes the framing and removes the lettering.

**Two rules that apply to every image below.**

1. **No text, no logos, no watermarks, no packaging labels facing camera.** Every
   image currently on the site has marketing copy burned in, which is why none of
   them can be reused at a different size. This is the whole reason for the
   shoot.
2. **Leave the space the design needs.** Each prompt says where. A beautiful
   photograph with the subject dead centre is unusable behind a headline.

---

## S3. Hero, desktop

**Where it goes:** the homepage hero, full bleed, behind the headline "A Taste of
the Himalayas."
**Size:** 2560 x 1440, landscape 16:9.
**Reference:** the current desktop hero banner.
**Blocks:** T8, the largest task in Phase 3.

> A wide cinematic photograph of the Kumaon foothills in Uttarakhand at first
> light. Layered ridgelines receding into morning haze, a snow peak catching the
> first sun on the right third of the frame, mist sitting in the valley below.
> Terraced green slopes in the foreground with a few brown desi cows grazing,
> small and unposed, a herder walking a dirt path at a distance. Warm low golden
> sunlight raking across the hills from the right. Shot on a full frame camera at
> 35mm, deep focus, natural colour, documentary rather than postcard.
>
> Composition is important: keep the left half of the frame visually quiet, the
> hillside and haze only, no strong subject, because a headline sits there. All
> detail and interest belongs in the right half.
>
> No text, no lettering, no logos, no watermark, no packaging, no product. No
> HDR look, no oversaturated greens, no lens flare.

## S3b. Hero, mobile

**Size:** 1290 x 2200, portrait.
**Why separate:** the desktop crop loses its subject on a phone. This is the
single biggest failure of the current site.

> The same scene and the same light as the desktop hero, recomposed vertically.
> Snow peak and sky occupying the upper half, mist and ridgelines through the
> middle, terraced slope and two or three grazing cows across the lower third.
>
> Keep the middle band quiet: the headline and buttons sit there.
>
> No text, no lettering, no logos, no product, no watermark.

---

## S4. Category tiles

**Where they go:** the collection row on the homepage, four tiles.
**Size:** 1200 x 1600, portrait 3:4.
**Note:** only Dairy and Oils are needed now. Honey and More From the Hills
render as tinted contour tiles until those products exist, which is deliberate.

### Dairy

> A close overhead photograph of golden granular desi ghee in a small carved
> wooden bowl, resting on a worn wooden surface beside a brass spoon. Soft warm
> window light from the left, gentle shadows, shallow depth of field. The texture
> of the ghee is the subject: slightly grainy, semi solid, not glossy or liquid.
> Muted warm palette, cream and brass and dark wood.
>
> Leave the lower third simple and unbusy, a category name is set over it.
>
> No text, no branding, no jar, no label, no packaging.

### Oils

> A close photograph of cold pressed mustard oil being poured in a thin stream
> into a small ceramic dish, on a dark wooden kitchen surface. A few mustard
> seeds scattered nearby. Warm side light, the oil catching the light as it
> falls. Quiet, restrained, documentary.
>
> Leave the lower third simple, a category name is set over it.
>
> No text, no branding, no bottle label, no packaging.

---

## S5. The making

**Where it goes:** the product story section, "Slowly crafted, rooted in
tradition".
**Size:** 1600 x 1200, landscape 4:3, one image per step.
**Can ship without:** yes, the section degrades to typography.

### Curd

> A large steel or earthen pot of set curd in a mountain kitchen at dawn, cloth
> covered, natural light from a small window. Hands lifting the cloth. Warm
> muted tones, real kitchen, not styled.

### Churn

> A traditional wooden bilona churn in a Pahadi kitchen, the rope wound around
> it, hands working it. Butter beginning to separate in the pot. Motion is
> welcome, a little blur in the hands. Warm low light, documentary, unposed.

### Simmer

> Butter simmering slowly in a heavy brass pot over a low flame, turning golden,
> fine bubbles at the edge. Steam. A wooden ladle resting against the rim. Close,
> warm, patient.

All three: no text, no logos, no packaging, no modern branded equipment.

---

## S6. Everyday rituals

**Where it goes:** "Made for the food you already cook."
**Size:** 1600 x 1200, landscape.

> An unstyled Indian home meal on a simple table: hot rotis, a bowl of dal, plain
> rice, a small dish of ghee with a spoon in it. Daylight from a window. A hand
> reaching in to spoon ghee over a roti. Real household, slightly imperfect,
> warm and lived in. Documentary food photography, not a studio food shot.
>
> No text, no branding, no packaging, no restaurant styling, no garnish
> perfection.

---

## S7. The ghee gallery

**Audited against production storage, 24 August.** Five of the ten never
resolve on a dev machine, which is why an earlier pass called all ten posters.
They are not. Three are clean photographs and should be kept.

| # | File ends | What it is | Verdict |
| --- | --- | --- | --- |
| 01 | `ju22ehd6` | Jar, front, straight on, white ground | **Keep.** The packshot. Product cards and the shop grid use this |
| 02 | `3gktlbe3` | Jar, front, taller crop | **Keep.** Second angle |
| 03 | `ctr1il17` | Dark green poster, baked headline | Replace |
| 04 | `1ji76vz2` | "100% Pure Desi Cow Milk. Nothing Else." | Replace |
| 05 | `0dm6kgl2` | "Any Time of Day", four captioned sub-photos | Replace. Three of its four frames are already cut out and in use as `ritual-*.jpg` |
| 06 | `jvqa5587` | Jar with laddoos, brass thali, lamps | **Keep.** The only warm low-light frame on the brand |
| 07 | `4yivf3do` | "DESI COW GHEE" plus feature bullets | Replace |
| 08 | `pbcou03h` | Nutrition facts panel | Replace. This belongs in `Product.nutritionFacts`, which renders as a table, not as a picture of a table |
| 09 | `cdxs03df` | "Daanedar, Dense & Deeply Nourishing", vitamin claims | Replace. Also the strongest health claims on the site |
| 10 | `0w4utavx` | "Built by Farmers, Backed by Soil" | Replace |

### What AI can and cannot do here

**It cannot generate your jar.** Any model asked for "a jar of Country Dairy
ghee" invents a label — wrong logo, wrong wording, mangled Devanagari. Published
as product photography that is misleading, and it is the one place on an
ecommerce site where the picture is a claim about what arrives.

So the gallery splits in two:

- **Frames where the pack is the subject** — photograph them. A phone on a
  windowsill with a white sheet behind is enough; you already have 01, 02 and 06
  proving the lighting works.
- **Frames where the pack is absent or incidental** — generate freely. Ghee in a
  bowl, on a roti, milk, pasture. No label, no problem.

### Shoot, do not generate

Same jar, same daylight, no text anywhere in frame.

| Shot | Why it exists |
| --- | --- |
| Jar three-quarter, soft shadow | Product page hero. 01 and 02 are both dead-on |
| Lid off, ghee surface visible | The texture proof. Nothing in the gallery shows the ghee itself in the pack |
| 1L and 500ml together | The size choice is a real decision on the page and nothing illustrates it |

Leave space around the subject so one frame crops square, portrait and
landscape.

### Generate

**Reference for all four:** image 06, the laddoo frame — it is the brand's own
light, warm and low and unstyled. Attach it, then paste the prompt.

#### G1. Texture macro

**Where:** gallery, and the ghee story section.
**Size:** 1600 x 1600, square.

> Extreme close-up of golden clarified butter with a fine granular crystalline
> texture, lifted on a plain steel spoon over a wooden surface. Warm daylight
> from one side, shallow depth of field. No jar, no packaging, no text. The
> grain is the subject.

#### G2. On the roti

**Where:** gallery, usage.
**Size:** 1600 x 1200, landscape 4:3.

> A hot phulka roti on a plain steel plate, a spoonful of golden ghee melting
> and running across it. Overhead, close, home kitchen, morning daylight. No
> packaging, no branded objects, no text. Real food, slightly imperfect.

#### G3. The source

**Where:** gallery, and the ingredient slot the brief asks for.
**Size:** 1600 x 1200, landscape 4:3.

> Fresh milk being poured into a steel pail in a hill village at first light,
> steam rising, a native Indian cow out of focus behind. Documentary, unposed,
> muted natural colour. No packaging, no text, no branded equipment.

#### G4. The kitchen it lives in

**Where:** gallery, lifestyle.
**Size:** 1600 x 1200, landscape 4:3.

> A plain Pahadi kitchen shelf in daylight: brass and steel vessels, a wooden
> spoon, a stone wall behind. Warm and worn, genuinely used, nothing styled or
> arranged for camera. Leave the right third of the frame quiet. No packaging,
> no text.

Composite the real jar into G4 afterwards if you want it in shot, or shoot G4
with the jar in place. Do not ask a model to draw it.

---

## Product photography, the longer job

The three shots under "Shoot, do not generate" above are the minimum. A full
shoot would also want the jar in a real kitchen, both sizes together, and the
granular texture — all on the packaging you actually ship, in daylight, with
room around the subject.
