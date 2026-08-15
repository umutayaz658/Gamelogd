import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { fetchForMetadata } from '@/lib/server-fetch';
import ProjectDetailClient from './ProjectDetailClient';

type Props = { params: Promise<{ id: string }> };

interface ProjectMeta {
    id: number;
    title: string;
    description?: string;
    cover_image?: string | null;
    logo?: string | null;
    tech_stack?: string[];
    created_at?: string;
    owner: { username: string };
    organisation_details?: { name: string } | null;
}

function getProject(id: string) {
    return fetchForMetadata<ProjectMeta>(`/projects/${id}/`);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { id } = await params;
    const project = await getProject(id);
    if (!project) {
        return { title: 'Project not found' };
    }

    const description = (project.description || '').slice(0, 160);
    const imageUrl = project.cover_image || project.logo || undefined;
    const images = imageUrl ? [{ url: imageUrl }] : undefined;

    return {
        title: project.title,
        description,
        alternates: { canonical: `/projects/${id}` },
        openGraph: { title: project.title, description, images },
        twitter: { card: 'summary_large_image', title: project.title, description, images: images?.map(i => i.url) },
    };
}

export default async function ProjectDetailPage({ params }: Props) {
    const { id } = await params;
    const project = await getProject(id);
    if (!project) {
        notFound();
    }

    // CreativeWork, not VideoGame/SoftwareApplication: Project has no genre/platform/rating
    // data, and SoftwareApplication expects applicationCategory/operatingSystem we can't
    // supply — CreativeWork has no required fields, so it stays valid without overclaiming.
    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'CreativeWork',
        name: project.title,
        ...(project.description ? { description: project.description } : {}),
        ...(project.cover_image || project.logo ? { image: project.cover_image || project.logo } : {}),
        ...(project.created_at ? { dateCreated: project.created_at } : {}),
        ...(project.tech_stack && project.tech_stack.length > 0 ? { keywords: project.tech_stack.join(', ') } : {}),
        author: project.organisation_details
            ? { '@type': 'Organization', name: project.organisation_details.name }
            : { '@type': 'Person', name: project.owner.username },
    };

    return (
        <>
            <script
                type="application/ld+json"
                // eslint-disable-next-line react/no-danger
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />
            <ProjectDetailClient />
        </>
    );
}
