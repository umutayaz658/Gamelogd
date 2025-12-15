'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import { User, Mail, Lock, ArrowRight, ArrowLeft, Gamepad2, Code2, Briefcase, Check, Smartphone, Monitor, Gamepad, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

export default function RegisterPage() {
    const [currentStep, setCurrentStep] = useState(1);
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: '',
        confirmPassword: '',
        phoneNumber: '',
        roles: [] as string[],
        gender: '',
        birthDate: '',
        interests: [] as string[],
        platforms: [] as string[]
    });

    const steps = [
        { id: 1, title: "Account & Contact" },
        { id: 2, title: "Identity & Persona" },
        { id: 3, title: "Taste Profile" }
    ];

    const interestsList = [
        "RPG", "FPS", "MMORPG", "Indie", "Strategy", "Simulation",
        "Esports", "News", "Invest", "Retro", "Horror", "Puzzle",
        "Adventure", "Open World", "Sci-Fi", "Fantasy"
    ];

    const handleNext = (e: React.FormEvent) => {
        e.preventDefault();
        if (currentStep < 3) {
            setCurrentStep(prev => prev + 1);
        } else {
            handleSubmit();
        }
    };

    const handleBack = () => {
        if (currentStep > 1) {
            setCurrentStep(prev => prev - 1);
        }
    };

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    const handleSubmit = async () => {
        setIsSubmitting(true);
        setError(null);

        // 1. Map Frontend Data to Backend Keys (Snake Case)
        const payload = {
            username: formData.username,
            email: formData.email,
            password: formData.password,
            phone_number: formData.phoneNumber,
            is_gamer: formData.roles.includes('gamer'),
            is_developer: formData.roles.includes('developer'),
            is_investor: formData.roles.includes('investor'),
            gender: formData.gender,
            birth_date: formData.birthDate || null,
            platforms: formData.platforms,
            interests: formData.interests,
            roles: formData.roles
        };

        console.log('Submitting Registration Payload:', payload);

        try {
            // 2. API Call
            await api.post('/register/', payload);

            // 3. Success
            alert('Registration successful! Please login.');
            router.push('/login');

        } catch (err: any) {
            console.error('Registration Error:', err.response?.data || err.message);
            setError(err.response?.data?.detail || 'Registration failed. Please check your inputs.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const toggleRole = (role: string) => {
        setFormData(prev => ({
            ...prev,
            roles: prev.roles.includes(role)
                ? prev.roles.filter(r => r !== role)
                : [...prev.roles, role]
        }));
    };

    const toggleInterest = (interest: string) => {
        setFormData(prev => ({
            ...prev,
            interests: prev.interests.includes(interest)
                ? prev.interests.filter(i => i !== interest)
                : [...prev.interests, interest]
        }));
    };

    const togglePlatform = (platform: string) => {
        setFormData(prev => ({
            ...prev,
            platforms: prev.platforms.includes(platform)
                ? prev.platforms.filter(p => p !== platform)
                : [...prev.platforms, platform]
        }));
    };

    return (
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4 selection:bg-emerald-500/30">
            <div className="w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-2xl shadow-black/50 overflow-hidden relative">

                {/* Progress Bar */}
                <div className="absolute top-0 left-0 w-full h-1 bg-zinc-800">
                    <motion.div
                        className="h-full bg-emerald-500"
                        initial={{ width: "33%" }}
                        animate={{ width: `${(currentStep / 3) * 100}%` }}
                        transition={{ duration: 0.3 }}
                    />
                </div>

                {/* Header */}
                <div className="text-center mb-8 mt-4">
                    <Link href="/" className="inline-block text-3xl font-bold text-white mb-2 hover:text-zinc-200 transition-colors">
                        Gamelogd
                    </Link>
                    <p className="text-zinc-400">Step {currentStep} of 3: {steps[currentStep - 1].title}</p>
                </div>

                <form onSubmit={handleNext} className="space-y-6">
                    <AnimatePresence mode="wait">
                        {currentStep === 1 && (
                            <motion.div
                                key="step1"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-4"
                            >
                                {/* Username */}
                                <div className="relative group">
                                    <User className="absolute left-3 top-3 h-5 w-5 text-zinc-500 group-focus-within:text-emerald-500 transition-colors" />
                                    <input
                                        type="text"
                                        placeholder="Username"
                                        className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl py-2.5 pl-10 pr-4 text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all"
                                        value={formData.username}
                                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                        required
                                    />
                                </div>

                                {/* Email */}
                                <div className="relative group">
                                    <Mail className="absolute left-3 top-3 h-5 w-5 text-zinc-500 group-focus-within:text-emerald-500 transition-colors" />
                                    <input
                                        type="email"
                                        placeholder="Email address"
                                        className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl py-2.5 pl-10 pr-4 text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        required
                                    />
                                </div>

                                {/* Phone Number */}
                                <div className="relative group phone-input-container">
                                    <PhoneInput
                                        placeholder="Phone number"
                                        value={formData.phoneNumber}
                                        onChange={(value?: string) => setFormData({ ...formData, phoneNumber: value || '' })}
                                        className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl py-2.5 px-4 text-zinc-200 placeholder:text-zinc-600 focus-within:border-emerald-500/50 focus-within:ring-1 focus-within:ring-emerald-500/50 transition-all"
                                    />
                                </div>

                                {/* Passwords */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="relative group">
                                        <Lock className="absolute left-3 top-3 h-5 w-5 text-zinc-500 group-focus-within:text-emerald-500 transition-colors" />
                                        <input
                                            type="password"
                                            placeholder="Password"
                                            className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl py-2.5 pl-10 pr-4 text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all"
                                            value={formData.password}
                                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div className="relative group">
                                        <Lock className="absolute left-3 top-3 h-5 w-5 text-zinc-500 group-focus-within:text-emerald-500 transition-colors" />
                                        <input
                                            type="password"
                                            placeholder="Confirm Password"
                                            className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl py-2.5 pl-10 pr-4 text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all"
                                            value={formData.confirmPassword}
                                            onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                                            required
                                        />
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {currentStep === 2 && (
                            <motion.div
                                key="step2"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-6"
                            >
                                {/* Roles */}
                                <div>
                                    <label className="block text-zinc-400 text-sm font-bold mb-3 uppercase tracking-wider">Select your Roles</label>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        {[
                                            { id: 'gamer', label: 'Gamer', icon: Gamepad2, color: 'text-blue-500' },
                                            { id: 'developer', label: 'Developer', icon: Code2, color: 'text-emerald-500' },
                                            { id: 'investor', label: 'Investor', icon: Briefcase, color: 'text-amber-500' }
                                        ].map((role) => (
                                            <div
                                                key={role.id}
                                                onClick={() => toggleRole(role.id)}
                                                className={`cursor-pointer p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-3 ${formData.roles.includes(role.id)
                                                    ? 'border-emerald-500 bg-emerald-500/10'
                                                    : 'border-zinc-800 bg-zinc-950/50 hover:border-zinc-700'
                                                    }`}
                                            >
                                                <role.icon className={`h-8 w-8 ${role.color}`} />
                                                <span className={`font-bold ${formData.roles.includes(role.id) ? 'text-white' : 'text-zinc-400'}`}>
                                                    {role.label}
                                                </span>
                                                {formData.roles.includes(role.id) && (
                                                    <div className="absolute top-2 right-2">
                                                        <Check className="h-4 w-4 text-emerald-500" />
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Demographics */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-zinc-400 text-sm font-bold mb-2">Gender</label>
                                        <select
                                            className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl py-2.5 px-4 text-zinc-200 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all appearance-none"
                                            value={formData.gender}
                                            onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                                        >
                                            <option value="">Select Gender</option>
                                            <option value="Male">Male</option>
                                            <option value="Female">Female</option>
                                            <option value="Non-binary">Non-binary</option>
                                            <option value="Prefer not to say">Prefer not to say</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-zinc-400 text-sm font-bold mb-2">Birth Date</label>
                                        <input
                                            type="date"
                                            className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl py-2.5 px-4 text-zinc-200 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all"
                                            value={formData.birthDate}
                                            onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {currentStep === 3 && (
                            <motion.div
                                key="step3"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-6"
                            >
                                {/* Interests */}
                                <div>
                                    <label className="block text-zinc-400 text-sm font-bold mb-3 uppercase tracking-wider">Interests</label>
                                    <div className="flex flex-wrap gap-2">
                                        {interestsList.map((interest) => (
                                            <button
                                                key={interest}
                                                type="button"
                                                onClick={() => toggleInterest(interest)}
                                                className={`px-4 py-2 rounded-full text-sm font-bold transition-all border ${formData.interests.includes(interest)
                                                    ? 'bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-900/20'
                                                    : 'bg-zinc-950/50 text-zinc-400 border-zinc-800 hover:border-zinc-600 hover:text-zinc-200'
                                                    }`}
                                            >
                                                {interest}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Platforms */}
                                <div>
                                    <label className="block text-zinc-400 text-sm font-bold mb-3 uppercase tracking-wider">Platforms</label>
                                    <div className="grid grid-cols-3 gap-4">
                                        {[
                                            { id: 'PC', label: 'PC', icon: Monitor },
                                            { id: 'Console', label: 'Console', icon: Gamepad },
                                            { id: 'Mobile', label: 'Mobile', icon: Smartphone }
                                        ].map((platform) => (
                                            <div
                                                key={platform.id}
                                                onClick={() => togglePlatform(platform.id)}
                                                className={`cursor-pointer p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${formData.platforms.includes(platform.id)
                                                    ? 'border-emerald-500 bg-emerald-500/10 text-white'
                                                    : 'border-zinc-800 bg-zinc-950/50 text-zinc-400 hover:border-zinc-700'
                                                    }`}
                                            >
                                                <platform.icon className="h-6 w-6" />
                                                <span className="font-bold text-sm">{platform.label}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Navigation Buttons */}
                    <div className="flex gap-4 pt-4 border-t border-zinc-800">
                        {currentStep > 1 && (
                            <button
                                type="button"
                                onClick={handleBack}
                                className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white font-medium py-3 rounded-xl transition-all flex items-center justify-center gap-2"
                            >
                                <ArrowLeft className="h-4 w-4" />
                                Back
                            </button>
                        )}
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white font-medium py-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Creating Account...
                                </>
                            ) : (
                                currentStep === 3 ? 'Complete Registration' : 'Next Step'
                            )}
                            {currentStep < 3 && <ArrowRight className="h-4 w-4" />}
                        </button>
                    </div>

                    {error && (
                        <div className="text-red-500 text-sm text-center font-medium bg-red-500/10 border border-red-500/20 p-3 rounded-xl">
                            {error}
                        </div>
                    )}
                </form>

                {/* Footer */}
                <div className="mt-6 text-center text-sm text-zinc-500">
                    Already have an account?{' '}
                    <Link href="/login" className="text-emerald-500 hover:text-emerald-400 font-medium transition-colors">
                        Sign in
                    </Link>
                </div>
            </div>
        </div>
    );
}
