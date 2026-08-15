import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { fetchForMetadata } from '@/lib/server-fetch';
import OrganisationDetailClient from './OrganisationDetailClient';

type Props = { params: Promise<{ slug: string }> };

interface OrganisationMeta {
    id: number;
    name: string;
    slug: string;
    description?: string;
    logo?: string | null;
    banner?: string | null;
    website?: string;
    twitter?: string;
    youtube?: string;
}

function getOrganisation(slug: string) {
    return fetchForMetadata<OrganisationMeta>(`/organisations/${slug}/`);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug } = await params;
    const org = await getOrganisation(slug);
    if (!org) {
        return { title: 'Organisation not found' };
    }

    const description = (org.description || '').slice(0, 160);
    const imageUrl = org.banner || org.logo || undefined;
    const images = imageUrl ? [{ url: imageUrl }] : undefined;

    return {
        title: org.name,
        description,
        alternates: { canonical: `/organisations/${slug}` },
        openGraph: { title: org.name, description, images },
        twitter: { card: 'summary_large_image', title: org.name, description, images: images?.map(i => i.url) },
    };
}

export default async function OrganisationDetailPage({ params }: Props) {
    const { slug } = await params;
    const org = await getOrganisation(slug);
    if (!org) {
        notFound();
    }

    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: org.name,
        ...(org.description ? { description: org.description } : {}),
        ...(org.logo ? { logo: org.logo } : {}),
        url: org.website || `https://gamelogd.net/organisations/${slug}`,
        ...((org.twitter || org.youtube) ? { sameAs: [org.twitter, org.youtube].filter(Boolean) } : {}),
    };

    return (
        <>
            <script
                type="application/ld+json"
                // eslint-disable-next-line react/no-danger
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />
            <OrganisationDetailClient />
        </>
    );
}
