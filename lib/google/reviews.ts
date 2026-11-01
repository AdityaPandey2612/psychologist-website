export interface GoogleReview {
    author_name: string;
    author_url?: string;
    profile_photo_url?: string;
    rating: number;
    relative_time_description: string;
    text: string;
    time: number;
  }
  
  export interface PlaceReviewsResult {
    reviews: GoogleReview[];
    rating: number;
    userRatingsTotal: number;
  }
  
  // Both clinics: Vashi and CBD Belapur (the place IDs come from their Google Maps listings).
  const HARDCODED_PLACE_IDS = ["ChIJcfAc4QPB5zsRQxOL_wTH0vU", "ChIJ3VM4dLDD5zsRTSObFJTQ_WI"];
  const HARDCODED_PLACES_API_KEY = ""; // paste the Google Places API key here

  async function fetchPlace(placeId: string, apiKey: string): Promise<PlaceReviewsResult | null> {
    const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
    url.searchParams.set("place_id", placeId);
    url.searchParams.set("fields", "reviews,rating,user_ratings_total");
    url.searchParams.set("reviews_sort", "newest");
    url.searchParams.set("key", apiKey);

    try {
      const res = await fetch(url.toString(), {
        next: { revalidate: 60 * 60 * 24 }, // cache 24h — don't hit Google on every request
      });
      const data = await res.json();
      if (data.status !== "OK") {
        console.error("Places API error:", placeId, data.status);
        return null;
      }
      return {
        reviews: data.result.reviews ?? [],
        rating: data.result.rating ?? 0,
        userRatingsTotal: data.result.user_ratings_total ?? 0,
      };
    } catch (error) {
      console.error("Failed to fetch Google reviews:", error);
      return null;
    }
  }

  /** The reviews of every clinic's listing together (newest first), or null when none could be fetched. */
  export async function getGoogleReviews(): Promise<PlaceReviewsResult | null> {
    const fromEnv = (process.env.GOOGLE_PLACE_IDS || process.env.GOOGLE_PLACE_ID || "").split(",").map((id) => id.trim()).filter(Boolean);
    const placeIds = fromEnv.length ? fromEnv : HARDCODED_PLACE_IDS;
    const apiKey = process.env.GOOGLE_PLACES_API_KEY || HARDCODED_PLACES_API_KEY;
    if (!placeIds.length || !apiKey) return null;

    const places = (await Promise.all(placeIds.map((id) => fetchPlace(id, apiKey)))).filter((p): p is PlaceReviewsResult => p !== null);
    if (places.length === 0) return null;

    const seen = new Set<string>();
    const reviews = places
      .flatMap((p) => p.reviews)
      .filter((r) => {
        const key = `${r.author_name}|${r.time}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => b.time - a.time);
    const total = places.reduce((sum, p) => sum + p.userRatingsTotal, 0);
    const rating = total ? places.reduce((sum, p) => sum + p.rating * p.userRatingsTotal, 0) / total : 0;
    return { reviews, rating, userRatingsTotal: total };
  }
