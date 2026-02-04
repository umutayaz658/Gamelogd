import { HandCoins, ArrowRight, Building2, User, Briefcase } from 'lucide-react';
import { InvestorCall } from '@/types';

interface InvestorCallCardProps {
    call: InvestorCall;
    onClick?: () => void;
}

export default function InvestorCallCard({ call, onClick }: InvestorCallCardProps) {
    const getTypeStyles = (type: string) => {
        switch (type) {
            case 'publisher':
                return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
            case 'vc':
                return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
            case 'angel':
                return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
            case 'grant':
                return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
            default:
                return 'bg-zinc-800 text-zinc-400';
        }
    };

    const getInvestorLabel = (type: string) => {
        switch (type) {
            case 'vc': return 'Venture Capital';
            case 'publisher': return 'Publisher';
            case 'angel': return 'Angel Investor';
            case 'grant': return 'Grant / Fund';
            case 'accelerator': return 'Accelerator';
            default: return type;
        }
    }

    return (
        <div
            onClick={onClick}
            className="bg-zinc-900 rounded-2xl border border-zinc-800 p-6 hover:border-zinc-600 transition-all group cursor-pointer relative overflow-hidden h-full flex flex-col"
        >
            <div className="flex flex-col gap-6 flex-1">
                {/* Header */}
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-xl bg-zinc-800 flex items-center justify-center shrink-0">
                            <Building2 className="h-6 w-6 text-zinc-400" />
                        </div>
                        <div>
                            <h3 className="font-bold text-white text-lg line-clamp-1">{call.organization_name}</h3>
                            <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold border mt-1 capitalize ${getTypeStyles(call.investor_type)}`}>
                                {getInvestorLabel(call.investor_type)}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Details */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-zinc-950/50 p-3 rounded-xl border border-zinc-800/50">
                        <div className="text-xs text-zinc-500 mb-1">Looking For</div>
                        <div className="text-sm text-zinc-200 font-medium leading-tight line-clamp-3">
                            {call.looking_for}
                        </div>
                    </div>
                    <div className="bg-zinc-950/50 p-3 rounded-xl border border-zinc-800/50 h-fit">
                        <div className="text-xs text-zinc-500 mb-1">Ticket Size</div>
                        <div className="text-sm text-emerald-400 font-bold flex items-center gap-1.5">
                            <HandCoins className="h-3.5 w-3.5" />
                            {call.ticket_size}
                        </div>
                    </div>
                </div>

                {/* Spacer to push button down */}
                <div className="flex-1"></div>

                {/* Action */}
                <button className="flex items-center justify-between w-full px-4 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-white font-medium text-sm transition-all group/btn mt-auto">
                    <span>Apply with Project</span>
                    <ArrowRight className="h-4 w-4 text-zinc-500 group-hover/btn:text-white group-hover/btn:translate-x-1 transition-all" />
                </button>
            </div>
        </div>
    );
}
