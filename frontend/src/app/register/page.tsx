'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import PhoneInput, { getCountryCallingCode } from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import { User, Mail, Lock, ArrowRight, ArrowLeft, Gamepad2, Code2, Briefcase, Check, Smartphone, Monitor, Gamepad, Loader2, ChevronDown, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useRef } from 'react';

interface CustomCountrySelectProps {
    value?: string;
    onChange: (value?: string) => void;
    options: { value?: string; label: string }[];
}

function CustomCountrySelect({ value, onChange, options }: CustomCountrySelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [dropdownRef]);

    const filteredOptions = options.filter(opt => {
        if (!opt.value) return false;
        const name = opt.label.toLowerCase();
        const code = opt.value.toLowerCase();
        const query = search.toLowerCase();
        return name.includes(query) || code.includes(query);
    });

    return (
        <div className="relative shrink-0" ref={dropdownRef}>
            <button
                type="button"
                onClick={() => { setIsOpen(!isOpen); setSearch(''); }}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-sm font-semibold transition-all duration-200 focus:outline-none ${
                    isOpen
                        ? 'bg-zinc-800 border-zinc-700 text-white'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-white'
                }`}
            >
                <span className="text-zinc-200 font-semibold text-xs uppercase">
                    {value ? `${value} (+${getCountryCallingCode(value as any)})` : 'Select'}
                </span>
                <ChevronDown className={`h-3 w-3 text-zinc-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute top-full left-0 mt-2 w-64 max-h-72 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl shadow-black/80 overflow-hidden z-50 flex flex-col">
                    <style>{`
                        .custom-scrollbar::-webkit-scrollbar {
                            width: 5px;
                        }
                        .custom-scrollbar::-webkit-scrollbar-track {
                            background: transparent;
                        }
                        .custom-scrollbar::-webkit-scrollbar-thumb {
                            background: #27272a;
                            border-radius: 99px;
                        }
                        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                            background: #3f3f46;
                        }
                    `}</style>
                    {/* Search Box */}
                    <div className="p-2 border-b border-zinc-800 flex items-center gap-2 bg-zinc-950/30">
                        <Search className="h-4 w-4 text-zinc-500 shrink-0" />
                        <input
                            type="text"
                            placeholder="Search country..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full bg-transparent text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none border-none ring-0"
                            autoFocus
                        />
                    </div>
                    {/* Country List */}
                    <div className="overflow-y-auto p-1 flex-1 custom-scrollbar">
                        {filteredOptions.length === 0 ? (
                            <div className="text-zinc-600 text-xs text-center py-4">No countries found</div>
                        ) : (
                            filteredOptions.map((option) => {
                                const callingCode = option.value ? getCountryCallingCode(option.value as any) : '';
                                return (
                                    <button
                                        key={option.value}
                                        type="button"
                                        onClick={() => {
                                            onChange(option.value);
                                            setIsOpen(false);
                                        }}
                                        className={`w-full flex items-center justify-between text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                                            value === option.value
                                                ? 'bg-emerald-500/10 text-emerald-500 font-semibold'
                                                : 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2 truncate">
                                            <span className="truncate text-xs">{option.label}</span>
                                            <span className="text-zinc-500 text-[10px] font-bold shrink-0">
                                                (+{callingCode})
                                            </span>
                                        </div>
                                        {value === option.value && <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />}
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

function CustomGenderSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [dropdownRef]);

    const options = [
        { value: 'Male', label: 'Male' },
        { value: 'Female', label: 'Female' },
        { value: 'Non-binary', label: 'Non-binary' },
        { value: 'Prefer not to say', label: 'Prefer not to say' }
    ];

    const selectedOption = options.find(opt => opt.value === value);

    return (
        <div className="relative w-full" ref={dropdownRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full flex items-center justify-between bg-zinc-950/50 border rounded-xl py-2.5 px-4 text-sm font-medium transition-all duration-200 focus:outline-none ${
                    isOpen
                        ? 'border-emerald-500/50 ring-1 ring-emerald-500/50 text-white'
                        : 'border-zinc-800 text-zinc-300 hover:border-zinc-700'
                }`}
            >
                <span className={value ? "text-zinc-200 font-semibold" : "text-zinc-600"}>
                    {selectedOption ? selectedOption.label : 'Select Gender'}
                </span>
                <ChevronDown className={`h-4 w-4 text-zinc-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute top-full left-0 mt-2 w-full bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl shadow-black/80 overflow-hidden z-50 p-1">
                    {options.map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            onClick={() => {
                                onChange(option.value);
                                setIsOpen(false);
                            }}
                            className={`w-full flex items-center justify-between text-left px-3 py-2.5 rounded-lg text-sm transition-colors ${
                                value === option.value
                                    ? 'bg-emerald-500/10 text-emerald-500 font-bold'
                                    : 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
                            }`}
                        >
                            {option.label}
                            {value === option.value && <Check className="h-4 w-4 text-emerald-500" />}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

export default function RegisterPage() {
    const [currentStep, setCurrentStep] = useState(1);
    const [formData, setFormData] = useState({
        username: '',
        realName: '',
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

    // Pre-fill email from Google signup redirect (one-time use)
    useEffect(() => {
        const googleData = localStorage.getItem('googleSignupData');
        if (googleData) {
            localStorage.removeItem('googleSignupData');
            try {
                const parsed = JSON.parse(googleData);
                setFormData(prev => ({
                    ...prev,
                    email: parsed.email || '',
                    realName: parsed.firstName && parsed.lastName 
                        ? `${parsed.firstName} ${parsed.lastName}` 
                        : (parsed.firstName || parsed.lastName || '')
                }));
            } catch (e) {
                console.error('Failed to parse Google signup data:', e);
            }
        }
    }, []);

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
        
        // Validation on Step 1
        if (currentStep === 1) {
            if (!formData.username.trim()) {
                setError("Username is required.");
                return;
            }
            if (!formData.realName.trim()) {
                setError("Display Name is required.");
                return;
            }
            if (formData.password !== formData.confirmPassword) {
                setError("Passwords do not match!");
                return;
            }
            if (formData.password.length < 8) {
                setError("Password must be at least 8 characters long.");
                return;
            }
            setError(null); // Clear errors if valid
        }

        // Validation on Step 2
        if (currentStep === 2) {
            if (formData.birthDate && formData.birthDate.length > 0) {
                if (formData.birthDate.length !== 10) {
                    setError("Birth Date must be in DD/MM/YYYY format.");
                    return;
                }
                const parts = formData.birthDate.split('/');
                const day = parseInt(parts[0], 10);
                const month = parseInt(parts[1], 10);
                const year = parseInt(parts[2], 10);
                
                if (isNaN(day) || isNaN(month) || isNaN(year)) {
                    setError("Birth Date contains invalid characters.");
                    return;
                }
                if (month < 1 || month > 12) {
                    setError("Birth Date month must be between 01 and 12.");
                    return;
                }
                if (day < 1 || day > 31) {
                    setError("Birth Date day must be between 01 and 31.");
                    return;
                }
                
                // Days in month validation
                const daysInMonth = new Date(year, month, 0).getDate();
                if (day > daysInMonth) {
                    setError(`Invalid day for the selected month (max ${daysInMonth}).`);
                    return;
                }

                // Year checks
                const currentYear = new Date().getFullYear();
                if (year < 1900 || year > currentYear) {
                    setError(`Birth Date year must be between 1900 and ${currentYear}.`);
                    return;
                }
            }
            setError(null); // Clear errors if valid
        }

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

        // Convert DD/MM/YYYY to YYYY-MM-DD for backend
        let formattedBirthDate = null;
        if (formData.birthDate && formData.birthDate.length === 10) {
            const parts = formData.birthDate.split('/');
            if (parts.length === 3) {
                const day = parts[0];
                const month = parts[1];
                const year = parts[2];
                formattedBirthDate = `${year}-${month}-${day}`;
            }
        }

        // 1. Map Frontend Data to Backend Keys (Snake Case)
        const payload = {
            username: formData.username.trim(),
            real_name: formData.realName.trim(),
            email: formData.email,
            password: formData.password,
            phone_number: formData.phoneNumber,
            is_gamer: formData.roles.includes('gamer'),
            is_developer: formData.roles.includes('developer'),
            is_investor: formData.roles.includes('investor'),
            gender: formData.gender,
            birth_date: formattedBirthDate,
            platforms: formData.platforms,
            interests: formData.interests,
            roles: formData.roles
        };

        console.log('Submitting Registration Payload:', payload);

        try {
            // 2. API Call
            await api.post('/register/', payload);

            // 3. Redirect to Email Verification page
            const emailEncoded = encodeURIComponent(formData.email);
            router.push(`/verify-email?email=${emailEncoded}`);

        } catch (err: any) {
            console.error('Registration Error:', err.response?.data || err.message);
            const data = err.response?.data;
            let errorMsg = 'Registration failed. Please check your inputs.';
            if (data) {
                if (typeof data === 'string') {
                    errorMsg = data;
                } else if (data.detail) {
                    errorMsg = data.detail;
                } else {
                    // DRF returns field-level errors like {password: ["too common"], username: ["already exists"]}
                    const firstKey = Object.keys(data)[0];
                    if (firstKey) {
                        const msgs = Array.isArray(data[firstKey]) ? data[firstKey].join(' ') : data[firstKey];
                        errorMsg = `${firstKey}: ${msgs}`;
                    }
                }
            }
            setError(errorMsg);
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

    const handleBirthDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let value = e.target.value.replace(/\D/g, ''); // Keep only numbers
        if (value.length > 8) value = value.slice(0, 8); // Max 8 digits

        // Format as DD/MM/YYYY
        let formatted = '';
        if (value.length > 0) {
            formatted += value.slice(0, 2);
        }
        if (value.length > 2) {
            formatted += '/' + value.slice(2, 4);
        }
        if (value.length > 4) {
            formatted += '/' + value.slice(4, 8);
        }

        setFormData(prev => ({ ...prev, birthDate: formatted }));
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

                <form onSubmit={handleNext} className="space-y-6" autoComplete="off">
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
                                        autoComplete="off"
                                        className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl py-2.5 pl-10 pr-4 text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all"
                                        value={formData.username}
                                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                        required
                                    />
                                </div>

                                {/* Display Name */}
                                <div className="relative group">
                                    <User className="absolute left-3 top-3 h-5 w-5 text-zinc-500 group-focus-within:text-emerald-500 transition-colors" />
                                    <input
                                        type="text"
                                        placeholder="Display Name"
                                        autoComplete="off"
                                        maxLength={100}
                                        className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl py-2.5 pl-10 pr-4 text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all"
                                        value={formData.realName}
                                        onChange={(e) => setFormData({ ...formData, realName: e.target.value })}
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
                                        countrySelectComponent={CustomCountrySelect}
                                        numberInputProps={{
                                            className: "w-full bg-transparent border-none outline-none focus:outline-none focus:ring-0 text-zinc-200 placeholder:text-zinc-600 pl-2 self-stretch"
                                        }}
                                        className="flex items-center gap-2 w-full bg-zinc-950/50 border border-zinc-800 rounded-xl py-2 pl-2.5 pr-4 text-zinc-200 focus-within:border-emerald-500/50 focus-within:ring-1 focus-within:ring-emerald-500/50 transition-all"
                                    />
                                </div>

                                {/* Passwords */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="relative group">
                                        <Lock className="absolute left-3 top-3 h-5 w-5 text-zinc-500 group-focus-within:text-emerald-500 transition-colors" />
                                        <input
                                            type="password"
                                            placeholder="Password"
                                            autoComplete="new-password"
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
                                            autoComplete="new-password"
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
                                        <CustomGenderSelect
                                            value={formData.gender}
                                            onChange={(val) => setFormData({ ...formData, gender: val })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-zinc-400 text-sm font-bold mb-2">Birth Date</label>
                                        <input
                                            type="text"
                                            placeholder="DD/MM/YYYY"
                                            maxLength={10}
                                            className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl py-2.5 px-4 text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all"
                                            value={formData.birthDate}
                                            onChange={handleBirthDateChange}
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
