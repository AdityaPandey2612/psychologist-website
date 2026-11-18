import type { GoogleReview } from "./reviews";

// Shown on the home page while the live Google reviews cannot be fetched (no Places API key, or Google refused).
// Five-star reviews from the practice's Google Maps listing, as written there; a review that Google shows cut off
// ("… More") is cut off here too. Replace or add to these when new reviews come in.
const review = (author_name: string, text: string, relative_time_description: string): GoogleReview => ({
  author_name,
  text,
  relative_time_description,
  rating: 5,
  time: 0,
});

export const FALLBACK_REVIEWS: GoogleReview[] = [
  review(
    "Priya's fiction villa",
    "An amazing place filled with positive vibes and serenity personified. Col Rajesh aces his craft of guided meditation and by the time you leave the place you are rejuvenated like never before. …",
    "a year ago",
  ),
  review(
    "Vaibhav Tiwari",
    "I was referred by a friend and had a great experience. The practitioner was calm and energetic from the start. I've been going back regularly to declutter and rejuvenate.",
    "a year ago",
  ),
  review(
    "Ashutosh Tiwari",
    "The environment is clean, quiet, and thoughtfully designed to support your inner journey. It's a great place to disconnect from the noise of daily life and reconnect with yourself. …",
    "a year ago",
  ),
  review(
    "shrikant girkar",
    "The Meditation centre is very Peaceful with Beautiful Ambience.. The Vibrations are very strong and this let's your transit in Meditation very easily..Great opportunity for all to join",
    "a year ago",
  ),
  review("sakshi rikhari", "Amazing experience. Very calming and peaceful", "a year ago"),
  review("Shipra's Tasty Recipes", "It had been a wonderful experience of attending the meditation secession by Rajeshji.", "a year ago"),
  review("Krish Chaupal", "I feel very peaceful and happy", "9 months ago"),
  review("Arjun Singh", "Amazing and blissful experience. Strongly recommended. …", "a year ago"),
  review("Rohit Bansode", "Happy to be here", "6 months ago"),
];
