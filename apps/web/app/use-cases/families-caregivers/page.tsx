import { UseCasePage } from "@/components/use-case-page";
import { createMetadata, softwareAppJsonLd } from "@/lib/seo";

export const metadata = createMetadata({
  title: "Families & Caregivers — YouTube Watch History Context",
  description:
    "How families can use ViewPulse with a Google Takeout export to understand YouTube viewing patterns locally. Optional caregiver summary with your own API keys.",
  path: "/use-cases/families-caregivers",
  keywords: [
    "family youtube history",
    "parent youtube viewing report",
    "caregiver youtube habits",
    "google takeout family"
  ]
});

export default function FamiliesCaregiversPage() {
  const jsonLd = softwareAppJsonLd(
    "Families and caregivers — YouTube watch context",
    "ViewPulse helps interpret a Takeout-based YouTube watch history locally, with optional AI summaries when you supply keys.",
    "Household viewing awareness from Takeout"
  );

  return (
    <UseCasePage
      eyebrow="USE CASE"
      title="Families & caregivers"
      lead="When a household agrees to share a Takeout export, ViewPulse can summarize patterns on your device. Trust and consent come first — the app does not bypass Google accounts or secretly collect history."
      bullets={[
        "Analyze only a file someone chose to export and hand you — same privacy model as solo use",
        "Review channel mix, timing, and volume together on one screen",
        "Optional “For Parents” tab (BYOK): generate a neutral written summary from the derived stats you already see",
        "No special “monitoring mode”: this is the same open-source client; transparency is the point"
      ]}
    >
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <h2>Consent and boundaries</h2>
      <p>
        Takeout access belongs to the Google account holder. For minors, guardians should follow applicable
        rules in their region and their own family agreements. ViewPulse is a reader for a file you already
        have permission to use — not a way to access someone else’s account without consent.
      </p>
      <h2>Constructive conversations</h2>
      <p>
        Numbers and charts often land better than vague impressions. Use them to celebrate shared interests,
        notice sleep-adjacent viewing, or plan media habits — framed as collaboration rather than surveillance.
      </p>
    </UseCasePage>
  );
}
