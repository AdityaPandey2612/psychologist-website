// Supporting articles and case studies for each condition page. Service pages
// link down to informational content (and the blog links back up, see
// lib/blog/seo.ts) so each URL has a distinct role for search engines.
export type InternalLink = { href: string; label: string };

export const conditionReading: Record<string, InternalLink[]> = {
  "relationship-counselling-navi-mumbai": [
    { href: "/couples-counselling-navi-mumbai", label: "Couples counselling in Navi Mumbai" },
    { href: "/blog/how-to-fix-a-relationship-before-its-too-late", label: "How to fix a relationship before it's too late" },
    { href: "/blog/feeling-unheard-in-your-marriage-the-silent-problem-behind-most-divorces", label: "Feeling unheard in your marriage" },
    { href: "/blog/intimacy-problems-in-marriage-how-to-reconnect", label: "Intimacy problems in marriage: how to reconnect" }
  ],
  "trauma-ptsd-counselling-navi-mumbai": [
    { href: "/blog/how-to-overcome-emotional-trauma", label: "How to overcome emotional trauma" }
  ],
  "abuse-trauma-counselling-navi-mumbai": [
    { href: "/conditions/trauma-ptsd-counselling-navi-mumbai", label: "Trauma and PTSD therapy" },
    { href: "/blog/how-to-overcome-emotional-trauma", label: "How to overcome emotional trauma" }
  ],
  "anger-management-counselling-navi-mumbai": [
    { href: "/blog/dealing-with-aggressive-people", label: "Dealing with aggressive people" },
    { href: "/case-studies/anger-management", label: "Case study: reactive anger and family relationships" }
  ],
  "sexual-dysfunction-counselling-navi-mumbai": [
    { href: "/blog/aversion-to-sex", label: "Aversion to sex in marriage: a client's story" },
    { href: "/case-studies/aversion-to-sex", label: "Case study: working through an aversion to intimacy" }
  ],
  "depression-therapy-navi-mumbai": [
    { href: "/blog/understanding-depression-signs-research-and-real-stories", label: "Understanding depression: signs, research and real stories" },
    { href: "/case-studies/anxiety-and-depression", label: "Case study: co-occurring anxiety and depression" }
  ],
  "anxiety-therapy-navi-mumbai": [
    { href: "/blog/how-to-stop-negative-thoughts", label: "How to stop negative thoughts" },
    { href: "/case-studies/anxiety-and-depression", label: "Case study: co-occurring anxiety and depression" }
  ],
  "ocd-therapy-navi-mumbai": [
    { href: "/blog/understanding-ocd-in-adults", label: "Understanding OCD in adults" }
  ],
  "best-past-life-regression-therapy-in-navi-mumbai": [
    { href: "/therapies/past-life-regression-technique", label: "How past life regression therapy works" },
    {
      href: "/blog/what-actually-happens-in-a-past-life-regression-session-and-why-people-sometimes-cry-halfway-through",
      label: "What actually happens in a past life regression session"
    },
    { href: "/blog/past-life-regression-session-story-vashi", label: "Past life regression: a real session story" }
  ],
  "sleep-disorder-counselling-navi-mumbai": [
    { href: "/case-studies/insomnia", label: "Case study: chronic insomnia and racing thoughts" }
  ],
  "stress-burnout-counselling-navi-mumbai": [
    { href: "/case-studies/migraine", label: "Case study: reducing stress-linked migraine frequency" }
  ]
};
