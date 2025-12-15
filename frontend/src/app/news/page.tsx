import Navbar from "@/components/Navbar";
import LeftSidebar from "@/components/LeftSidebar";
import NewsCard from "@/components/NewsCard";

export default function NewsPage() {
    const heroNews = {
        featured: {
            title: "The Future of Gaming: Unreal Engine 6 Tech Demo Blows Minds",
            image: "https://images.unsplash.com/photo-1538481199705-c710c4e965fc?q=80&w=2070&auto=format&fit=crop",
            category: "Technology",
            readTime: "5 min read"
        },
        side: [
            {
                id: 1,
                title: "PlayStation 6 Rumors: What We Know So Far",
                image: "https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?q=80&w=2070&auto=format&fit=crop",
                category: "Hardware",
                readTime: "3 min read"
            },
            {
                id: 2,
                title: "Top 10 Indie Games You Missed in 2024",
                image: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=2070&auto=format&fit=crop",
                category: "Indie",
                readTime: "4 min read"
            }
        ]
    };

    const latestNews = [
        {
            id: 1,
            title: "Review: Starfield Shattered Space Expansion",
            image: "https://images.unsplash.com/photo-1614713555616-9da981754df8?q=80&w=2070&auto=format&fit=crop",
            category: "Review",
            readTime: "8 min read"
        },
        {
            id: 2,
            title: "Esports: T1 Wins Worlds 2024 in Dramatic Fashion",
            image: "https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=2070&auto=format&fit=crop",
            category: "Esports",
            readTime: "6 min read"
        },
        {
            id: 3,
            title: "Nintendo Switch 2 Launch Titles Leaked?",
            image: "https://images.unsplash.com/photo-1578303512597-81e6cc155b3e?q=80&w=2070&auto=format&fit=crop",
            category: "Rumor",
            readTime: "3 min read"
        },
        {
            id: 4,
            title: "Developer Interview: The Making of Hades II",
            image: "https://images.unsplash.com/photo-1511512578047-dfb367046420?q=80&w=2071&auto=format&fit=crop",
            category: "Interview",
            readTime: "10 min read"
        }
    ];

    return (
        <div className="min-h-screen bg-zinc-950 text-white font-sans selection:bg-emerald-500/30">
            <Navbar />

            <main className="container mx-auto px-4 pt-6 pb-12">
                <div className="grid grid-cols-12 gap-6">
                    {/* Left Sidebar - Navigation */}
                    <div className="hidden lg:block col-span-3">
                        <LeftSidebar />
                    </div>

                    {/* Main Content Area */}
                    <div className="col-span-12 lg:col-span-9 flex flex-col gap-8">

                        {/* Hero Section */}
                        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 h-auto md:h-[500px]">
                            {/* Featured News (Left - 2/3 width) */}
                            <div className="md:col-span-2 h-[300px] md:h-full">
                                <NewsCard
                                    title={heroNews.featured.title}
                                    image={heroNews.featured.image}
                                    category={heroNews.featured.category}
                                    readTime={heroNews.featured.readTime}
                                    size="featured"
                                />
                            </div>

                            {/* Side News (Right - 1/3 width, stacked) */}
                            <div className="md:col-span-1 flex flex-col gap-6 h-full">
                                {heroNews.side.map((news) => (
                                    <div key={news.id} className="flex-1">
                                        <NewsCard
                                            title={news.title}
                                            image={news.image}
                                            category={news.category}
                                            readTime={news.readTime}
                                            size="featured" // Using featured style but smaller container makes it look good
                                        />
                                    </div>
                                ))}
                            </div>
                        </section>

                        {/* Latest News Grid */}
                        <section>
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-2xl font-bold text-white border-l-4 border-emerald-500 pl-4">
                                    Latest News
                                </h2>
                                <button className="text-sm text-zinc-400 hover:text-white transition-colors">
                                    View All
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {latestNews.map((news) => (
                                    <div key={news.id} className="h-[320px]">
                                        <NewsCard
                                            title={news.title}
                                            image={news.image}
                                            category={news.category}
                                            readTime={news.readTime}
                                            size="standard"
                                        />
                                    </div>
                                ))}
                            </div>
                        </section>

                    </div>
                </div>
            </main>
        </div>
    );
}
