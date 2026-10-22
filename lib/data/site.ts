// export const site = {
//   name: "Chaitanya Raj Psychology & Counselling",
//   shortName: "Chaitanya Raj",
//   founder: "Lt. Col. Rajesh Sharma (Retd.)",
//   founderCredentials: "Clinical Hypnotherapist & Counselling Psychologist, 25+ years of practice",
//   tagline: "A quieter place to work through what's heavy",
//   description:
//     "Clinical psychology, counselling and hypnotherapy in Vashi, Navi Mumbai — evidence-based support for anxiety, depression, stress, trauma and relationships, led by Lt. Col. Rajesh Sharma (Retd.), with 25+ years of clinical experience.",
//   url: "https://www.chaitanyaraj.com",
//   phone: "+91-9628493677",
//   phoneDisplay: "+91 96284 93677",
//   email: "contactchaitanyaraj@gmail.com",
//   address: {
//     street: "215, 2nd Floor, Gold City, Sector 19 D",
//     locality: "Vashi, Navi Mumbai",
//     region: "Maharashtra",
//     postalCode: "400703",
//     country: "IN"
//   },
//   geo: { lat: 19.0771, lng: 72.9987 },
//   hours: "Mon–Sat, 10:00 AM – 7:00 PM",
//   social: {
//     facebook: "https://www.facebook.com/CRmentalhealthservices",
//     instagram: "https://www.instagram.com/rajeshbits/",
//     linkedin: "https://www.linkedin.com/in/lt-col-rajesh-sharma-retd-06b4621b7/"
//   }
// };

export const site = {
  name: "Chaitanya Raj Psychology & Counselling",
  shortName: "Chaitanya Raj",
  founder: "Lt Col Rajesh Sharma (Retd)",
  founderCredentials: "Clinical Hypnotherapist & Counselling Psychologist (MA Clinical Psychology Gold Medalist, PG diploma Clinical Hypnosis), 25+ years of practice",
  tagline: "A quieter place to work through what's heavy",
  description:
    "Clinical psychology, counselling & hypnotherapy in Vashi, Navi Mumbai. Evidence-based support for anxiety, depression, stress and trauma. 25+ years' experience.",
  url: "https://www.chaitanyaraj.com",
  phone: "+91-9628493677",
  phoneDisplay: "+91 96284 93677",
  email: "contactchaitanyaraj@gmail.com",
  address: {
    street: "215, 2nd Floor, Gold City, Sector 19 D",
    locality: "Vashi, Navi Mumbai",
    region: "Maharashtra",
    postalCode: "400703",
    country: "IN"
  },
  geo: { lat: 19.0771, lng: 72.9987 },
  hours: "Mon–Sat, 10:00 AM – 7:00 PM",
  social: {
    facebook: "https://www.facebook.com/CRmentalhealthservices",
    instagram: "https://www.instagram.com/rajeshbits/",
    // The CBD Belapur meditation centre's account, linked from the floating bar.
    instagramMeditation: "https://www.instagram.com/rajmeditation/",
    linkedin: "https://www.linkedin.com/in/lt-col-rajesh-sharma-retd-06b4621b7/"
  },
  locations: [
    {
      name: "Vashi",
      address: {
        street: "215, 2nd Floor, Gold City, Sector 19 D",
        locality: "Vashi, Navi Mumbai",
        region: "Maharashtra",
        postalCode: "400703",
      },
      geo: { lat: 19.0771, lng: 72.9987 },
      // There is no Google listing for this clinic, only a dropped pin, and a
      // name search shows no marker, so the map is pinned by coordinates.
      mapQuery: "19.0771,72.9987",
      mapUrl: "https://www.google.com/maps/search/?api=1&query=19.0771%2C72.9987",
    },
    {
      name: "Belapur",
      address: {
        street: "G-3, Lane-6, Sector-9",
        locality: "CBD Belapur, Navi Mumbai",
        region: "Maharashtra",
        postalCode: "400614",
      },
      geo: { lat: 19.030793, lng: 73.0342282 }, // Google Maps pin for the CBD Belapur centre
      mapQuery:
        "Rajesh Sharma Meditation Center, G-3, Lane-6, Sector 9, CBD Belapur, Navi Mumbai, Maharashtra 400614",
      mapUrl:
        "https://www.google.com/maps/place/Rajesh+Sharma+Meditation+Center,+G-3,+Lane-6,+Sector+9,+CBD+Belapur,+Navi+Mumbai,+Maharashtra+400614/@19.030793,73.0342282,16z/data=!4m6!3m5!1s0x3be7c3b0743853dd:0x62fdd094149b234d!8m2!3d19.030793!4d73.0342282!16s%2Fg%2F11xng_zhp4",
    },
  ],
};