import type { Metadata } from "next";
import { githubUrl } from "@/lib/links";

export const site = {
  name: "ViewPulse — YouTube History Analyzer by Self Degree",
  url: "https://self-degree.com/tools/youtube-analytics",
  description:
    "Open-source YouTube watch history analyzer: local Takeout parsing, dashboard, optional Games, and optional BYOK AI exports. No server-side storage of your history for core analytics.",
  image: "https://self-degree.com/og/youtube-analytics.jpg"
};

type CreateMetadataInput = {
  title: string;
  description: string;
  path: string;
  keywords: string[];
};

export function createMetadata(input: CreateMetadataInput): Metadata {
  const url = `${site.url}${input.path}`;

  return {
    title: `${input.title} | ${site.name}`,
    description: input.description,
    metadataBase: new URL(site.url),
    alternates: {
      canonical: url
    },
    keywords: input.keywords,
    openGraph: {
      title: input.title,
      description: input.description,
      url,
      siteName: site.name,
      type: "website",
      images: [{ url: site.image, width: 1200, height: 630, alt: input.title }]
    },
    twitter: {
      card: "summary_large_image",
      title: input.title,
      description: input.description,
      images: [site.image]
    }
  };
}

export function softwareAppJsonLd(name: string, description: string, useCase: string) {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD"
    },
    brand: {
      "@type": "Brand",
      name: "Self Degree"
    },
    isAccessibleForFree: true,
    softwareHelp: {
      "@type": "CreativeWork",
      url: githubUrl
    },
    featureList: [
      "YouTube channel analytics",
      "Client-side only processing",
      "No server-side data storage",
      "Open-source codebase",
      "SEO recommendations",
      "Engagement and growth insights",
      useCase
    ],
    sameAs: [githubUrl]
  };
}
