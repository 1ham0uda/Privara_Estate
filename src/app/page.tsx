'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { 
  Shield, 
  Lock, 
  Zap, 
  CheckCircle2, 
  ArrowRight, 
  Users, 
  MessageSquare, 
  FileText,
  Building2,
  Search,
  Check
} from 'lucide-react';
import { Button, Card } from '@/src/components/UI';
import Navbar from '@/src/components/Navbar';
import { useLanguage } from '@/src/context/LanguageContext';
import { useAuth } from '@/src/context/AuthContext';
import Image from 'next/image';

export default function LandingPage() {
  const { profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && profile) {
      router.push(`/${profile.role}/dashboard`);
    }
  }, [profile, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-black border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isRTL = false;

  return (
    <div className="min-h-screen bg-white text-black selection:bg-black selection:text-white">
      <Navbar forceLanguage="en" />
      
      {/* Hero Section */}
      <section className="relative pt-20 pb-32 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="flex flex-col lg:flex-row items-center gap-12">
            <div className="text-center lg:text-left max-w-2xl">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
              >
                <span className="inline-flex items-center px-4 py-1.5 rounded-full bg-gray-100 text-sm font-medium text-gray-800 mb-6">
                  <Lock className="w-4 h-4 mr-2" /> Secure & Private Consultations
                </span>
                <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-8 leading-[1.1]">
                  Expert Advice <span className="text-gray-400">Without Compromise</span>
                </h1>
                <p className="text-xl text-gray-600 mb-10 leading-relaxed">
                  Connect with top-tier consultants for legal, financial, and strategic advice through our secure, encrypted platform.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-start gap-4">
                  <Link href="/register">
                    <Button className="w-full sm:w-auto h-14 px-8 text-lg rounded-2xl">
                      Get Started
                    </Button>
                  </Link>
                  <Link href="#how-it-works">
                    <Button variant="outline" className="w-full sm:w-auto h-14 px-8 text-lg rounded-2xl">
                      How It Works
                    </Button>
                  </Link>
                </div>
              </motion.div>
            </div>

            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="relative w-full max-w-xl aspect-square lg:aspect-auto lg:h-[600px] rounded-[3rem] overflow-hidden shadow-2xl"
            >
              <Image 
                src="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=2070&auto=format&fit=crop"
                alt="Modern Luxury Home"
                fill
                className="object-cover"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
            </motion.div>
          </div>
        </div>

        {/* Background Accents */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full -z-10 pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-gray-50 rounded-full blur-3xl opacity-50" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-gray-50 rounded-full blur-3xl opacity-50" />
        </div>
      </section>

      {/* Value Proposition */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: Shield, title: "No Phone Calls", desc: "Communicate entirely through our secure chat. No need to share your personal phone number." },
              { icon: Lock, title: "In-App Security", desc: "All data and conversations are encrypted and stored securely within our platform." },
              { icon: Zap, title: "Expert Vetting", desc: "Every consultant is thoroughly vetted to ensure you receive the highest quality advice." }
            ].map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <Card className="bg-white border-none shadow-sm h-full">
                  <div className="w-12 h-12 bg-black rounded-xl flex items-center justify-center mb-6">
                    <feature.icon className="text-white w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                  <p className="text-gray-600">{feature.desc}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-20">
            <h2 className="text-4xl font-bold mb-4">How It Works</h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Getting expert advice has never been easier or more secure.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 relative">
            <div className="hidden md:block absolute top-12 left-0 w-full h-0.5 bg-gray-100 -z-10" />
            
            {[
              { icon: Search, title: "Submit Case", desc: "Describe your situation and what you hope to achieve." },
              { icon: CheckCircle2, title: "Admin Review", desc: "Our team reviews your case and assigns the best expert." },
              { icon: Users, title: "Consultation", desc: "Chat directly with your expert in a secure environment." },
              { icon: FileText, title: "Final Report", desc: "Receive a comprehensive report and actionable advice." }
            ].map((step, i) => (
              <motion.div 
                key={i} 
                className="text-center"
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <div className="w-16 h-16 bg-white border-4 border-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm">
                  <step.icon className="w-8 h-8 text-black" />
                </div>
                <h4 className="text-lg font-bold mb-2">{step.title}</h4>
                <p className="text-sm text-gray-500">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Image Section */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center gap-16">
            <div className="flex-1">
              <div className="relative aspect-[4/3] rounded-[3rem] overflow-hidden shadow-2xl">
                <Image 
                  src="https://images.unsplash.com/photo-1560518883-ce09059eeffa?q=80&w=1973&auto=format&fit=crop"
                  alt="Real Estate Professional"
                  fill
                  className="object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>
            <div className="flex-1 space-y-8">
              <h2 className="text-4xl font-bold leading-tight">
                Why Choose Privately?
              </h2>
              <p className="text-xl text-gray-600">
                We believe that everyone deserves access to high-quality professional advice without sacrificing their privacy.
              </p>
              <ul className="space-y-4">
                {[
                  "Direct access to verified industry experts",
                  "End-to-end encrypted communication",
                  "Transparent pricing and clear outcomes"
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-emerald-500" />
                    <span className="font-medium">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center space-x-2">
            <Shield className="w-6 h-6" />
            <span className="text-xl font-bold">Privately</span>
          </div>
          <p className="text-gray-500 text-sm">© 2024 Privately. All rights reserved.</p>
          <div className="flex gap-8 text-sm text-gray-500">
            <Link href="#" className="hover:text-black">Privacy Policy</Link>
            <Link href="#" className="hover:text-black">Terms of Service</Link>
            <Link href="#" className="hover:text-black">Contact Us</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
