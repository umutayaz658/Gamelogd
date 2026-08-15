import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { fetchForMetadata } from '@/lib/server-fetch';
import DeveloperDetailClient from './DeveloperDetailClient';

type Props = { params: Promise<{ name: string }> };

interface CompanyInfoMeta {
    name: string;
    description?: string;
    logo_url?: string | null;
    start_date?: string | null;
    websites?: { url: string; category: number }[];
    igdb_url?: string;
}

function getCompany(name: string) {
    return fetchForMetadata<CompanyInfoMeta>(`/games/company-info/?name=${encodeURIComponent(name)}`);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { name } = await params;
    const company = await getCompany(name);
    if (!company) {
        return { title: 'Developer not found' };
    }

    const description = (company.description || '').slice(0, 160);
    const images = company.logo_url ? [{ url: company.logo_url }] : undefined;

    return {
        title: company.name,
        description,
        alternates: { canonical: `/developer/${encodeURIComponent(name)}` },
        openGraph: { title: company.name, description, images },
        twitter: { card: 'summary_large_image', title: company.name, description, images: images?.map(i => i.url) },
    };
}

export default async function DeveloperDetailPage({ params }: Props) {
    const { name } = await params;
    const company = await getCompany(name);
    if (!company) {
        notFound();
    }

    // Organization, not Person: this route is an IGDB studio/company proxy, not an
    // individual — same schema.org type as organisations/[slug]/page.tsx.
    const websiteUrls = (company.websites || []).map((w) => w.url).filter(Boolean);
    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: company.name,
        ...(company.description ? { description: company.description } : {}),
        ...(company.logo_url ? { logo: company.logo_url } : {}),
        ...(company.start_date ? { foundingDate: company.start_date } : {}),
        url: websiteUrls[0] || company.igdb_url,
        ...(websiteUrls.length > 0 ? { sameAs: websiteUrls } : {}),
    };

    return (
        <>
            <script
                type="application/ld+json"
                // eslint-disable-next-line react/no-danger
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />
            <DeveloperDetailClient />
        </>
    );
}
