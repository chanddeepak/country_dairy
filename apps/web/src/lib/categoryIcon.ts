import {
  Apple, Banana, Beef, Beer, Candy, Carrot, Cherry, Citrus, Coffee, Cookie,
  Croissant, CupSoda, Droplet, Droplets, Egg, Fish, Flame, Gift, Grape, Heart,
  IceCream, IceCreamCone, Leaf, Milk, Mountain, MountainSnow, Nut, Package,
  Popcorn, Salad, Sandwich, ShoppingBasket, Snowflake, Soup, Sparkles, Sprout,
  Star, Sun, TreePine, Utensils, Vegan, Wheat, Wind, Wine,
  type LucideIcon,
} from 'lucide-react';

/**
 * `Category.iconName` holds a Lucide icon name and has done since the schema
 * was written — "Milk" for ghee, "Droplet" for oils, "Sun" for honey. Nothing
 * had ever rendered it.
 *
 * The map is explicit rather than a dynamic lookup on the whole library for
 * two reasons: the bundle only carries the icons a food shop could plausibly
 * use, and a name nobody recognises degrades to a jar instead of throwing
 * inside the navigation on every page of the site.
 */
const ICONS: Record<string, LucideIcon> = {
  Apple, Banana, Beef, Beer, Candy, Carrot, Cherry, Citrus, Coffee, Cookie,
  Croissant, CupSoda, Droplet, Droplets, Egg, Fish, Flame, Gift, Grape, Heart,
  IceCream, IceCreamCone, Leaf, Milk, Mountain, MountainSnow, Nut, Package,
  Popcorn, Salad, Sandwich, ShoppingBasket, Snowflake, Soup, Sparkles, Sprout,
  Star, Sun, TreePine, Utensils, Vegan, Wheat, Wind, Wine,
};

/** The icon for a category, or a plain jar when the name is unknown or unset. */
export function categoryIcon(iconName?: string | null): LucideIcon {
  return (iconName && ICONS[iconName]) || Package;
}
